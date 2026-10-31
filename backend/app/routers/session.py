import logging
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, StringConstraints

from app import ratelimit
from app.config import passcode_hash, sandbox_limit_per_ip
from app.passcode import verify_passcode
from app.sandbox import OWNER_SPACE, create_sandbox, expires_at
from app.session import Session, clear_session, read_session, write_session

router = APIRouter(prefix="/api/session", tags=["session"])

# Sandboxes copy the whole training log, so cap how fast they can be created
# (per IP comes from config so local tutorial recording isn't throttled).
SANDBOXES_PER_HOUR = 500
# A 6-digit code has a million options. Three wrong tries pause owner login on that network
# for up to an hour (the login button disappears there too), and a global cap limits many
# networks at once: guessing would take decades. The owner session lasts 90 days, so Sergio
# rarely logs in, and a typo or two still leaves them a try.
LOGIN_FAILURES_PER_IP = 3
LOGIN_FAILURE_WINDOW = 60 * 60
LOGIN_FAILURES_GLOBAL_PER_HOUR = 10
LOCKED = "Too many wrong passcodes. Owner login is paused here for up to an hour."

log = logging.getLogger("uvicorn.error")


class SessionInfo(BaseModel):
    role: Literal["owner", "guest"] | None
    expiresAt: int | None = None
    # False when no passcode is set, or login is paused for this network after wrong tries.
    ownerLoginEnabled: bool


class OwnerLogin(BaseModel):
    passcode: Annotated[str, StringConstraints(pattern=r"^\d{6}$")]


def _ip_failures_key(request: Request) -> str:
    return f"login-fail-ip#{ratelimit.client_ip(request)}"


def _login_paused(request: Request) -> bool:
    return (
        ratelimit.count(_ip_failures_key(request), LOGIN_FAILURE_WINDOW) >= LOGIN_FAILURES_PER_IP
        or ratelimit.count("login-fail-all", 3600) >= LOGIN_FAILURES_GLOBAL_PER_HOUR
    )


def _info(session: Session | None, request: Request) -> SessionInfo:
    # The owner is already in, so skip the counter reads.
    enabled = passcode_hash() is not None and (
        (session is not None and session.role == "owner") or not _login_paused(request)
    )
    return SessionInfo(
        role=session.role if session else None,
        expiresAt=expires_at(session.space) if session else None,
        ownerLoginEnabled=enabled,
    )


@router.get("")
def get_session(request: Request) -> SessionInfo:
    return _info(read_session(request), request)


def _start_sandbox(request: Request, response: Response, sample: bool = False) -> SessionInfo:
    ip = ratelimit.client_ip(request)
    if (
        ratelimit.hit(f"sandbox-ip#{ip}", 3600) > sandbox_limit_per_ip()
        or ratelimit.hit("sandbox-all", 3600) > SANDBOXES_PER_HOUR
    ):
        raise ratelimit.too_many("Too many demos started; try again in a bit")
    session = Session(role="guest", space=create_sandbox(sample=sample))
    write_session(response, session)
    return _info(session, request)


@router.post("/guest")
def start_guest(request: Request, response: Response) -> SessionInfo:
    """Start a demo with a private copy of the training log (or keep the one already running)."""
    session = read_session(request)
    if session and session.role == "guest":
        return _info(session, request)
    return _start_sandbox(request, response)


@router.post("/guest/reset")
def reset_guest(request: Request, response: Response, sample: bool = False) -> SessionInfo:
    """Throw away this demo's changes and start over from a fresh copy.

    `?sample=true` starts from the sample log instead (for browser tests and tutorial clips).
    """
    return _start_sandbox(request, response, sample=sample)


@router.post("/owner")
def owner_login(body: OwnerLogin, request: Request, response: Response) -> SessionInfo:
    stored = passcode_hash()
    if stored is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Owner login isn't set up")
    if _login_paused(request):
        raise ratelimit.too_many(LOCKED)
    if not verify_passcode(body.passcode, stored):
        failures = ratelimit.hit(_ip_failures_key(request), LOGIN_FAILURE_WINDOW)
        ratelimit.hit("login-fail-all", 3600)
        # The error-alert email watches for this line (infra/monitoring.tf).
        log.warning("Wrong owner passcode")
        left = LOGIN_FAILURES_PER_IP - failures
        if left <= 0:
            raise ratelimit.too_many(LOCKED)
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            f"Wrong passcode. {left} {'try' if left == 1 else 'tries'} left.",
        )
    session = Session(role="owner", space=OWNER_SPACE)
    write_session(response, session)
    return _info(session, request)


@router.delete("")
def logout(request: Request, response: Response) -> SessionInfo:
    clear_session(response)
    return _info(None, request)

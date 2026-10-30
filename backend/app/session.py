"""Signed session cookie: either the owner (Sergio's real training log) or a guest (a private sandbox)."""

import time
from typing import Literal

from fastapi import Request, Response
from itsdangerous import BadSignature, URLSafeTimedSerializer
from pydantic import BaseModel

from app.config import OWNER_SESSION_DAYS, cookie_secure, session_secret
from app.sandbox import OWNER_SPACE, expires_at, is_expired

COOKIE = "gym_session"
OWNER_MAX_AGE = OWNER_SESSION_DAYS * 86400


class Session(BaseModel):
    role: Literal["owner", "guest"]
    space: str


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(session_secret(), salt="gym-session")


def read_session(request: Request) -> Session | None:
    """The valid session on this request, or None (missing, tampered, or expired)."""
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    try:
        data = _serializer().loads(token, max_age=OWNER_MAX_AGE)
        session = Session(**data)
    except (BadSignature, ValueError, TypeError):
        return None
    # Never trust a cookie to point somewhere it shouldn't.
    if session.role == "owner" and session.space != OWNER_SPACE:
        return None
    if session.role == "guest" and (expires_at(session.space) is None or is_expired(session.space)):
        return None
    return session


def write_session(response: Response, session: Session) -> None:
    if session.role == "owner":
        max_age = OWNER_MAX_AGE
    else:
        max_age = max(0, (expires_at(session.space) or 0) - int(time.time()))
    response.set_cookie(
        COOKIE,
        _serializer().dumps(session.model_dump()),
        max_age=max_age,
        httponly=True,
        secure=cookie_secure(),
        samesite="lax",
        path="/",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/", secure=cookie_secure(), httponly=True, samesite="lax")

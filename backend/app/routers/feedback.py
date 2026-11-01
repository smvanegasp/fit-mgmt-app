"""Feedback from the owner or a guest, kept outside every sandbox so it outlives the 24h demo.
The agent reviews it at the start of each session (scripts/feedback.py); Sergio also sees it in
Settings. Guest feedback logs a line that the alarm turns into an email (infra/monitoring.tf)."""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status

from app import db, ratelimit
from app.models import Feedback, FeedbackCreate, FeedbackUpdate
from app.sandbox import FEEDBACK_SPACE
from app.session import Session, read_session

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

PER_IP_PER_HOUR = 10
ALL_PER_DAY = 200

log = logging.getLogger("uvicorn.error")


def _session(request: Request) -> Session:
    session = read_session(request)
    if session is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No session; look around as a guest or log in")
    return session


def _owner(request: Request) -> None:
    if _session(request).role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner reads feedback")


@router.post("", status_code=status.HTTP_201_CREATED)
def send_feedback(body: FeedbackCreate, request: Request) -> Feedback:
    session = _session(request)
    if (
        ratelimit.hit(f"feedback-ip#{ratelimit.client_ip(request)}", 3600) > PER_IP_PER_HOUR
        or ratelimit.hit("feedback-all", 86400) > ALL_PER_DAY
    ):
        raise ratelimit.too_many("That's a lot of feedback; thank you! Try again in a bit")
    feedback = Feedback(
        id=uuid.uuid4().hex[:12], text=body.text.strip(), page=body.page.strip(), role=session.role,
        createdAt=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        userAgent=request.headers.get("user-agent", "")[:200],
    )
    db.put(FEEDBACK_SPACE, f"FEEDBACK#{feedback.createdAt}#{feedback.id}", feedback.model_dump())
    if session.role == "guest":
        # The guest-feedback alarm watches for this line (infra/monitoring.tf).
        log.warning("Guest feedback received")
    return feedback


@router.get("")
def list_feedback(request: Request) -> list[Feedback]:
    """Newest first."""
    _owner(request)
    return [Feedback(**row) for row in reversed(db.query(FEEDBACK_SPACE, "FEEDBACK#"))]


@router.patch("/{feedback_id}")
def update_feedback(feedback_id: str, body: FeedbackUpdate, request: Request) -> Feedback:
    _owner(request)
    for sk, row in db.keys(FEEDBACK_SPACE, "FEEDBACK#"):
        if row.get("id") == feedback_id:
            updated = Feedback(**{**row, "status": body.status})
            db.put(FEEDBACK_SPACE, sk, updated.model_dump())
            return updated
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found")

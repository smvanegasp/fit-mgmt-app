import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app import ai_limits, peloton, storage
from app.models import Peloton
from app.routers.photos import can_read, object_keys
from app.space import current_space

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/peloton", tags=["peloton"])


class ReadBody(BaseModel):
    """An uploaded photo (POST /photos returned its key)."""

    key: str = Field(max_length=120)


@router.post("/read")
def read_screenshot(body: ReadBody, space: str = Depends(current_space)) -> Peloton:
    """A Peloton summary screenshot -> the class stats. On in demos too (capped, app/ai_limits.py)."""
    if not can_read(space, body.key):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found")
    found = storage.get(object_keys(body.key)[0])
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found")
    ai_limits.check("peloton", space)
    try:
        return peloton.read(found[0])
    except peloton.PelotonOff:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Reading screenshots is off (no GROQ_API_KEY)") from None
    except (httpx.HTTPError, KeyError, IndexError):
        log.warning("Peloton read failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't read the screenshot; the photo is saved") from None

"""Guest sandboxes: a private, throwaway copy of the owner's training log.

A sandbox id carries its own expiry ("sb-<unix-expiry>-<random>"), so every row written to it
gets the same DynamoDB TTL and the whole sandbox disappears together.
"""

import time
import uuid

from app import db
from app.config import SANDBOX_HOURS
from app.sample_data import seed_sample

OWNER_SPACE = "main"
PREFIX = "sb-"


def expires_at(space: str) -> int | None:
    """Unix time when a sandbox expires; None for the owner's space."""
    if not space.startswith(PREFIX):
        return None
    try:
        return int(space.split("-")[1])
    except (IndexError, ValueError):
        return None


def is_expired(space: str) -> bool:
    expiry = expires_at(space)
    return expiry is not None and expiry <= time.time()


def create_sandbox(sample: bool = False) -> str:
    """Copy the owner's log into a new sandbox and return its id. The owner's workout in progress
    stays private. Uses the sample log instead when asked to, or when the owner has none yet."""
    expiry = int(time.time()) + SANDBOX_HOURS * 3600
    space = f"{PREFIX}{expiry}-{uuid.uuid4().hex}"
    if not sample and db.query(OWNER_SPACE, "WORKOUT#"):
        db.copy_space(OWNER_SPACE, space, skip=("ACTIVE",))
    else:
        seed_sample(space)
    return space

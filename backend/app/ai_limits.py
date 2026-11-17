"""Limits on the paid AI calls (the cue check, Peloton screenshots) for guest demos. Visitors get the
same experience as Sergio (2026-11-17: "that's the whole point"), so the features are on in demos;
these caps only keep a runaway visitor from running up the bill. The owner has no limit."""

from app import ratelimit
from app.sandbox import OWNER_SPACE

PER_DEMO_PER_DAY = 20
ALL_DEMOS_PER_DAY = 300


def check(feature: str, space: str) -> None:
    """Count one call; raise 429 when a demo (or all demos together) went over today's cap."""
    if space == OWNER_SPACE:
        return
    if ratelimit.hit(f"{feature}#{space}", 86400) > PER_DEMO_PER_DAY:
        raise ratelimit.too_many("That's enough for one demo today")
    if ratelimit.hit(f"{feature}-all-demos", 86400) > ALL_DEMOS_PER_DAY:
        raise ratelimit.too_many("Busy right now; try again tomorrow")

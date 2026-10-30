"""What the log says about an exercise: when it was done, the last session, and Sergio's
progression streak.

His system (from the WhatsApp log): repeat the main working sets ("5x5 @ 170") until they've
been done a few sessions in a row, then add weight. The streak is the last session's first group
of identical working sets and how many sessions in a row reached it at that weight.
"""

from typing import Any

from app import db
from app.models import Entry, LastTime, Scheme, Streak


def workouts(space: str) -> list[dict[str, Any]]:
    """Every saved workout, oldest first (the sort key starts with the date)."""
    return db.query(space, "WORKOUT#")


def merged_entry(workout: dict[str, Any], exercise_id: str) -> Entry | None:
    """All of a workout's entries for one exercise as one (it can appear twice in a session)."""
    found = [Entry(**e) for e in workout.get("entries", []) if e.get("exerciseId") == exercise_id]
    if not found:
        return None
    merged = found[0].model_copy(deep=True)
    for extra in found[1:]:
        merged.sets += extra.sets
        merged.notes += extra.notes
        merged.problems += extra.problems
        merged.segments += extra.segments
    return merged


def scheme(entry: Entry) -> Scheme | None:
    """The first group of identical working sets (drop sets and complexes aside)."""
    work = [s for s in entry.sets if not s.drop and not s.detail]
    if not work:
        return None
    first = work[0]
    count = 0
    for s in work:
        if (s.reps, s.seconds, s.weightLb, bool(s.each)) != (first.reps, first.seconds, first.weightLb, bool(first.each)):
            break
        count += 1
    return Scheme(count=count, reps=first.reps, seconds=first.seconds, weightLb=first.weightLb, each=bool(first.each))


def reached(entry: Entry, target: Scheme) -> bool:
    """At least `count` sets at the target weight with at least the target reps (or seconds)."""
    good = [
        s for s in entry.sets
        if not s.drop and (s.weightLb or 0) == (target.weightLb or 0)
        and (s.reps or 0) >= (target.reps or 0) and (s.seconds or 0) >= (target.seconds or 0)
    ]
    return len(good) >= target.count


def summary(space: str, exercise_id: str, exclude: str | None = None) -> tuple[LastTime | None, Streak | None]:
    """Last session and streak for an exercise, ignoring the workout being edited (`exclude`)."""
    done = [
        (w, e) for w in reversed(workouts(space))
        if w.get("id") != exclude and (e := merged_entry(w, exercise_id)) is not None
    ]
    if not done:
        return None, None
    workout, entry = done[0]
    last = LastTime(workoutId=workout["id"], date=workout["date"], entry=entry)
    target = scheme(entry)
    if target is None:
        return last, None
    times = 0
    for _, e in done:
        if not reached(e, target):
            break
        times += 1
    return last, Streak(scheme=target, times=times)


def usage(space: str) -> dict[str, tuple[str, int]]:
    """exerciseId -> (last date done, number of sessions)."""
    out: dict[str, tuple[str, int]] = {}
    for w in workouts(space):
        for exercise_id in {e.get("exerciseId") for e in w.get("entries", [])}:
            _, count = out.get(exercise_id, ("", 0))
            out[exercise_id] = (w["date"], count + 1)
    return out

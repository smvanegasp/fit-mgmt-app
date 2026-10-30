"""What the log says about an exercise: when it was done, the last session, photos, and
Sergio's target game.

The target game (his rules): the target is a set scheme ("4x4 @ 115"). A session that reaches it
adds one; a session that misses takes one away (2 in a row, then a miss, leaves 1). At 3 it's
time to go up. Replaying the whole history with these rules gives the current target and count,
for imported sessions and app ones alike.
"""

import re
from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from app import db
from app.models import DatedPhoto, DatedSets, Entry, LastTime, Scheme, SessionType, Streak

GOAL = 3


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
        merged.photos += extra.photos
        merged.problems += extra.problems
        merged.segments += extra.segments
    return merged


def scheme(entry: Entry) -> Scheme | None:
    """The working sets at the session's top weight (drop sets and complexes aside)."""
    work = [s for s in entry.sets if not s.drop and not s.detail and (s.reps is not None or s.seconds is not None)]
    if not work:
        return None
    top = max(s.weightLb or 0 for s in work)
    at_top = [s for s in work if (s.weightLb or 0) == top]
    timed = all(s.reps is None for s in at_top)
    return Scheme(
        sets=[(s.seconds if timed else s.reps) or 0 for s in at_top],
        weightLb=at_top[0].weightLb,
        each=bool(at_top[0].each),
        seconds=timed,
    )


def reached(entry: Entry, target: Scheme) -> bool:
    """As many total reps (or seconds) as the target, at the target weight or more."""
    done = sum(
        ((s.seconds if target.seconds else s.reps) or 0)
        for s in entry.sets
        if not s.drop and not s.detail and (s.weightLb or 0) >= (target.weightLb or 0)
    )
    return done >= target.total


# A session more than this much lighter than the target is a light or comeback day: it neither
# adds nor takes away (for up to STALE days; after that the lighter work becomes the target). A
# smaller drop is a deload, which starts a new target.
LIGHT_DAY = 0.9
STALE = timedelta(days=60)

_SETS = re.compile(r"(\d+)\s*[xX]\s*(\d+(?:\.\d+)?)")
_WEIGHT = re.compile(r"(\d+(?:\.\d+)?)\s*(lbs?|kg)\b", re.I)
_WEIGHT_FIRST = re.compile(r"antes\s+(\d+(?:\.\d+)?)\s+\d+\s*[xX]", re.I)
_TIMES = re.compile(r"(?<![xX\d])(?<![xX]\s)(\d+)\s*ve(?:z|ces)\b", re.I)


def written_target(text: str) -> tuple[Scheme, int, float | None] | None:
    """Sergio's own target notes from the WhatsApp log: "4x4 115 lbs 0 vez", "antes 180 5x4 1 vez",
    "1 vez 3x4 1x3 90 lbs" -> (scheme, times so far, weight or None when not written)."""
    times = _TIMES.search(text)
    groups = _SETS.findall(text)
    if not times or not groups:
        return None
    reps = [float(r) for n, r in groups for _ in range(int(n))]
    weight_match = _WEIGHT.search(text) or _WEIGHT_FIRST.search(text)
    weight = float(weight_match.group(1)) if weight_match else None
    if weight_match and weight_match.re is _WEIGHT and weight_match.group(2).lower() == "kg":
        weight = round(weight * 2.20462 * 2) / 2
    return Scheme(sets=reps, weightLb=weight), int(times.group(1)), weight


def progression(sessions: list[tuple[str, Entry]]) -> Streak | None:
    """Replay the target game over an exercise's (date, entry) sessions, oldest first. Where the
    log has Sergio's own written target for the session's top weight, it's the truth: the
    count syncs to it before the session's result is applied."""
    target: Scheme | None = None
    target_date = ""
    times = 0
    for day, entry in sessions:
        main = scheme(entry)
        if main is None:
            continue
        weight = main.weightLb or 0
        for written in entry.targets:
            parsed = written_target(written.text) if written.kind != "dropset" else None
            if parsed and (parsed[2] is None or parsed[2] == weight):
                target = parsed[0].model_copy(update={"weightLb": main.weightLb, "each": main.each})
                times, target_date = parsed[1], day
                break
        target_weight = (target.weightLb or 0) if target else 0
        stale = target is not None and date.fromisoformat(day) - date.fromisoformat(target_date) > STALE
        if target is None or weight > target_weight:
            target, times, target_date = main, 1, day  # first session, or went up
            continue
        if weight < target_weight * LIGHT_DAY and not stale:
            continue
        if weight < target_weight:
            target, times, target_date = main, 1, day  # deload, or the lighter work became the norm
            continue
        if reached(entry, target):
            if times >= GOAL and main.total > target.total:
                target, times = main, 1  # done 3 times, then more reps: the next target
            else:
                times += 1
        else:
            times = max(0, times - 1)
        target_date = day
    return Streak(scheme=target, times=times, goal=GOAL) if target else None


def best_drop(sessions: list[tuple[str, Entry]]) -> DatedSets | None:
    """The drop-set ladder with the most total reps (ties go to the most recent)."""
    best: DatedSets | None = None
    best_reps = 0.0
    for day, entry in sessions:
        ladder = [s for s in entry.sets if s.drop]
        reps = sum(s.reps or 0 for s in ladder)
        if ladder and reps >= best_reps:
            best, best_reps = DatedSets(date=day, sets=ladder), reps
    return best


def summary(space: str, exercise_id: str, exclude: str | None = None) -> tuple[LastTime | None, Streak | None, list[DatedPhoto], DatedSets | None]:
    """Last session, target game, photos and best drop set for an exercise, ignoring the workout
    being edited."""
    done = [
        (w, e) for w in workouts(space)
        if w.get("id") != exclude and (e := merged_entry(w, exercise_id)) is not None
    ]
    if not done:
        return None, None, [], None
    workout, entry = done[-1]
    last = LastTime(workoutId=workout["id"], date=workout["date"], entry=entry)
    photos = [DatedPhoto(**p.model_dump(), date=w["date"]) for w, e in reversed(done) for p in e.photos][:12]
    sessions = [(w["date"], e) for w, e in done]
    return last, progression(sessions), photos, best_drop(sessions)


def usage(space: str) -> dict[str, tuple[str, int]]:
    """exerciseId -> (last date done, number of sessions)."""
    out: dict[str, tuple[str, int]] = {}
    for w in workouts(space):
        for exercise_id in {e.get("exerciseId") for e in w.get("entries", [])}:
            _, count = out.get(exercise_id, ("", 0))
            out[exercise_id] = (w["date"], count + 1)
    return out


def session_types(space: str, recent: int = 40) -> list[SessionType]:
    """Each kind of day from the last `recent` sessions of that kind, with the exercises done in at
    least a quarter of them, in their usual order. Climbing days are their own kind."""
    by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for w in workouts(space):
        main = (w.get("label") or "Workout").split(" + ")[0]
        by_type[main].append(w)
        if main != "Climb" and any(e.get("exerciseId") == "bouldering" for e in w.get("entries", [])):
            by_type["Climb"].append(w)
    types = []
    for label, sessions in by_type.items():
        sessions = sessions[-recent:]
        seen: dict[str, list[float]] = defaultdict(list)
        for w in sessions:
            ids = list(dict.fromkeys(e.get("exerciseId") for e in w.get("entries", [])))
            for i, exercise_id in enumerate(ids):
                seen[exercise_id].append(i / max(1, len(ids) - 1))
        usual = [x for x, positions in seen.items() if len(positions) >= max(1, len(sessions) / 4)]
        usual.sort(key=lambda x: sum(seen[x]) / len(seen[x]))
        types.append(SessionType(label=label, exercises=usual, lastDate=sessions[-1]["date"], sessions=len(sessions)))
    return sorted(types, key=lambda t: -t.sessions)

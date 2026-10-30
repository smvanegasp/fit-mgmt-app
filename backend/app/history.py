"""What the log says about an exercise: when it was done, the last session, photos, and
Sergio's target game.

The target game (his rules): the target is a set scheme ("4x4 @ 115"). A session that reaches it
adds one; a session that misses takes one away (2 in a row, then a miss, leaves 1). At 3 it's
time to go up. Replaying the whole history with these rules gives the current target and count,
for imported sessions and app ones alike.
"""

import re
from collections import defaultdict
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Literal

from app import db
from app.labels import day_type
from app.models import BestSet, DatedPhoto, DatedSets, Entry, ExerciseHistory, ExerciseSession, LastTime, Scheme, SessionType, Streak

GOAL = 3


@dataclass
class GameStep:
    """One session in the target game: "new" (first session, more weight, a deload, or the next
    target after 3), "reached" (+1), "missed" (-1) or "light" (a light day, doesn't count); and the
    target and count after it."""

    date: str
    result: Literal["new", "reached", "missed", "light"]
    target: Scheme
    times: int


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
    """The target game after the last session (see replay)."""
    last = None
    for last in replay(sessions):
        pass
    return Streak(scheme=last.target, times=last.times, goal=GOAL) if last else None


def replay(sessions: list[tuple[str, Entry]]) -> Iterator[GameStep]:
    """Replay the target game over an exercise's (date, entry) sessions, oldest first, yielding
    each session's result. Where the log has Sergio's own written target for the session's top
    weight, it's the truth: the count syncs to it before the session's result is applied."""
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
            result = "new"
        elif weight < target_weight * LIGHT_DAY and not stale:
            result = "light"
        elif weight < target_weight:
            target, times, target_date = main, 1, day  # deload, or the lighter work became the norm
            result = "new"
        else:
            if reached(entry, target):
                result = "reached"
                if times >= GOAL and main.total > target.total:
                    target, times, result = main, 1, "new"  # done 3 times, then more reps: the next target
                else:
                    times += 1
            else:
                result = "missed"
                times = max(0, times - 1)
            target_date = day
        yield GameStep(date=day, result=result, target=target, times=times)


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
    every = workouts(space)
    edited = next((w for w in every if w.get("id") == exclude), None)
    # Editing a past workout: only what came before it counts (its "last time" and its target then).
    before = (edited["date"], edited.get("startedAt", "")) if edited else None
    done = [
        (w, e) for w in every
        if w.get("id") != exclude and (before is None or (w["date"], w.get("startedAt", "")) < before)
        and (e := merged_entry(w, exercise_id)) is not None
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
    least a quarter of them, in their usual order (old day names map to today's types)."""
    by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for w in workouts(space):
        main = day_type(w.get("label") or "Workout")
        by_type[main].append(w)
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
        if label == "Cardio":
            # Weekly cardio from 2026-10-30: a Peloton run or a walk.
            usual = ["peloton-run", "walk", *[x for x in usual if x not in ("peloton-run", "walk")]]
        types.append(SessionType(label=label, exercises=usual, lastDate=sessions[-1]["date"], sessions=len(sessions)))
    return sorted(types, key=lambda t: -t.sessions)


def best_set(sessions: list[tuple[str, Entry]]) -> BestSet | None:
    """The heaviest working set, most reps breaking ties (body-weight work: just the most reps);
    the earliest date wins a full tie, as that's when it was first done."""
    best: tuple[float, float] | None = None
    found: BestSet | None = None
    for day, entry in sessions:
        for s in entry.sets:
            if s.drop or s.detail or (s.reps is None and s.seconds is None):
                continue
            key = (s.weightLb or 0, s.reps or s.seconds or 0)
            if best is None or key > best:
                best, found = key, BestSet(date=day, set=s)
    return found


def exercise_history(space: str, exercise_id: str) -> ExerciseHistory:
    done = [(w, e) for w in workouts(space) if (e := merged_entry(w, exercise_id)) is not None]
    sessions = [
        ExerciseSession(workoutId=w["id"], date=w["date"], label=w.get("label") or "Workout", entry=e)
        for w, e in reversed(done)
    ]
    photos = [DatedPhoto(**p.model_dump(), date=w["date"]) for w, e in reversed(done) for p in e.photos]
    return ExerciseHistory(sessions=sessions, photos=photos, best=best_set([(w["date"], e) for w, e in done]))

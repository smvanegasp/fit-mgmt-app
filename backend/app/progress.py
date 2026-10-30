"""What the Progress tab plots: training days for the consistency calendar, and each lift's top
set per session with its PRs and target-game results."""

from typing import Any

from app.history import merged_entry, replay, workouts
from app.labels import day_type
from app.models import Entry, Exercise, Lift, Progress, ProgressDay, SetData, StrengthPoint

# The small multiples on the Progress tab.
MAIN_LIFTS = ["squat", "deadlift", "bench-press", "dips", "chin-ups"]

WEIGHTED = {"barbell", "dumbbell", "machine", "added"}


def _working(entry: Entry) -> list[SetData]:
    """Working sets: drop sets and complexes aside."""
    return [s for s in entry.sets if not s.drop and not s.detail and (s.reps is not None or s.seconds is not None)]


def unit(exercise: Exercise, entries: list[Entry]) -> str:
    """lb for weighted lifts ever done with weight; otherwise the most reps (or seconds) in a set
    ("Weighted pull-ups" done only at body weight plot reps)."""
    if exercise.load in WEIGHTED and any(s.weightLb for e in entries for s in _working(e)):
        return "lb"
    return "s" if exercise.measure == "seconds" else "reps"


def _scheme_text(reps: list[float]) -> str:
    """[4, 4, 4, 4] -> "4x4"; [4, 4, 3] -> "4, 4, 3"."""
    numbers = [f"{r:g}" for r in reps]
    return f"{len(numbers)}x{numbers[0]}" if len(set(numbers)) == 1 else ", ".join(numbers)


def top_set(entry: Entry, exercise: Exercise, measure: str) -> tuple[float, float | None, str] | None:
    """(value, reps at it, working sets at it) for a session, or None when nothing counts: the
    heaviest working set (as written: plates for barbell lifts) for weighted lifts, the most reps (or seconds) otherwise.
    A weighted lift done without weight that day isn't plotted."""
    work = _working(entry)
    if not work:
        return None
    if measure == "lb":
        top = max(s.weightLb or 0 for s in work)
        if not top:
            return None
        at_top = [s.reps or s.seconds or 0 for s in work if (s.weightLb or 0) == top]
        return top, max(at_top), _scheme_text(at_top)
    counts = [(s.seconds if measure == "s" else s.reps) or 0 for s in work]
    return max(counts), None, _scheme_text(counts)


def strength(every: list[dict[str, Any]], exercise: Exercise) -> Lift:
    done = [(w, e) for w in every if (e := merged_entry(w, exercise.id)) is not None]
    measure = unit(exercise, [e for _, e in done])
    games = {step.date: step for step in replay([(w["date"], e) for w, e in done])}
    points: list[StrengthPoint] = []
    best = None
    for workout, entry in done:
        top = top_set(entry, exercise, measure)
        if top is None:
            continue
        value, reps, sets = top
        step = games.get(workout["date"])
        points.append(StrengthPoint(
            date=workout["date"], workoutId=workout["id"], value=value, reps=reps, sets=sets,
            pr=best is not None and value > best,
            game=step.result if step else None, times=step.times if step else None,
        ))
        best = value if best is None else max(best, value)
    bar = exercise.barLb if exercise.load == "barbell" else 0
    return Lift(exerciseId=exercise.id, name=exercise.name, load=exercise.load, unit=measure, barLb=bar, sessions=points)


def progress(space: str, exercises: dict[str, Exercise]) -> Progress:
    every = workouts(space)
    days = [
        ProgressDay(date=w["date"], workoutId=w["id"], label=w.get("label") or "Workout",
                    type=day_type(w.get("label") or "Workout"))
        for w in every
    ]
    lifts = [strength(every, exercises[x]) for x in MAIN_LIFTS if x in exercises]
    return Progress(days=days, lifts=lifts)

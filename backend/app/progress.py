"""What the Progress tab and exercise pages show: training days for the consistency weeks, and each
exercise's progression ladder (the targets Sergio worked through, built from the target game)."""

from typing import Any

from app import db
from app.history import merged_entry, replay, workouts
from app.labels import day_type
from app.models import Exercise, Lift, Progress, ProgressDay, Routine, Step, StepSession

# The lifts on the Progress tab.
MAIN_LIFTS = ["squat", "deadlift", "bench-press", "dips", "chin-ups"]


def ladder(every: list[dict[str, Any]], exercise: Exercise) -> Lift:
    """One step per target: a new step starts when the target changes (more weight, more sets or
    reps after 3, a deload, or a target Sergio wrote down). Coming back to the same target after a
    break stays on its step. Light days are left out."""
    done = [(w, e) for w in every if (e := merged_entry(w, exercise.id)) is not None]
    ids = {w["date"]: w["id"] for w, _ in done}
    steps: list[Step] = []
    weighted = exercise.load in ("barbell", "dumbbell", "machine", "added")
    for game in replay([(w["date"], e) for w, e in done]):
        # A weighted lift done at body weight that day is a light day too.
        if game.result == "light" or (weighted and not game.target.weightLb):
            continue
        session = StepSession(date=game.date, workoutId=ids[game.date], result=game.result)
        if not steps or steps[-1].scheme != game.target:
            steps.append(Step(scheme=game.target, sessions=[session], times=game.times))
        else:
            steps[-1].sessions.append(session)
            steps[-1].times = game.times
    bar = exercise.barLb if exercise.load == "barbell" else 0
    return Lift(exerciseId=exercise.id, name=exercise.name, load=exercise.load, barLb=bar, steps=steps)


def progress(space: str, exercises: dict[str, Exercise]) -> Progress:
    every = workouts(space)
    days = [
        ProgressDay(date=w["date"], workoutId=w["id"], label=w.get("label") or "Workout",
                    type=day_type(w.get("label") or "Workout"))
        for w in every
    ]
    lifts = [ladder(every, exercises[x]) for x in MAIN_LIFTS if x in exercises]
    return Progress(days=days, lifts=lifts, routines=routines(space, days))


def routines(space: str, days: list[ProgressDay]) -> list[Routine]:
    """The routine eras, newest first, with the workouts logged in each."""
    out = []
    for row in db.query(space, "ROUTINE#"):
        era = Routine(**row)
        era.sessions = sum(1 for d in days if d.date >= era.start and (era.end is None or d.date <= era.end))
        out.append(era)
    return sorted(out, key=lambda r: r.start, reverse=True)

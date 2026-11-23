"""Training plans (Sergio, 2026-11-21): the days of the routine and their exercises, editable.

Sergio trains Push, Legs, Pull and a cardio day each week, in two alternating week types: one
week has heavy push (weighted dips), squat legs and light pull; the next light push, deadlift legs
and heavy pull (weighted chin-ups). Each day plan is a day type, a name and its exercises in order.

Until Sergio saves plans of their own, they're read off the log: the last two weeks with strength
days give the two week types. This week's type follows from the newest workout that matches a plan
(its first lift), flipping every week since.
"""

from datetime import date, timedelta
from typing import Any

from app import db
from app.history import workouts
from app.labels import day_type
from app.models import DayPlan, Exercise, TrainingPlans

ROW = "SETTINGS#plans"
STRENGTH = ("Push", "Legs", "Pull")
SKIP = {"warm-up"}


def monday(day: str) -> str:
    d = date.fromisoformat(day)
    return (d - timedelta(days=d.weekday())).isoformat()


def first_lift(workout: dict[str, Any]) -> str | None:
    """The first exercise with sets logged (a warm-up, run or climbing before it don't count)."""
    return next((e["exerciseId"] for e in workout.get("entries", []) if e.get("sets")), None)


def _exercises(workout: dict[str, Any], groups: dict[str, str]) -> list[str]:
    ids = [e["exerciseId"] for e in workout.get("entries", []) if e["exerciseId"] not in SKIP]
    return [x for x in dict.fromkeys(ids) if groups.get(x) != "cardio"]


def _name(day: str, first: str, other_first: str | None, exercises: dict[str, Exercise]) -> str:
    """"Heavy push" (a weighted first lift: dips, chin-ups), "Light pull", "Legs · Squat"."""
    lift = exercises.get(first)
    if day == "Legs":
        short = {"squat": "Squat", "deadlift": "Deadlift"}.get(first, lift.name if lift else first)
        return f"Legs · {short}"
    heavy = lift is not None and lift.load == "added"
    other = exercises.get(other_first or "")
    other_heavy = other is not None and other.load == "added"
    if heavy and not other_heavy:
        return f"Heavy {day.lower()}"
    if other_heavy and not heavy:
        return f"Light {day.lower()}"
    return f"{day} · {lift.name if lift else first}"


def infer(space: str, exercises: dict[str, Exercise]) -> list[DayPlan]:
    """Two week types from the last two weeks with 2+ strength days (newest = week A)."""
    groups = {x.id: x.group for x in exercises.values()}
    by_week: dict[str, list[dict[str, Any]]] = {}
    for w in workouts(space):
        if day_type(w.get("label") or "Workout") in STRENGTH and first_lift(w):
            by_week.setdefault(monday(w["date"]), []).append(w)
    weeks = [ws for _, ws in sorted(by_week.items(), reverse=True) if len({day_type(w["label"]) for w in ws}) >= 2][:2]
    if not weeks:
        return []
    picked: dict[str, dict[str, dict[str, Any]]] = {"A": {}, "B": {}}
    for week, ws in zip("AB", weeks):
        for w in ws:  # oldest first, so the week's last session of a type wins
            picked[week][day_type(w["label"])] = w
    plans = []
    for week in "AB":
        for day in STRENGTH:
            w = picked[week].get(day)
            if not w:
                continue
            first = first_lift(w)
            other = picked["B" if week == "A" else "A"].get(day)
            plans.append(DayPlan(id=f"{week}-{day.lower()}", name=_name(day, first, other and first_lift(other), exercises),
                                 dayType=day, week=week, exercises=_exercises(w, groups)))
    return plans


def week_type(space: str, plans: list[DayPlan], today: str) -> str:
    """This week's type: the week of the newest workout whose day type and first lift match a plan
    (and only one week's plan), flipped for every week since."""
    keys: dict[tuple[str, str], set[str]] = {}
    for p in plans:
        if p.exercises:
            keys.setdefault((p.dayType, p.exercises[0]), set()).add(p.week)
    for w in reversed(workouts(space)):
        found = keys.get((day_type(w.get("label") or "Workout"), first_lift(w) or ""))
        if found and len(found) == 1:
            week = next(iter(found))
            gap = (date.fromisoformat(monday(today)) - date.fromisoformat(monday(w["date"]))).days // 7
            return week if gap % 2 == 0 else ("B" if week == "A" else "A")
    return "A"


def get_plans(space: str, exercises: dict[str, Exercise], today: str) -> TrainingPlans:
    row = db.get(space, ROW)
    saved = row is not None
    plans = [DayPlan(**p) for p in row["plans"]] if row else infer(space, exercises)
    return TrainingPlans(plans=plans, weekType=week_type(space, plans, today) if plans else "A", saved=saved)


def save_plans(space: str, plans: list[DayPlan]) -> None:
    db.put(space, ROW, {"plans": [p.model_dump() for p in plans]})

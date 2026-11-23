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


RECENT = 3  # sessions of a day that decide its exercises


def usual_exercises(sessions: list[dict[str, Any]], groups: dict[str, str]) -> list[str]:
    """A day's exercises from its last sessions (oldest first): the ones done in most of them, plus
    anything new in the latest (one skipped day doesn't drop an exercise, one try adds it), in
    their usual order."""
    recent = [_exercises(w, groups) for w in sessions[-RECENT:]]
    positions: dict[str, list[float]] = {}
    for ids in recent:
        for i, x in enumerate(ids):
            positions.setdefault(x, []).append(i / max(1, len(ids) - 1))
    need = len(recent) // 2 + 1 if len(recent) > 1 else 1
    keep = [x for x, p in positions.items() if len(p) >= need or x in recent[-1]]
    first = recent[-1][0]
    return [first, *sorted((x for x in keep if x != first), key=lambda x: sum(positions[x]) / len(positions[x]))]


def infer(space: str, exercises: dict[str, Exercise]) -> list[DayPlan]:
    """Two week types from the log. Each day type's variants are its two latest first lifts
    (weighted dips or bench; squat or deadlift); the week of the newest week with 2+ strength
    days is week A, its counterparts week B. A day type with one variant is in both weeks."""
    groups = {x.id: x.group for x in exercises.values()}
    every = [w for w in workouts(space) if day_type(w.get("label") or "Workout") in STRENGTH and first_lift(w)]
    if not every:
        return []
    variants: dict[str, dict[str, list[dict[str, Any]]]] = {}  # day type -> first lift -> sessions
    for w in every:
        variants.setdefault(day_type(w["label"]), {}).setdefault(first_lift(w), []).append(w)
    by_week: dict[str, list[dict[str, Any]]] = {}
    for w in every:
        by_week.setdefault(monday(w["date"]), []).append(w)
    newest = next((ws for _, ws in sorted(by_week.items(), reverse=True) if len({day_type(w["label"]) for w in ws}) >= 2),
                  by_week[max(by_week)])
    in_a = {(day_type(w["label"]), first_lift(w)) for w in newest}
    plans = []
    for day in STRENGTH:
        lifts = sorted(variants.get(day, {}), key=lambda x: variants[day][x][-1]["date"], reverse=True)[:2]
        if not lifts:
            continue
        a = next((x for x in lifts if (day, x) in in_a), lifts[0])
        b = next((x for x in lifts if x != a), a)
        for week, lift, other in (("A", a, b), ("B", b, a)):
            plans.append(DayPlan(id=f"{week}-{day.lower()}", name=_name(day, lift, other if other != lift else None, exercises),
                                 dayType=day, week=week, exercises=usual_exercises(variants[day][lift], groups)))
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

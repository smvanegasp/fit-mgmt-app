"""Training plans (Sergio, 2026-11-21; flexible from 11-23): week types that repeat in order.

Each week type has a name and its days; each day a name, a kind (Push, Legs, Pull, Upper, Lower,
Full body or Cardio) and its exercises in order. Sergio's routine today is two week types: heavy
push, squat legs, light pull and a ride; then light push, deadlift legs, heavy pull and a ride.

Until Sergio saves plans of their own, they're read off the log. This week's type is counted from
the anchor Sergio set ("this week is ..."), or else from the newest workout that matches a day of
exactly one week type, moving one week type along the rotation per calendar week.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any

from app import db
from app.history import workouts
from app.labels import day_type
from app.models import DayPlan, Exercise, GoalDay, PlanVersion, TrainingPlans, WeekGoal, WeekPlan

ROW = "SETTINGS#plans"
VERSION = "PLANS#"  # + savedAt: every saved version, for the history and past weeks' goals
ROTATION = ("Push", "Legs", "Pull")
SKIP = {"warm-up"}
RECENT = 3  # sessions of a day that decide its exercises


def monday(day: str) -> str:
    d = date.fromisoformat(day)
    return (d - timedelta(days=d.weekday())).isoformat()


def weeks_between(a: str, b: str) -> int:
    return (date.fromisoformat(monday(b)) - date.fromisoformat(monday(a))).days // 7


def first_lift(workout: dict[str, Any]) -> str | None:
    """The first exercise with sets logged (a warm-up, run or climbing before it don't count)."""
    return next((e["exerciseId"] for e in workout.get("entries", []) if e.get("sets")), None)


def _exercises(workout: dict[str, Any], groups: dict[str, str]) -> list[str]:
    ids = [e["exerciseId"] for e in workout.get("entries", []) if e["exerciseId"] not in SKIP]
    return [x for x in dict.fromkeys(ids) if groups.get(x) != "cardio"]


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


def _day_name(kind: str, first: str, other_first: str | None, exercises: dict[str, Exercise]) -> str:
    """"Heavy push" (a weighted first lift: dips, chin-ups), "Light pull", "Legs · Squat"."""
    lift = exercises.get(first)
    if kind == "Legs":
        short = {"squat": "Squat", "deadlift": "Deadlift"}.get(first, lift.name if lift else first)
        return f"Legs · {short}"
    heavy = lift is not None and lift.load == "added"
    other = exercises.get(other_first or "")
    other_heavy = other is not None and other.load == "added"
    if heavy and not other_heavy:
        return f"Heavy {kind.lower()}"
    if other_heavy and not heavy:
        return f"Light {kind.lower()}"
    return f"{kind} · {lift.name if lift else first}" if other_first else kind


def week_name(days: list[DayPlan]) -> str | None:
    """"Squat & heavy push week" (Sergio, 2026-11-23): the week's Legs lift and its heavy day."""
    legs = next((d for d in days if d.kind == "Legs"), None)
    lift = legs.name.removeprefix("Legs · ") if legs and legs.name.startswith("Legs · ") else None
    heavy = next((d.name.lower() for d in days if d.name.lower().startswith("heavy ")), None)
    parts = [p for p in (lift, heavy) if p]
    return " & ".join(parts).capitalize() + " week" if parts else None


def _named(weeks: list[list[DayPlan]]) -> list[WeekPlan]:
    names = [week_name(days) for days in weeks]
    if len(set(names)) < len(names) or None in names:
        names = [f"Week {chr(65 + i)}" for i in range(len(weeks))]
    return [WeekPlan(id=chr(65 + i), name=name, days=days) for i, (name, days) in enumerate(zip(names, weeks))]


def _cardio(week: str) -> DayPlan:
    return DayPlan(id=f"{week}-cardio", name="Cardio", kind="Cardio")


def infer(space: str, exercises: dict[str, Exercise]) -> list[WeekPlan]:
    """Week types from the log. Each day type's variants are its two latest first lifts (weighted
    dips or bench; squat or deadlift); the newest week with 2+ strength days is the first week
    type, its counterparts the second. With one variant per day there's one week type."""
    groups = {x.id: x.group for x in exercises.values()}
    every = [w for w in workouts(space) if day_type(w.get("label") or "Workout") in ROTATION and first_lift(w)]
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
    in_first = {(day_type(w["label"]), first_lift(w)) for w in newest}
    two = any(len(v) > 1 for v in variants.values())
    weeks: list[list[DayPlan]] = [[], []] if two else [[]]
    for kind in ROTATION:
        lifts = sorted(variants.get(kind, {}), key=lambda x: variants[kind][x][-1]["date"], reverse=True)[:2]
        if not lifts:
            continue
        a = next((x for x in lifts if (kind, x) in in_first), lifts[0])
        b = next((x for x in lifts if x != a), a)
        for i, (lift, other) in enumerate(((a, b), (b, a))[: len(weeks)]):
            weeks[i].append(DayPlan(id=f"{chr(65 + i)}-{kind.lower()}",
                                    name=_day_name(kind, lift, other if other != lift else None, exercises),
                                    kind=kind, exercises=usual_exercises(variants[kind][lift], groups)))
    for i, days in enumerate(weeks):
        days.append(_cardio(chr(65 + i)))
    return _named(weeks)


def _from_row(row: dict[str, Any]) -> list[WeekPlan]:
    """Saved plans; the first saved shape (A/B day lists, stage 11b) becomes two week types."""
    if "weeks" in row:
        return [WeekPlan(**w) for w in row["weeks"]]
    by_week: dict[str, list[DayPlan]] = {}
    for p in row.get("plans", []):
        by_week.setdefault(p["week"], []).append(DayPlan(id=p["id"], name=p["name"], kind=p["dayType"], exercises=p["exercises"]))
    weeks = [days + [_cardio(w)] for w, days in sorted(by_week.items())]
    return _named(weeks)


def current_week(space: str, weeks: list[WeekPlan], anchor: dict[str, str] | None, today: str,
                 log: list[dict[str, Any]] | None = None) -> str | None:
    """This week's type: counted from the anchor, else from the newest workout whose kind and first
    lift match a day of exactly one week type. One step along the rotation per week."""
    if not weeks:
        return None
    ids = [w.id for w in weeks]
    if anchor and anchor.get("week") in ids:
        return ids[(ids.index(anchor["week"]) + weeks_between(anchor["monday"], today)) % len(ids)]
    keys: dict[tuple[str, str], set[str]] = {}
    for w in weeks:
        for d in w.days:
            if d.exercises:
                keys.setdefault((d.kind, d.exercises[0]), set()).add(w.id)
    for workout in reversed(log if log is not None else workouts(space)):
        found = keys.get((day_type(workout.get("label") or "Workout"), first_lift(workout) or ""))
        if found and len(found) == 1:
            start = ids.index(next(iter(found)))
            return ids[(start + weeks_between(workout["date"], today)) % len(ids)]
    return ids[0]


def get_plans(space: str, exercises: dict[str, Exercise], today: str) -> TrainingPlans:
    row = db.get(space, ROW)
    weeks = _from_row(row) if row else infer(space, exercises)
    anchor = row.get("anchor") if row else None
    return TrainingPlans(weeks=weeks, current=current_week(space, weeks, anchor, today), saved=row is not None)


def save_plans(space: str, weeks: list[WeekPlan], current: str | None, today: str) -> None:
    """`current` ("this week is ...") anchors the rotation at this week; without it the old anchor
    stays (if its week type still exists)."""
    old = db.get(space, ROW) or {}
    anchor = {"monday": monday(today), "week": current} if current else old.get("anchor")
    row: dict[str, Any] = {"weeks": [w.model_dump() for w in weeks]}
    if anchor and anchor["week"] in {w.id for w in weeks}:
        row["anchor"] = anchor
    db.put(space, ROW, row)
    # Every version is kept: the history, and the goal of the weeks it was in force.
    saved_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    key = datetime.now(timezone.utc).isoformat(timespec="microseconds")  # ordered, even two saves a second apart
    db.put(space, f"{VERSION}{key}", {**row, "savedAt": saved_at, "start": monday(today)})


def history(space: str) -> list[PlanVersion]:
    """Every saved version, newest first."""
    return [PlanVersion(savedAt=r["savedAt"], start=r["start"], weeks=r["weeks"]) for r in reversed(db.query(space, VERSION))]


def goal_of(week: WeekPlan, start: str) -> WeekGoal:
    counted = [d for d in week.days if not d.optional]
    return WeekGoal(monday=start, week=week.name, strength=sum(d.kind != "Cardio" for d in counted),
                    cardio=sum(d.kind == "Cardio" for d in counted), days=[GoalDay(name=d.name, kind=d.kind) for d in counted])


def goals(space: str, today: str) -> list[WeekGoal]:
    """Each week's goal from the first saved version on (Sergio, 2026-11-23: the goal follows the
    plan): the week type that week had under the version in force then. Weeks before any saved
    version keep the fixed goal (lib/progress.ts), so the streak's past doesn't change."""
    versions = db.query(space, VERSION)  # oldest first
    if not versions:
        return []
    log = workouts(space)
    out = []
    start, end = date.fromisoformat(min(v["start"] for v in versions)), date.fromisoformat(monday(today))
    while start <= end:
        day = start.isoformat()
        version = [v for v in versions if v["start"] <= day][-1]
        weeks = [WeekPlan(**w) for w in version["weeks"]]
        wid = current_week(space, weeks, version.get("anchor"), day, log)
        week = next((w for w in weeks if w.id == wid), None)
        if week:
            out.append(goal_of(week, day))
        start += timedelta(days=7)
    return out

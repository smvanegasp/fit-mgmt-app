"""A small sample training log for demos when the owner has none yet (and for browser tests):
eight weeks of Push / Legs / Pull ending this week, each lift going up 5 lb after three
sessions at a target, a few cues and one routine."""

from datetime import date, timedelta
from typing import Any

from app import db

WEEKS = 8
# Day of the week (Monday = 0), day type, and the lifts: (exercise, sets, reps, starting weight
# as written, or None for body weight).
PLAN = [
    (0, "Push", [("dips", 4, 4, 70), ("bench-press", 5, 3, 95)]),
    (2, "Legs", [("squat", 5, 5, 135), ("rdl", 3, 8, 95)]),
    (4, "Pull", [("chin-ups", 4, 3, 25), ("pull-ups", 3, 8, None)]),
]
CUES = {
    "squat": [("setup", "Bar on the traps, not the neck"), ("brace", "Big breath, brace, then unrack"), ("lift", "Slow on the way down")],
    "dips": [("setup", "Plates tight between the knees"), ("lift", "Stay focused on every rep")],
    "chin-ups": [("lift", "Full hang at the bottom")],
}


def sample_rows(today: date) -> dict[str, dict[str, Any]]:
    start = today - timedelta(days=today.weekday()) - timedelta(weeks=WEEKS - 1)
    rows: dict[str, dict[str, Any]] = {}
    for week in range(WEEKS):
        for weekday, label, lifts in PLAN:
            day = start + timedelta(weeks=week, days=weekday)
            if day > today:
                continue
            iso = day.isoformat()
            entries = []
            for exercise_id, sets, reps, weight in lifts:
                # Three sessions at a target, then 5 lb more.
                lb = None if weight is None else weight + 5 * (week // 3)
                entries.append({"exerciseId": exercise_id, "sets": [{"reps": reps, **({} if lb is None else {"weightLb": lb})}] * sets})
            rows[f"WORKOUT#{iso}#{iso}-1"] = {
                "id": f"{iso}-1", "date": iso, "startedAt": f"{iso}T18:00:00", "endedAt": f"{iso}T19:10:00",
                "label": label, "plan": label, "source": "app", "entries": entries,
            }
    first = start.isoformat()
    for exercise_id, cues in CUES.items():
        for rank, (section, text) in enumerate(cues, start=1):
            note_id = f"sample-{exercise_id}-{rank}"
            rows[f"NOTE#{exercise_id}#{first}#{note_id}"] = {
                "id": note_id, "exerciseId": exercise_id, "text": text, "date": first, "lastSeen": today.isoformat(),
                "sessions": WEEKS, "section": section, "rank": rank, "source": "app",
            }
    rows[f"ROUTINE#{first}#sample"] = {
        "id": "sample", "name": "3-day split", "from": first, "to": None,
        "days": ["Push: weighted dips, bench press", "Legs: squat, Romanian deadlift", "Pull: weighted chin-ups, pull-ups"],
        "notes": "Up 5 lb after reaching a target three sessions in a row.", "source": "app",
    }
    return rows


def seed_sample(space: str, today: date | None = None) -> None:
    db.put_many(space, sample_rows(today or date.today()))

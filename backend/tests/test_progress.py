"""The Progress tab and exercise pages: training days, and each exercise's progression ladder."""

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def day(date: str, label: str, entries: list[dict]) -> None:
    db.put("main", f"WORKOUT#{date}#{date}-1", {
        "id": f"{date}-1", "date": date, "startedAt": f"{date}T19:00:00", "label": label, "source": "whatsapp",
        "entries": entries,
    })


def squat(*sets: tuple[int, int, float]) -> dict:
    """(count, reps, plates) -> a squat entry."""
    return {"exerciseId": "squat", "sets": [{"reps": r, "weightLb": w} for n, r, w in sets for _ in range(n)]}


def test_days_map_old_names_to_todays_day_types(client: TestClient) -> None:
    day("2026-10-01", "Squat + Climb", [squat((5, 4, 135))])
    day("2026-10-02", "Front lever", [{"exerciseId": "front-raise", "sets": [{"reps": 5}]}])
    day("2026-10-03", "Push", [{"exerciseId": "dips", "sets": [{"reps": 4, "weightLb": 90}]}])
    days = client.get("/api/progress").json()["days"]
    assert [(d["date"], d["type"]) for d in days] == [("2026-10-01", "Legs"), ("2026-10-02", "Pull"), ("2026-10-03", "Push")]
    assert days[0]["label"] == "Squat + Climb" and days[0]["workoutId"] == "2026-10-01-1"


def test_the_ladder_shows_more_reps_then_more_weight(client: TestClient) -> None:
    day("2026-09-01", "Legs", [squat((5, 3, 135))])
    day("2026-09-04", "Legs", [squat((5, 3, 135))])
    day("2026-09-08", "Legs", [squat((5, 3, 135), (3, 8, 105))])  # 3 of 3
    day("2026-09-11", "Legs", [squat((5, 4, 135))])  # more reps: the next target
    day("2026-09-14", "Legs", [squat((3, 6, 105))])  # light day: left out
    day("2026-09-18", "Legs", [squat((4, 4, 135), (1, 3, 135))])  # missed
    day("2026-09-22", "Legs", [squat((5, 4, 140))])  # more weight
    lifts = {x["exerciseId"]: x for x in client.get("/api/progress").json()["lifts"]}
    assert list(lifts) == ["squat", "deadlift", "bench-press", "dips", "chin-ups"]
    assert lifts["deadlift"]["steps"] == []
    squat_ladder = lifts["squat"]
    assert squat_ladder["barLb"] == 45
    got = [
        (s["scheme"]["weightLb"], s["scheme"]["sets"], [x["result"] for x in s["sessions"]], s["times"])
        for s in squat_ladder["steps"]
    ]
    assert got == [
        (135, [3] * 5, ["new", "reached", "reached"], 3),
        (135, [4] * 5, ["new", "missed"], 0),
        (140, [4] * 5, ["new"], 1),
    ]
    assert squat_ladder["steps"][1]["sessions"][1] == {"date": "2026-09-18", "workoutId": "2026-09-18-1", "result": "missed"}


def test_body_weight_work_climbs_by_reps(client: TestClient) -> None:
    day("2026-10-01", "Pull", [{"exerciseId": "front-raise", "sets": [{"reps": 5}] * 3}])
    day("2026-10-04", "Pull", [{"exerciseId": "front-raise", "sets": [{"reps": 6}] * 3}])
    steps = client.get("/api/exercises/front-raise/progress").json()["steps"]
    assert [(s["scheme"]["sets"], [x["result"] for x in s["sessions"]], s["times"]) for s in steps] == [
        ([5, 5, 5], ["new", "reached"], 2),
    ]


def test_unknown_exercise_is_404(client: TestClient) -> None:
    assert client.get("/api/exercises/nope/progress").status_code == 404


def test_routines_newest_first_with_their_sessions(client: TestClient) -> None:
    db.put("main", "ROUTINE#2026-09-01#a", {"id": "a", "name": "Old plan", "from": "2026-09-01", "to": "2026-09-30",
                                            "days": ["Push", "Legs"], "notes": "Three days", "source": "whatsapp"})
    db.put("main", "ROUTINE#2026-10-01#b", {"id": "b", "name": "New plan", "from": "2026-10-01", "to": None,
                                            "days": ["Push", "Legs", "Pull"], "notes": "", "source": "whatsapp",
                                            "photos": [{"key": "main/wa-1"}]})
    day("2026-09-15", "Push", [])
    day("2026-09-30", "Legs", [])
    day("2026-10-02", "Pull", [])
    routines = client.get("/api/progress").json()["routines"]
    assert [(r["name"], r["from"], r.get("to"), r["sessions"]) for r in routines] == [
        ("New plan", "2026-10-01", None, 1),
        ("Old plan", "2026-09-01", "2026-09-30", 2),
    ]
    assert routines[0]["photos"] == [{"key": "main/wa-1"}] and routines[1]["notes"] == "Three days"

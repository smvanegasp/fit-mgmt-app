"""The Progress tab: training days, and each lift's top set with PRs and target-game results."""

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


def test_squat_line_shows_plates_and_marks_prs_and_the_target_game(client: TestClient) -> None:
    day("2026-10-01", "Legs", [squat((5, 4, 135), (3, 8, 105))])
    day("2026-10-05", "Legs", [squat((5, 4, 135))])
    day("2026-10-09", "Legs", [squat((4, 4, 135), (1, 3, 135))])  # missed
    day("2026-10-12", "Legs", [squat((3, 6, 105))])  # light day
    day("2026-10-15", "Legs", [squat((5, 4, 140))])  # went up: a PR
    lifts = {x["exerciseId"]: x for x in client.get("/api/progress").json()["lifts"]}
    assert list(lifts) == ["squat", "deadlift", "bench-press", "dips", "chin-ups"]
    assert lifts["deadlift"]["sessions"] == []
    line = lifts["squat"]
    assert line["unit"] == "lb" and line["name"] == "Back squat" and line["barLb"] == 45
    got = [(p["value"], p["reps"], p["sets"], p.get("pr", False), p["game"], p["times"]) for p in line["sessions"]]
    assert got == [
        (135, 4, "5x4", False, "new", 1),
        (135, 4, "5x4", False, "reached", 2),
        (135, 4, "4, 4, 4, 4, 3", False, "missed", 1),
        (105, 6, "3x6", False, "light", 1),
        (140, 4, "5x4", True, "new", 1),
    ]


def test_body_weight_work_plots_the_most_reps(client: TestClient) -> None:
    day("2026-10-01", "Pull", [{"exerciseId": "pull-ups", "sets": [{"reps": 8}, {"reps": 10}, {"reps": 7}]}])
    day("2026-10-04", "Pull", [{"exerciseId": "pull-ups", "sets": [{"reps": 11}, {"reps": 9}, {"reps": 12, "drop": True}]}])
    line = client.get("/api/exercises/pull-ups/progress").json()
    assert line["unit"] == "reps"
    assert [(p["value"], p["sets"], p.get("pr", False)) for p in line["sessions"]] == [(10, "8, 10, 7", False), (11, "11, 9", True)]


def test_weighted_lift_done_without_weight_is_left_out(client: TestClient) -> None:
    day("2026-10-01", "Push", [{"exerciseId": "dips", "sets": [{"reps": 4, "weightLb": 90}] * 3}])
    day("2026-10-03", "Push", [{"exerciseId": "dips", "sets": [{"reps": 4}] * 4}])
    line = client.get("/api/exercises/dips/progress").json()
    assert [(p["date"], p["value"]) for p in line["sessions"]] == [("2026-10-01", 90)]


def test_unknown_exercise_is_404(client: TestClient) -> None:
    assert client.get("/api/exercises/nope/progress").status_code == 404

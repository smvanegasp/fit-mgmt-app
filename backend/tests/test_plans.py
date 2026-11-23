"""Training plans: read off the log until saved, two alternating week types."""

from fastapi.testclient import TestClient

from app import db


def day(date: str, label: str, *ids: str) -> None:
    db.put("main", f"WORKOUT#{date}#{date}-1", {
        "id": f"{date}-1", "date": date, "startedAt": f"{date}T19:00:00", "label": label, "source": "app",
        "entries": [{"exerciseId": "warm-up", "minutes": 8}, *({"exerciseId": x, "sets": [{"reps": 5}]} for x in ids)],
    })


def two_weeks() -> None:
    # Week of Nov 9: light push, deadlift legs, heavy pull. Week of Nov 16: the other three.
    day("2026-11-09", "Push", "bench-press", "overhead-press")
    day("2026-11-11", "Legs", "deadlift", "squat", "calf-raises")
    day("2026-11-14", "Pull", "chin-ups", "back-pull")
    day("2026-11-15", "Cardio", "peloton-ride")
    day("2026-11-18", "Push", "dips", "bar-dips")
    day("2026-11-20", "Legs", "squat", "rdl")
    day("2026-11-21", "Pull", "full-front-raise", "wide-pull-ups")


def test_plans_are_read_off_the_last_two_weeks(client: TestClient) -> None:
    two_weeks()
    got = client.get("/api/plans?today=2026-11-22").json()
    assert got["saved"] is False and got["weekType"] == "A"
    plans = {(p["week"], p["dayType"]): p for p in got["plans"]}
    assert plans[("A", "Push")]["name"] == "Heavy push" and plans[("A", "Push")]["exercises"] == ["dips", "bar-dips"]
    assert plans[("A", "Legs")]["name"] == "Legs · Squat"
    assert plans[("A", "Pull")]["name"] == "Light pull"
    assert plans[("B", "Push")]["name"] == "Light push"
    assert plans[("B", "Legs")]["exercises"] == ["deadlift", "squat", "calf-raises"]
    assert plans[("B", "Pull")]["name"] == "Heavy pull"


def test_the_week_type_alternates(client: TestClient) -> None:
    two_weeks()
    assert client.get("/api/plans?today=2026-11-23").json()["weekType"] == "B"
    assert client.get("/api/plans?today=2026-11-30").json()["weekType"] == "A"


def test_saved_plans_replace_the_inferred_ones(client: TestClient) -> None:
    two_weeks()
    plans = client.get("/api/plans?today=2026-11-22").json()["plans"]
    plans[0] = {**plans[0], "name": "Dips day", "exercises": ["dips", "skull-crusher"]}
    saved = client.put("/api/plans?today=2026-11-22", json={"plans": plans}).json()
    assert saved["saved"] is True and saved["plans"][0]["name"] == "Dips day"
    assert client.get("/api/plans").json()["plans"][0]["exercises"] == ["dips", "skull-crusher"]
    bad = {**plans[0], "exercises": ["nope"]}
    assert client.put("/api/plans", json={"plans": [bad]}).status_code == 400


def test_no_log_no_plans(client: TestClient) -> None:
    assert client.get("/api/plans").json() == {"plans": [], "weekType": "A", "saved": False}


def test_a_day_keeps_what_it_usually_has() -> None:
    from app.plans import usual_exercises

    def w(*ids: str) -> dict:
        return {"entries": [{"exerciseId": x, "sets": [{"reps": 5}]} for x in ids]}

    groups = {"peloton-ride": "cardio"}
    sessions = [w("dips", "bar-dips", "close-pull-ups", "pull-ups"), w("dips", "bar-dips", "close-pull-ups"),
                w("dips", "bar-dips", "lateral-raise", "peloton-ride")]
    # Skipped once: kept. Tried once long ago: dropped. New in the latest: added. Cardio: left out.
    assert usual_exercises(sessions, groups) == ["dips", "bar-dips", "close-pull-ups", "lateral-raise"]

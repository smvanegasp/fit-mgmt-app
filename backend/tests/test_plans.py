"""Training plans: week types that repeat in order, read off the log until saved."""

from fastapi.testclient import TestClient

from app import db
from app.labels import session_label
from app.plans import usual_exercises


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


def test_two_week_types_are_read_off_the_log(client: TestClient) -> None:
    two_weeks()
    got = client.get("/api/plans?today=2026-11-22").json()
    assert got["saved"] is False and got["current"] == "A"
    a, b = got["weeks"]
    assert a["name"] == "Squat & heavy push week" and b["name"] == "Deadlift & heavy pull week"
    assert [(d["name"], d["kind"]) for d in a["days"]] == [
        ("Heavy push", "Push"), ("Legs · Squat", "Legs"), ("Light pull", "Pull"), ("Cardio", "Cardio")]
    assert a["days"][0]["exercises"] == ["dips", "bar-dips"]
    assert b["days"][1]["exercises"] == ["deadlift", "squat", "calf-raises"]


def test_the_rotation_moves_one_week_type_per_week(client: TestClient) -> None:
    two_weeks()
    assert client.get("/api/plans?today=2026-11-23").json()["current"] == "B"
    assert client.get("/api/plans?today=2026-11-30").json()["current"] == "A"


def test_more_week_types_custom_days_and_an_anchor(client: TestClient) -> None:
    two_weeks()
    weeks = client.get("/api/plans?today=2026-11-23").json()["weeks"]
    upper = {"id": "C", "name": "Upper week", "days": [
        {"id": "C-upper", "name": "Upper body", "kind": "Upper", "exercises": ["bench-press", "chin-ups"]},
        {"id": "C-cardio", "name": "Ride", "kind": "Cardio", "exercises": []}]}
    saved = client.put("/api/plans?today=2026-11-23", json={"weeks": [*weeks, upper], "current": "C"}).json()
    assert saved["saved"] is True and saved["current"] == "C" and len(saved["weeks"]) == 3
    # The rotation counts on from the anchor: C, then A, B, C again.
    assert client.get("/api/plans?today=2026-11-30").json()["current"] == "A"
    assert client.get("/api/plans?today=2026-12-14").json()["current"] == "C"
    # Saving again without "this week" keeps the anchor.
    client.put("/api/plans?today=2026-11-30", json={"weeks": saved["weeks"]})
    assert client.get("/api/plans?today=2026-11-30").json()["current"] == "A"


def test_bad_plans_are_refused(client: TestClient) -> None:
    week = {"id": "A", "name": "W", "days": [{"id": "d", "name": "D", "kind": "Push", "exercises": ["nope"]}]}
    assert client.put("/api/plans", json={"weeks": [week]}).status_code == 400
    ok = {**week, "days": [{**week["days"][0], "exercises": []}]}
    assert client.put("/api/plans", json={"weeks": [ok, ok]}).status_code == 400  # same ids
    assert client.put("/api/plans", json={"weeks": [ok], "current": "Z"}).status_code == 400
    assert client.put("/api/plans", json={"weeks": []}).status_code == 422


def test_plans_saved_in_the_first_shape_still_load(client: TestClient) -> None:
    db.put("main", "SETTINGS#plans", {"plans": [
        {"id": "A-push", "name": "Heavy push", "dayType": "Push", "week": "A", "exercises": ["dips"]},
        {"id": "A-legs", "name": "Legs · Squat", "dayType": "Legs", "week": "A", "exercises": ["squat"]},
        {"id": "B-legs", "name": "Legs · Deadlift", "dayType": "Legs", "week": "B", "exercises": ["deadlift"]},
    ]})
    weeks = client.get("/api/plans").json()["weeks"]
    assert [w["name"] for w in weeks] == ["Squat & heavy push week", "Deadlift week"]
    assert [d["kind"] for d in weeks[0]["days"]] == ["Push", "Legs", "Cardio"]


def test_no_log_no_plans(client: TestClient) -> None:
    assert client.get("/api/plans").json() == {"weeks": [], "current": None, "saved": False}


def test_a_day_keeps_what_it_usually_has() -> None:
    def w(*ids: str) -> dict:
        return {"entries": [{"exerciseId": x, "sets": [{"reps": 5}]} for x in ids]}

    groups = {"peloton-ride": "cardio"}
    sessions = [w("dips", "bar-dips", "close-pull-ups", "pull-ups"), w("dips", "bar-dips", "close-pull-ups"),
                w("dips", "bar-dips", "lateral-raise", "peloton-ride")]
    # Skipped once: kept. Tried once long ago: dropped. New in the latest: added. Cardio: left out.
    assert usual_exercises(sessions, groups) == ["dips", "bar-dips", "close-pull-ups", "lateral-raise"]


def test_a_mixed_day_keeps_its_kind_as_the_name() -> None:
    entries = [("bench-press", 3), ("chin-ups", 4)]
    assert session_label(entries, {}) == "Pull"
    assert session_label(entries, {}, kind="Upper") == "Upper"
    assert session_label([*entries, ("peloton-ride", 0)], {}, kind="Full body") == "Full body + Cardio"

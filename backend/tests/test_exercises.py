"""Exercise pages and housekeeping: history, best set, rename, merge."""

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def workout(day: str, entries: list[dict], label: str = "Push") -> None:
    db.put("main", f"WORKOUT#{day}#{day}-1", {"id": f"{day}-1", "date": day, "startedAt": f"{day}T19:00:00",
                                              "label": label, "source": "app", "entries": entries})


def test_history_lists_sessions_photos_and_best_set(client: TestClient) -> None:
    workout("2026-10-01", [{"exerciseId": "bench-press", "sets": [{"reps": 5, "weightLb": 120}] * 3,
                            "photos": [{"key": "main/a", "caption": "Rack"}]}])
    workout("2026-10-08", [{"exerciseId": "bench-press", "sets": [{"reps": 2, "weightLb": 140}, {"reps": 3, "weightLb": 140}]}])
    workout("2026-10-15", [{"exerciseId": "bench-press", "sets": [{"reps": 3, "weightLb": 140}, {"reps": 6, "weightLb": 90, "drop": True}]}])
    workout("2026-10-16", [{"exerciseId": "squat", "sets": [{"reps": 5, "weightLb": 170}]}], label="Legs")

    page = client.get("/api/exercises/bench-press/history").json()
    assert [s["date"] for s in page["sessions"]] == ["2026-10-15", "2026-10-08", "2026-10-01"]
    assert page["photos"] == [{"key": "main/a", "caption": "Rack", "date": "2026-10-01"}]
    # Heaviest weight, most reps at it; the first time it happened.
    assert page["best"] == {"date": "2026-10-08", "set": {"reps": 3, "weightLb": 140}}
    assert client.get("/api/exercises/nope/history").status_code == 404


def test_rename_keeps_the_old_name_searchable(client: TestClient) -> None:
    renamed = client.patch("/api/exercises/dips", json={"name": "Belt dips"}).json()
    assert renamed["name"] == "Belt dips" and "weighted dips" in renamed["aliases"]
    names = {e["id"]: e["name"] for e in client.get("/api/exercises").json()}
    assert names["dips"] == "Belt dips"
    assert client.patch("/api/exercises/dips", json={"name": "Bench press"}).status_code == 409
    assert client.patch("/api/exercises/dips", json={"group": "core"}).json()["group"] == "core"


def test_merge_moves_sessions_and_cues_then_hides_the_duplicate(client: TestClient) -> None:
    dupe = client.post("/api/exercises", json={"name": "Dips belt", "group": "push", "load": "added"}).json()
    workout("2026-10-01", [{"exerciseId": dupe["id"], "sets": [{"reps": 4, "weightLb": 115}]}])
    client.post(f"/api/exercises/{dupe['id']}/notes", json={"text": "Setup at 7", "date": "2026-10-01"})

    merged = client.post(f"/api/exercises/{dupe['id']}/merge", json={"into": "dips"}).json()
    assert merged["id"] == "dips" and "dips belt" in merged["aliases"]
    assert client.get("/api/workouts/2026-10-01-1").json()["entries"][0]["exerciseId"] == "dips"
    summary = client.get("/api/exercises/dips/summary").json()
    assert [c["text"] for c in summary["cues"]] == ["Setup at 7"] and summary["last"]["date"] == "2026-10-01"
    assert dupe["id"] not in {e["id"] for e in client.get("/api/exercises").json()}
    assert client.post("/api/exercises/dips/merge", json={"into": "dips"}).status_code == 400

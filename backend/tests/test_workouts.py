import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def squat_day(workout_id: str, date: str, sets: list[dict], source: str = "whatsapp") -> None:
    db.put("main", f"WORKOUT#{date}#{workout_id}", {
        "id": workout_id, "date": date, "startedAt": f"{date}T19:00:00", "endedAt": f"{date}T19:40:00",
        "label": "Squat", "source": source, "entries": [{"exerciseId": "squat", "sets": sets}],
    })


FIVE_BY_FIVE = [{"reps": 5, "weightLb": 170}] * 5 + [{"reps": 8, "weightLb": 150}] * 3


def test_workout_lifecycle_start_save_finish(client: TestClient) -> None:
    assert client.get("/api/active").json() is None
    started = client.post("/api/active", json={"startedAt": "2026-10-30T18:00:00"}).json()
    assert started["startedAt"] == "2026-10-30T18:00:00"
    # Starting again (another tab) keeps the running stopwatch.
    assert client.post("/api/active", json={"startedAt": "2026-10-30T18:05:00"}).json()["startedAt"] == "2026-10-30T18:00:00"

    body = {"startedAt": "2026-10-30T23:59:00", "entries": [
        {"exerciseId": "dips", "sets": [{"reps": 4, "weightLb": 115}] * 3, "notes": ["setup en 7"]},
        {"exerciseId": "bar-dips", "sets": [{"reps": 8}]},
    ]}
    saved = client.put("/api/active", json=body).json()
    assert saved["startedAt"] == "2026-10-30T18:00:00"  # the stopwatch can't be moved
    assert client.get("/api/active").json()["entries"][0]["notes"] == ["setup en 7"]

    workout = client.post("/api/active/finish", json={"endedAt": "2026-10-30T18:55:00"}).json()
    assert workout["id"].startswith("2026-10-30-") and workout["date"] == "2026-10-30"
    assert workout["label"] == "Push" and workout["source"] == "app" and workout["durationEstimated"] is False
    assert client.get("/api/active").json() is None
    assert client.get(f"/api/workouts/{workout['id']}").json()["endedAt"] == "2026-10-30T18:55:00"


def test_cannot_finish_an_empty_workout_and_can_discard(client: TestClient) -> None:
    client.post("/api/active", json={"startedAt": "2026-10-30T18:00:00"})
    assert client.post("/api/active/finish", json={"endedAt": "2026-10-30T18:01:00"}).status_code == 400
    assert client.delete("/api/active").status_code == 204
    assert client.get("/api/active").json() is None


def test_times_must_be_local_iso(client: TestClient) -> None:
    assert client.post("/api/active", json={"startedAt": "yesterday"}).status_code == 422


def test_edit_and_delete_a_saved_workout(client: TestClient) -> None:
    squat_day("2026-10-23-1", "2026-10-23", FIVE_BY_FIVE)
    edited = client.put("/api/workouts/2026-10-23-1", json={
        "startedAt": "2026-10-23T19:00:00", "endedAt": "2026-10-23T19:40:00",
        "entries": [{"exerciseId": "squat", "sets": [{"reps": 5, "weightLb": 175}]},
                    {"exerciseId": "bouldering", "problems": [{"grade": "V3", "color": "blue", "result": "sent", "count": 1}]}],
    }).json()
    # Id, date and origin stay; the label follows the new content.
    assert edited["id"] == "2026-10-23-1" and edited["source"] == "whatsapp" and edited["label"] == "Squat + Climb"
    assert client.get("/api/workouts?limit=5").json()[0]["entries"][0]["sets"] == [{"reps": 5, "weightLb": 175}]
    assert client.delete("/api/workouts/2026-10-23-1").status_code == 204
    assert client.get("/api/workouts/2026-10-23-1").status_code == 404


def test_workouts_list_most_recent_first(client: TestClient) -> None:
    for day in ("2026-10-01", "2026-10-20", "2026-10-10"):
        squat_day(f"{day}-1", day, FIVE_BY_FIVE)
    assert [w["date"] for w in client.get("/api/workouts?limit=2").json()] == ["2026-10-20", "2026-10-10"]


def test_summary_shows_last_time_and_streak(client: TestClient) -> None:
    squat_day("2026-10-06-1", "2026-10-06", [{"reps": 4, "weightLb": 180}] * 5)  # older, different scheme
    squat_day("2026-10-12-1", "2026-10-12", FIVE_BY_FIVE)
    squat_day("2026-10-16-1", "2026-10-16", [{"reps": 5, "weightLb": 170}] * 4 + [{"reps": 4, "weightLb": 170}])
    squat_day("2026-10-20-1", "2026-10-20", FIVE_BY_FIVE)
    squat_day("2026-10-23-1", "2026-10-23", FIVE_BY_FIVE)
    db.put("main", "NOTE#squat#2026-02-03#n1", {"id": "n1", "exerciseId": "squat", "text": "Concentración total",
                                                 "date": "2026-02-03", "sessions": 23, "source": "whatsapp"})

    summary = client.get("/api/exercises/squat/summary").json()
    assert summary["exercise"]["name"] == "Back squat" and summary["exercise"]["barLb"] == 45
    assert summary["last"]["date"] == "2026-10-23"
    assert summary["streak"] == {"scheme": {"count": 5, "reps": 5, "weightLb": 170, "each": False},
                                 "times": 2}  # 10-16 missed one rep, so the streak is 10-20 and 10-23
    assert [c["text"] for c in summary["cues"]] == ["Concentración total"]
    # While editing the 10-23 workout, "last time" is the one before it.
    assert client.get("/api/exercises/squat/summary?exclude=2026-10-23-1").json()["last"]["date"] == "2026-10-20"


def test_summary_for_an_exercise_never_done(client: TestClient) -> None:
    summary = client.get("/api/exercises/deadlift/summary").json()
    assert "last" not in summary and "streak" not in summary
    assert client.get("/api/exercises/nope/summary").status_code == 404


def test_cues_add_edit_hide_delete(client: TestClient) -> None:
    note = client.post("/api/exercises/dips/notes", json={"text": " Asegurar bien las manos ", "date": "2026-10-30"}).json()
    assert note["text"] == "Asegurar bien las manos" and note["source"] == "app"
    path = f"/api/exercises/dips/notes/{note['id']}"
    assert client.patch(path, json={"text": "Manos firmes en el agarre"}).json()["text"] == "Manos firmes en el agarre"
    assert client.patch(path, json={"hidden": True}).json()["hidden"] is True
    assert client.get("/api/exercises/dips/summary").json()["cues"][0]["hidden"] is True
    assert client.delete(path).status_code == 204
    assert client.get("/api/exercises/dips/summary").json()["cues"] == []


def test_exercises_list_usage_and_custom_exercises(client: TestClient) -> None:
    squat_day("2026-10-12-1", "2026-10-12", FIVE_BY_FIVE)
    squat_day("2026-10-20-1", "2026-10-20", FIVE_BY_FIVE)
    exercises = {e["id"]: e for e in client.get("/api/exercises").json()}
    assert exercises["squat"]["lastDone"] == "2026-10-20" and exercises["squat"]["timesDone"] == 2
    assert exercises["deadlift"]["timesDone"] == 0

    created = client.post("/api/exercises", json={"name": "Hip  thrust", "group": "posterior", "load": "barbell"}).json()
    assert created["name"] == "Hip thrust" and created["barLb"] == 45 and created["source"] == "app"
    assert created["id"] in {e["id"] for e in client.get("/api/exercises").json()}
    assert client.post("/api/exercises", json={"name": "hip thrust"}).status_code == 409


def test_photos_upload_and_read(client: TestClient) -> None:
    jpeg = b"\xff\xd8\xff" + b"0" * 100
    key = client.post("/api/photos", files={"photo": ("p.jpg", jpeg), "thumb": ("t.jpg", jpeg)}).json()["key"]
    assert key.startswith("main/")
    assert client.get(f"/api/photos/{key}?size=thumb").content == jpeg
    assert client.post("/api/photos", files={"photo": ("p.txt", b"hello"), "thumb": ("t.jpg", jpeg)}).status_code == 415

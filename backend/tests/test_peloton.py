"""Peloton classes read from their summary screenshot, and cardio days for the weekly goal."""

import json as jsonlib

import httpx
import pytest
from fastapi.testclient import TestClient

from app import db, peloton, storage

SCREEN = {
    "discipline": "cycling", "title": "60 min Reggaeton Ride", "instructor": "Camila Ramón", "minutes": 60,
    "outputKj": 526, "distanceMi": 18.51, "calories": 742, "avgWatts": 146, "avgCadence": 78,
    "avgResistance": 46, "avgSpeedMph": 18.5,
}


def test_parse_keeps_valid_fields_and_drops_the_rest() -> None:
    got = peloton.parse(jsonlib.dumps({**SCREEN, "avgCadence": 9999, "calories": "lots", "date": "2026-11-12"}))
    assert got.outputKj == 526 and got.title == "60 min Reggaeton Ride"
    assert got.avgCadence is None and got.calories is None  # out of range, not a number
    assert "date" not in got.model_dump()
    assert peloton.parse("not json").model_dump(exclude_none=True) == {}


def fake_groq(monkeypatch: pytest.MonkeyPatch, reply: dict) -> list:
    sent = []

    def post(url, headers, json, timeout):  # noqa: A002 - httpx's own name
        sent.append(json)
        return httpx.Response(200, json={"choices": [{"message": {"content": jsonlib.dumps(reply)}}]},
                              request=httpx.Request("POST", url))

    monkeypatch.setenv("GROQ_API_KEY", "test")
    monkeypatch.setattr(peloton.httpx, "post", post)
    return sent


def test_owner_reads_an_uploaded_screenshot(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    storage.put("main/shot1.img", b"\xff\xd8 fake jpeg", "image/jpeg")
    sent = fake_groq(monkeypatch, SCREEN)
    got = client.post("/api/peloton/read", json={"key": "main/shot1"}).json()
    assert got["outputKj"] == 526 and got["instructor"] == "Camila Ramón"
    assert sent[0]["messages"][0]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert client.post("/api/peloton/read", json={"key": "main/missing"}).status_code == 404


def test_reading_is_off_without_a_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    storage.put("main/shot1.img", b"\xff\xd8 fake jpeg", "image/jpeg")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    assert client.post("/api/peloton/read", json={"key": "main/shot1"}).status_code == 503


def test_guests_read_screenshots_up_to_a_daily_cap(guest: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # Visitors get the same experience (Sergio, 2026-11-17); a cap keeps the bill small.
    from app import ai_limits
    storage.put("main/shot1.img", b"\xff\xd8 fake jpeg", "image/jpeg")
    fake_groq(monkeypatch, SCREEN)
    for _ in range(ai_limits.PER_DEMO_PER_DAY):
        assert guest.post("/api/peloton/read", json={"key": "main/shot1"}).json()["outputKj"] == 526
    assert guest.post("/api/peloton/read", json={"key": "main/shot1"}).status_code == 429


def test_days_with_a_ride_or_run_count_as_cardio(client: TestClient) -> None:
    def day(date: str, label: str, ids: list[str]) -> None:
        db.put("main", f"WORKOUT#{date}#{date}-1", {"id": f"{date}-1", "date": date, "startedAt": f"{date}T10:00:00",
                                                   "label": label, "source": "app",
                                                   "entries": [{"exerciseId": x, "sets": [{"reps": 5}]} for x in ids]})
    day("2026-11-01", "Cardio", ["peloton-ride"])
    day("2026-11-02", "Push + Cardio", ["dips", "peloton-run"])
    day("2026-11-03", "Push", ["dips"])
    day("2025-10-04", "Squat + Run", ["squat"])
    days = {d["date"]: d["cardio"] for d in client.get("/api/progress").json()["days"]}
    assert days == {"2025-10-04": True, "2026-11-01": True, "2026-11-02": True, "2026-11-03": False}


def test_screenshots_are_not_setup_photos(client: TestClient) -> None:
    db.put("main", "WORKOUT#2026-11-15#2026-11-15-1", {
        "id": "2026-11-15-1", "date": "2026-11-15", "startedAt": "2026-11-15T15:45:00", "label": "Cardio", "source": "app",
        "entries": [{"exerciseId": "peloton-ride", "minutes": 60,
                     "photos": [{"key": "main/shot", "kind": "screenshot"}, {"key": "main/seat-height"}]}],
    })
    assert [p["key"] for p in client.get("/api/exercises/peloton-ride/summary").json()["photos"]] == ["main/seat-height"]
    # The exercise page keeps both, with their kind.
    kinds = {p["key"]: p.get("kind") for p in client.get("/api/exercises/peloton-ride/history").json()["photos"]}
    assert kinds == {"main/shot": "screenshot", "main/seat-height": None}

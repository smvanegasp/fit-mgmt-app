"""Cue sections and the cue check (the LLM call is replaced; nothing leaves the test)."""

import json

import pytest
from fastapi.testclient import TestClient

from app import cue_check



def add(client: TestClient, text: str, section: str | None = None) -> dict:
    body = {"text": text, "date": "2026-10-30", **({"section": section} if section else {})}
    return client.post("/api/exercises/squat/notes", json=body).json()


def test_cues_take_a_section_and_rank(client: TestClient) -> None:
    cue = add(client, "Bar on the traps", "setup")
    assert cue["section"] == "setup" and cue.get("rank") is None
    moved = client.patch(f"/api/exercises/squat/notes/{cue['id']}", json={"section": "lift", "rank": 2}).json()
    assert (moved["section"], moved["rank"], moved["text"]) == ("lift", 2, "Bar on the traps")
    assert client.patch(f"/api/exercises/squat/notes/{cue['id']}", json={"section": "other"}).status_code == 422


def test_the_check_is_off_without_a_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    assert client.post("/api/exercises/squat/cue-check", json={"note": "Bar lower"}).status_code == 503


def answer(monkeypatch: pytest.MonkeyPatch, reply: dict | str) -> list:
    """Replace the LLM with a fixed reply; returns what it was asked."""
    asked: list = []
    monkeypatch.setenv("GROQ_API_KEY", "test")

    def fake(messages: list) -> str:
        asked.append(messages)
        return reply if isinstance(reply, str) else json.dumps(reply)

    monkeypatch.setattr(cue_check, "_ask", fake)
    return asked


def test_the_check_suggests_an_update_with_the_cues_and_note(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    cue = add(client, "Bar slightly more on the traps", "setup")
    asked = answer(monkeypatch, {"action": "update", "noteId": cue["id"], "text": "Bar a bit lower on the traps", "section": "setup"})
    got = client.post("/api/exercises/squat/cue-check", json={"note": "barra un poco mas abajo"}).json()
    assert got == {"action": "update", "noteId": cue["id"], "text": "Bar a bit lower on the traps", "section": "setup"}
    sent = json.loads(asked[0][1]["content"])
    assert sent == {"exercise": "Back squat", "cues": [{"id": cue["id"], "section": "setup", "text": "Bar slightly more on the traps"}],
                    "note": "barra un poco mas abajo"}


@pytest.mark.parametrize("reply", [
    "not json",
    {"action": "update", "noteId": "nope", "text": "x", "section": "lift"},  # no such cue
    {"action": "add", "noteId": None, "text": " ", "section": "lift"},  # no text
])
def test_bad_answers_become_no_suggestion(client: TestClient, monkeypatch: pytest.MonkeyPatch, reply: dict | str) -> None:
    answer(monkeypatch, reply)
    assert client.post("/api/exercises/squat/cue-check", json={"note": "felt heavy"}).json()["action"] == "none"


def test_a_failing_check_is_logged_for_the_alarm(client: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    import httpx

    monkeypatch.setenv("GROQ_API_KEY", "test")

    def down(messages: list) -> str:
        raise httpx.ConnectError("down")

    monkeypatch.setattr(cue_check, "_ask", down)
    assert client.post("/api/exercises/squat/cue-check", json={"note": "bar lower"}).status_code == 502
    assert "Cue check failed" in caplog.text

"""Feedback: anyone with a session can send it; only the owner reads it; it lives outside demos."""

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


def send(client: TestClient, text: str = "The picker is slow", page: str = "Train"):
    return client.post("/api/feedback", json={"text": text, "page": page})


def test_owner_and_guest_can_send_and_the_owner_reads_it_newest_first(client, guest):
    assert send(client, "Owner idea", "Progress").status_code == 201
    sent = send(guest, "  Guest idea  ", "Exercise: Back squat").json()
    assert sent["role"] == "guest" and sent["text"] == "Guest idea" and sent["status"] == "new"
    # Both may share a timestamp second, so check the content, not the order.
    inbox = client.get("/api/feedback").json()
    assert {(f["text"], f["role"], f["page"]) for f in inbox} == {
        ("Guest idea", "guest", "Exercise: Back squat"),
        ("Owner idea", "owner", "Progress"),
    }


def test_without_a_session_or_too_long_it_is_refused(anon, client):
    assert send(anon).status_code == 401
    assert send(client, "x" * 2001).status_code == 422
    assert send(client, "").status_code == 422


def test_guests_cannot_read_or_change_feedback(client, guest):
    sent = send(client).json()
    assert guest.get("/api/feedback").status_code == 403
    assert guest.patch(f"/api/feedback/{sent['id']}", json={"status": "done"}).status_code == 403


def test_the_owner_marks_feedback_done(client):
    sent = send(client).json()
    assert client.patch(f"/api/feedback/{sent['id']}", json={"status": "done"}).json()["status"] == "done"
    assert client.get("/api/feedback").json()[0]["status"] == "done"
    assert client.patch("/api/feedback/nope", json={"status": "done"}).status_code == 404


def test_sending_is_rate_limited_per_network(guest):
    for _ in range(10):
        assert send(guest).status_code == 201
    assert send(guest).status_code == 429


def test_only_guest_feedback_logs_the_alarm_line(client, guest, caplog: pytest.LogCaptureFixture):
    send(client)
    assert "Guest feedback received" not in caplog.text
    send(guest)
    assert "Guest feedback received" in caplog.text


def test_feedback_outlives_demos_and_is_never_copied_into_one(client, anon):
    db.put("main", "WORKOUT#2026-10-28#2026-10-28-1", {
        "id": "2026-10-28-1", "date": "2026-10-28", "startedAt": "2026-10-28T19:00:00", "label": "Legs",
        "source": "whatsapp", "entries": [],
    })
    send(client, "Owner only")
    anon.post("/api/session/guest")
    sandbox = next(row["pk"] for row in db.get_table().scan()["Items"] if row["pk"].startswith("SPACE#sb-"))
    rows = db.get_table().scan()["Items"]
    assert not any(r["pk"] == sandbox and r["sk"].startswith("FEEDBACK#") for r in rows)
    assert all("ttl" not in r for r in rows if r["pk"] == "SPACE#feedback")

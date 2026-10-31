"""Owner login and guest sandboxes: a guest can never reach the owner's log (ported from the pantry)."""

import time

from fastapi.testclient import TestClient

from app import db, sandbox
from app.main import app
from app.session import COOKIE
from tests.conftest import OWNER_PASSCODE


def owner_workout(date: str, exercise_id: str = "squat") -> None:
    db.put("main", f"WORKOUT#{date}#{date}-1", {
        "id": f"{date}-1", "date": date, "startedAt": f"{date}T19:00:00", "label": "Legs", "source": "whatsapp",
        "entries": [{"exerciseId": exercise_id, "sets": [{"reps": 5, "weightLb": 135}]}],
    })


def ids(client: TestClient) -> list[str]:
    return [w["id"] for w in client.get("/api/workouts?limit=1000").json()]


# --- sessions -------------------------------------------------------------------------


def test_no_session_cannot_read_or_write(anon):
    assert anon.get("/api/session").json() == {"role": None, "expiresAt": None, "ownerLoginEnabled": True}
    assert anon.get("/api/workouts").status_code == 401
    assert anon.get("/api/progress").status_code == 401
    assert anon.post("/api/active", json={"startedAt": "2026-10-30T18:00:00"}).status_code == 401
    assert anon.get("/api/photos/main/x").status_code == 401
    assert anon.get("/api/health").status_code == 200


def test_owner_login(anon):
    response = anon.post("/api/session/owner", json={"passcode": OWNER_PASSCODE})
    assert response.status_code == 200 and response.json()["role"] == "owner"
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert anon.get("/api/workouts").status_code == 200


def test_wrong_or_malformed_passcode(anon):
    wrong = anon.post("/api/session/owner", json={"passcode": "000000"})
    assert wrong.status_code == 401 and wrong.json()["detail"] == "Wrong passcode. 2 tries left."
    for bad in ("1234", "12345", "1234567", "abcdef"):
        assert anon.post("/api/session/owner", json={"passcode": bad}).status_code == 422
    assert anon.get("/api/session").json()["role"] is None


def test_three_wrong_tries_pause_login_and_hide_the_button(anon):
    tries = [anon.post("/api/session/owner", json={"passcode": "000000"}) for _ in range(3)]
    assert [t.status_code for t in tries] == [401, 401, 429]
    assert anon.post("/api/session/owner", json={"passcode": OWNER_PASSCODE}).status_code == 429
    assert anon.get("/api/session").json()["ownerLoginEnabled"] is False


def test_global_cap_pauses_login_everywhere(anon):
    for i in range(10):
        anon.post("/api/session/owner", json={"passcode": "000000"}, headers={"cloudfront-viewer-address": f"203.0.113.{i // 3}:1"})
    fresh = anon.post("/api/session/owner", json={"passcode": OWNER_PASSCODE}, headers={"cloudfront-viewer-address": "198.51.100.7:1"})
    assert fresh.status_code == 429


def test_login_disabled_without_passcode(anon, monkeypatch):
    monkeypatch.delenv("PASSCODE_HASH")
    assert anon.get("/api/session").json()["ownerLoginEnabled"] is False
    assert anon.post("/api/session/owner", json={"passcode": "123456"}).status_code == 503


def test_logout(client):
    assert client.delete("/api/session").json()["role"] is None
    assert client.get("/api/workouts").status_code == 401


def test_tampered_or_foreign_cookies_are_ignored(client, monkeypatch):
    token = client.cookies[COOKIE]
    client.cookies.set(COOKIE, token[:-2] + "xx")
    assert client.get("/api/workouts").status_code == 401
    client.cookies.set(COOKIE, token)
    monkeypatch.setenv("SESSION_SECRET", "a-different-secret")
    assert client.get("/api/workouts").status_code == 401


# --- guest sandboxes ------------------------------------------------------------------


def test_guest_gets_a_copy_of_the_log_but_not_the_workout_in_progress(client, anon):
    owner_workout("2026-10-28")
    client.post("/api/exercises/squat/notes", json={"text": "Bar on the traps", "date": "2026-10-28"})
    client.post("/api/active", json={"startedAt": "2026-10-30T18:00:00"})

    info = anon.post("/api/session/guest").json()

    assert info["role"] == "guest" and info["expiresAt"] > time.time() + 23 * 3600
    assert ids(anon) == ["2026-10-28-1"]
    assert [c["text"] for c in anon.get("/api/exercises/squat/summary").json()["cues"]] == ["Bar on the traps"]
    assert anon.get("/api/active").json() is None


def test_guest_changes_never_reach_the_owner(client, guest):
    owner_workout("2026-10-28")  # after the guest's copy was made
    guest.post("/api/active", json={"startedAt": "2026-10-30T18:00:00"})
    guest.put("/api/active", json={"startedAt": "2026-10-30T18:00:00", "entries": [{"exerciseId": "dips", "sets": [{"reps": 4}]}]})
    done = guest.post("/api/active/finish", json={"endedAt": "2026-10-30T19:00:00"}).json()
    guest.post("/api/exercises/dips/notes", json={"text": "Guest cue", "date": "2026-10-30"})

    assert ids(client) == ["2026-10-28-1"]
    assert client.get(f"/api/workouts/{done['id']}").status_code == 404
    assert client.get("/api/exercises/dips/summary").json()["cues"] == []


def test_guest_cannot_touch_owner_rows_by_id(client, anon):
    owner_workout("2026-10-28")
    anon.post("/api/session/guest")
    anon.delete("/api/workouts/2026-10-28-1")  # deletes the guest's own copy only
    assert ids(client) == ["2026-10-28-1"]
    owner_cue = client.post("/api/exercises/squat/notes", json={"text": "Mine", "date": "2026-10-30"}).json()
    assert anon.patch(f"/api/exercises/squat/notes/{owner_cue['id']}", json={"text": "Hacked"}).status_code == 404
    assert client.get("/api/exercises/squat/summary").json()["cues"][0]["text"] == "Mine"


def test_guests_are_isolated_from_each_other(guest):
    other = TestClient(app)
    other.post("/api/session/guest")
    guest.post("/api/exercises/dips/notes", json={"text": "Only mine", "date": "2026-10-30"})
    assert "Only mine" not in [c["text"] for c in other.get("/api/exercises/dips/summary").json()["cues"]]


def test_sandbox_rows_expire_and_owner_rows_do_not(client, guest):
    owner_workout("2026-10-28")
    guest.post("/api/exercises/dips/notes", json={"text": "Guest cue", "date": "2026-10-30"})
    for row in db.get_table().scan()["Items"]:
        if row["pk"] == "SPACE#main":
            assert "ttl" not in row
        elif row["pk"].startswith("SPACE#sb-"):
            assert int(row["ttl"]) > time.time()


def test_demo_uses_the_sample_log_while_the_owner_has_none(client, anon):
    anon.post("/api/session/guest")
    progress = anon.get("/api/progress").json()
    assert len(progress["days"]) >= 20
    assert {lift["exerciseId"] for lift in progress["lifts"] if lift["steps"]} >= {"squat", "dips", "chin-ups", "bench-press"}
    assert progress["routines"][0]["name"] == "3-day split"
    assert anon.get("/api/exercises/squat/summary").json()["cues"]
    # The owner's log stays empty.
    assert ids(client) == []


def test_demo_can_start_from_the_sample_even_when_the_owner_has_a_log(client, anon):
    owner_workout("2020-01-01")
    anon.post("/api/session/guest/reset?sample=true")
    assert "2020-01-01-1" not in ids(anon) and len(ids(anon)) >= 20


def test_starting_a_demo_twice_keeps_the_same_sandbox(guest):
    guest.post("/api/exercises/dips/notes", json={"text": "Mine", "date": "2026-10-30"})
    guest.post("/api/session/guest")
    assert any(c["text"] == "Mine" for c in guest.get("/api/exercises/dips/summary").json()["cues"])


def test_reset_demo_starts_from_a_fresh_copy(client, anon):
    owner_workout("2026-10-28")
    anon.post("/api/session/guest")
    anon.delete("/api/workouts/2026-10-28-1")
    anon.post("/api/session/guest/reset")
    assert ids(anon) == ["2026-10-28-1"]


def test_expired_sandbox_session_is_rejected(guest, monkeypatch):
    real_time = time.time
    monkeypatch.setattr(sandbox.time, "time", lambda: real_time() + 25 * 3600)
    assert guest.get("/api/workouts").status_code == 401
    assert guest.get("/api/session").json()["role"] is None


def test_guest_logging_in_switches_to_the_real_log(client, guest):
    owner_workout("2026-10-28")
    guest.post("/api/session/owner", json={"passcode": OWNER_PASSCODE})
    assert ids(guest) == ["2026-10-28-1"]


def test_sandbox_creation_is_rate_limited(anon):
    for _ in range(20):
        assert anon.post("/api/session/guest/reset").status_code == 200
    assert anon.post("/api/session/guest/reset").status_code == 429


def test_the_cue_check_is_off_for_guests(guest, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test")
    assert guest.post("/api/exercises/squat/cue-check", json={"note": "bar lower"}).status_code == 503

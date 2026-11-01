"""The welcome page's public summary: no session needed, and nothing beyond days and targets."""

from app import db


def test_the_summary_needs_no_session_and_holds_only_days_and_targets(anon):
    db.put("main", "WORKOUT#2026-10-28#2026-10-28-1", {
        "id": "2026-10-28-1", "date": "2026-10-28", "startedAt": "2026-10-28T19:00:00", "label": "Squat + Climb",
        "source": "whatsapp", "notes": ["private note"],
        "entries": [{"exerciseId": "squat", "sets": [{"reps": 4, "weightLb": 180}] * 5, "notes": ["private entry note"]}],
    })
    db.put("main", "NOTE#squat#2026-10-28#n1", {"id": "n1", "exerciseId": "squat", "text": "Private cue",
                                                 "date": "2026-10-28", "sessions": 2, "source": "whatsapp"})
    body = anon.get("/api/public/summary")
    assert body.status_code == 200
    data = body.json()
    assert [(d["date"], d["type"]) for d in data["days"]] == [("2026-10-28", "Legs")]
    assert all(set(d) == {"date", "type"} for d in data["days"])
    assert [(x["exerciseId"], x["scheme"]["sets"], x["scheme"]["weightLb"]) for x in data["lifts"]] == [("squat", [4] * 5, 180)]
    assert "private" not in body.text.lower()


def test_an_empty_log_gives_an_empty_summary(anon):
    assert anon.get("/api/public/summary").json() == {"days": [], "lifts": []}

from app import db


def test_put_get_query_delete_round_trip() -> None:
    db.put("main", "WORKOUT#2026-10-28#a", {"day": "Push", "sets": [{"weightLb": 22.5, "reps": 10}]})
    db.put("main", "WORKOUT#2026-10-29#b", {"day": "Pull", "sets": [{"weightLb": 135, "reps": 5}]})
    db.put("other", "WORKOUT#2026-10-29#c", {"day": "Legs", "sets": []})

    row = db.get("main", "WORKOUT#2026-10-28#a")
    # Fractional weights come back as floats, whole numbers as ints; keys are dropped.
    assert row == {"day": "Push", "sets": [{"weightLb": 22.5, "reps": 10}]}

    # Spaces never see each other's rows.
    assert [r["day"] for r in db.query("main", "WORKOUT#")] == ["Push", "Pull"]

    db.delete("main", "WORKOUT#2026-10-28#a")
    assert db.get("main", "WORKOUT#2026-10-28#a") is None

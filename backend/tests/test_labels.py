"""Session names and day types (since 2026-10-30: Push, Legs, Pull, Cardio)."""

from app.labels import day_type, session_label

NAMES = {"peloton-run": "Peloton run"}


def test_new_sessions_use_todays_day_types() -> None:
    assert session_label([("squat", 5), ("deadlift", 3)], NAMES) == "Legs"
    assert session_label([("front-raise", 4), ("high-pull-ups", 3), ("bouldering", 0)], NAMES) == "Pull + Climb"
    assert session_label([("peloton-run", 0)], NAMES) == "Cardio"
    assert session_label([("walk", 0)], NAMES) == "Cardio"


def test_imported_sessions_keep_their_old_names() -> None:
    assert session_label([("deadlift", 4), ("squat", 3)], NAMES, legs_day=False) == "Deadlift"
    assert session_label([("front-raise", 4), ("pull-ups", 3)], NAMES, legs_day=False) == "Front lever"
    assert session_label([("treadmill", 0)], NAMES, legs_day=False) == "Run"


def test_old_day_names_map_to_todays_types() -> None:
    assert [day_type(x) for x in ("Squat", "Deadlift + Climb", "Front lever", "Climb", "Run", "Push")] == [
        "Legs", "Legs", "Pull", "Pull", "Cardio", "Push"]

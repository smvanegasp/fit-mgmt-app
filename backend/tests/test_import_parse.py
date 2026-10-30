"""WhatsApp import: chat reading and parsing, with made-up messages in the export's format."""

from app.importer.chat import parse_chat
from app.importer.parse import find_exercise, parse_climb, parse_dropset, parse_messages, parse_sets

LRM, NNBSP = "‎", " "


def chat(*lines: str) -> str:
    """Build export text: ("9/5/25 5:59:01 PM", "text") -> "[9/5/25, 5:59:01 PM] Me: text"."""
    out = []
    for line in lines:
        stamp, text = line.split(" | ", 1)
        date, time, ampm = stamp.split(" ")
        out.append(f"[{date}, {time}{NNBSP}{ampm}] Me: {text}")
    return "\n".join(out)


def parse(*lines: str, corrections: dict | None = None) -> dict:
    return parse_messages(parse_chat(chat(*lines)), corrections)


def only_entry(result: dict, index: int = 0) -> dict:
    return result["workouts"][0]["entries"][index]


# ------------------------------------------------------------------ chat


def test_chat_reads_multiline_messages_attachments_and_edits() -> None:
    text = (
        f"[1/7/26, 1:04:56{NNBSP}PM] Me: 2 mph 2 min\n3 mph 2 min\n"
        f"{LRM}[1/7/26, 1:08:42{NNBSP}PM] Me: {LRM}<attached: 00000253-PHOTO-2026-01-07-13-08-42.jpg>\n"
        f"[1/9/26, 10:49:07{NNBSP}AM] Me: Dips. 3x4. 115 lbs {LRM}<This message was edited>"
    )
    messages = parse_chat(text)
    assert [m.text for m in messages] == ["2 mph 2 min\n3 mph 2 min", "", "Dips. 3x4. 115 lbs"]
    assert messages[1].attachment == "00000253-PHOTO-2026-01-07-13-08-42.jpg"
    assert messages[0].key == "2026-01-07 13:04:56"


# ------------------------------------------------------------------ pieces


def test_exercise_names_longest_alias_wins() -> None:
    assert find_exercise("Wide bar dips. 3x8") == "bar-dips"
    assert find_exercise("Dios 1x7 45 lbs") == "dips"
    assert find_exercise("Press banca mancuerna. 1x10") == "dumbbell-bench-press"
    assert find_exercise("Chin up’s. 3x3 40 kg") == "chin-ups"
    assert find_exercise("Close chin ups 1x8") == "close-chin-ups"
    assert find_exercise("5x5 Squats. 180 lbs smith machine") == "smith-squat"
    assert find_exercise("Pistol squats 3x9 each leg") == "pistol-squat"
    assert find_exercise("Leg drift always.") is None


def test_sets_weights_and_units() -> None:
    assert parse_sets("3x5. 25 lbs each", "overhead-press") == [{"reps": 5, "weightLb": 25, "each": True}] * 3
    assert parse_sets("Chin ups. 3x3. 32 kg.", "chin-ups") == [{"reps": 3, "weightLb": 70.5}] * 3
    assert parse_sets("1x8 1x7 1x4 25 lbs", "overhead-press") == [
        {"reps": 8, "weightLb": 25}, {"reps": 7, "weightLb": 25}, {"reps": 4, "weightLb": 25}]
    assert parse_sets("Squats 13x100 lbs", "squat") == [{"reps": 13, "weightLb": 100}]
    assert parse_sets("Advanced tuck. 2x7 sec hold.", "advanced-tuck-hold") == [{"seconds": 7}] * 2
    assert parse_sets("Single hand rows 12.5 lbs. + 5 lbs 1x8", "single-arm-row") == [{"reps": 8, "weightLb": 17.5}]
    # Body-weight exercises never get a weight.
    assert parse_sets("Wide pull ups 1x10 45 lbs", "wide-pull-ups") == [{"reps": 10}]
    assert parse_sets("2x(3 pull 3 muscle 3 dips 3 pull)", "muscle-up-complex") == [
        {"reps": 12, "detail": "3 pull + 3 muscle + 3 dip + 3 pull"}] * 2


def test_dropset_ladders_in_either_order() -> None:
    sets, targets = parse_dropset("90-70-45-25-0\n4 - 3 - 3 - 3 - 4")
    assert [(s["weightLb"], s["reps"]) for s in sets] == [(90, 4), (70, 3), (45, 3), (25, 3), (0, 4)]
    assert all(s["drop"] for s in sets) and targets == []
    sets, _ = parse_dropset("Dropset\n4-2-4-4-6\n90-70-45-25-0")
    assert [s["reps"] for s in sets] == [4, 2, 4, 4, 6]
    sets, targets = parse_dropset("4-4-5-8 (5-5-5-7 70 lbs-45 lbs- 25 lbs - 0 lbs)")
    assert [(s["weightLb"], s["reps"]) for s in sets] == [(70, 4), (45, 4), (25, 5), (0, 8)]
    assert targets == ["5-5-5-7"]
    # A skipped ladder (all zeros) adds nothing.
    assert parse_dropset("90-70-45-25-0\n0-0-0-0-0") == ([], [])


def test_climbing_problems() -> None:
    assert parse_climb("V1. 1 negro\nV3 morado nuevo fail 3") == [
        {"grade": "V1", "color": "black", "result": "sent", "count": 1, "note": "1 negro"},
        {"grade": "V3", "color": "purple", "result": "attempted", "attempts": 3, "note": "morado nuevo fail 3"},
    ]


# ------------------------------------------------------------------ whole messages


def test_a_session_with_targets_notes_and_follow_ups() -> None:
    result = parse(
        "11/1/25 5:41:59 PM | 5x4 Squats. 160 lbs + bar (antes 150 5x5)",
        "11/1/25 6:01:03 PM | Squats. 2x8. 130 lbs + bar (antes 2x8 130 lbs 2 veces)",
        "11/1/25 6:01:10 PM | 1x6 last again",
        "11/1/25 6:08:50 PM | Pistol squats 3x8 each leg",
        "11/1/25 6:09:30 PM | Respira antes de sacar la barra",
    )
    workout = result["workouts"][0]
    assert workout["id"] == "2025-11-01-1"
    assert workout["label"] == "Squat"
    # 20 min warm-up + 40 min first exercise before the first message.
    assert workout["startedAt"] == "2025-11-01T16:41:59" and workout["endedAt"] == "2025-11-01T18:09:30"
    assert workout["durationMin"] == 88
    squat, pistol = workout["entries"]
    assert squat["exerciseId"] == "squat"
    # The follow-up "1x6 last again" keeps the last weight.
    assert [(s["reps"], s["weightLb"]) for s in squat["sets"]] == [(4, 160)] * 5 + [(8, 130)] * 2 + [(6, 130)]
    assert [t["text"] for t in squat["targets"]] == ["antes 150 5x5", "antes 2x8 130 lbs 2 veces"]
    assert squat["targets"][1]["times"] == 2
    # A note sent right after an exercise belongs to it.
    assert pistol["notes"] == ["Respira antes de sacar la barra"]


def test_target_without_opening_parenthesis() -> None:
    result = parse("2/7/26 12:21:06 PM | Deadlift regular 5x5 180 lbs. +barra. 4x5 180 lbs 3 veces). Look forward")
    entry = only_entry(result)
    assert len(entry["sets"]) == 5
    assert entry["targets"] == [{"text": "4x5 180 lbs 3 veces", "times": 3}]
    assert entry["notes"] == ["Look forward"]


def test_dips_with_dropset_and_cues() -> None:
    result = parse(
        "6/1/26 6:57:54 PM | Dips. 3x4 1x3 115 lbs (3x4 1x3 1 vez) setup en 7.\n\n90-70-45-25-0\n4-3-3-3-7"
    )
    entry = only_entry(result)
    assert [s.get("drop", False) for s in entry["sets"]] == [False] * 4 + [True] * 5
    assert entry["sets"][0] == {"reps": 4, "weightLb": 115}
    assert "setup en 7" in entry["notes"]


def test_climbing_runs_and_lifting_in_one_message() -> None:
    result = parse(
        "7/11/26 2:43:32 PM | Chin ups. 4x3 90 lbs.",
        "7/11/26 3:56:11 PM | V3. 2. (Blanco supino)\n\nPull ups wide. 3x10.",
        "7/12/26 1:04:56 PM | 2 mph 2 min\n6 mph 18 min",
        "7/12/26 1:05:41 PM | 3.13 mi =5.0372 km",
    )
    climb_day, run_day = result["workouts"]
    assert climb_day["label"] == "Pull + Climb"
    assert [e["exerciseId"] for e in climb_day["entries"]] == ["chin-ups", "bouldering", "wide-pull-ups"]
    assert run_day["entries"] == [{"exerciseId": "treadmill", "segments": [
        {"mph": 2, "minutes": 2}, {"mph": 6, "minutes": 18}], "distanceMi": 3.13}]


def test_one_workout_per_day_and_skip_non_training() -> None:
    result = parse(
        "9/20/26 4:24:44 PM | Front raise. 3x6.",
        "9/20/26 7:50:40 PM | Left arm. 3x10 Back pull. 32.5 lbs.",
        "9/21/26 9:00:00 AM | https://example.com/something",
        "9/22/26 9:00:00 AM | - Buy groceries\n- Call the bank",
    )
    assert [w["id"] for w in result["workouts"]] == ["2026-09-20-1"]
    assert [e["exerciseId"] for e in result["workouts"][0]["entries"]] == ["front-raise", "back-pull"]
    # Two sessions that day: each counts an hour before its message, not the hours in between.
    assert result["workouts"][0]["durationMin"] == 120


def test_photos_attach_to_the_nearest_exercise_and_duplicates_are_dropped() -> None:
    result = parse(
        "11/12/25 7:46:01 PM | Press banca con seguridad 70 lbs 2x4",
        f"11/12/25 7:46:05 PM | {LRM}<attached: 00000143-PHOTO-2025-11-12-19-46-05.jpg>",
        f"11/12/25 7:46:06 PM | {LRM}<attached: 00000144-PHOTO-2025-11-12-19-46-06.jpg>",
    )
    assert only_entry(result)["photos"] == [{"file": "00000143-PHOTO-2025-11-12-19-46-05.jpg"}]


def test_corrections_rewrite_drop_and_replace_messages() -> None:
    result = parse(
        "9/1/25 1:00:00 PM | Before training started",
        "9/13/25 11:27:01 AM | Bar dips. 3x5",
        "9/13/25 11:29:23 AM | Last hice 4",
        "9/14/25 1:00:00 PM | 1 to 8 to 1. Wide pull ups. 72 reps.",
        corrections={
            "start": "2025-09-05",
            "messages": {
                "2025-09-13 11:27:01": "Bar dips. 2x5. 1x4",
                "2025-09-13 11:29:23": None,
                "2025-09-14 13:00:00": {"entries": [{"exerciseId": "wide-pull-ups", "sets": [{"reps": 72}]}]},
            },
        },
    )
    first, second = result["workouts"]
    assert [s["reps"] for s in first["entries"][0]["sets"]] == [5, 5, 4]
    assert second["entries"] == [{"exerciseId": "wide-pull-ups", "sets": [{"reps": 72}]}]


def test_text_fixes_standardize_typos_before_parsing() -> None:
    result = parse(
        "12/3/25 2:11:03 PM | Dios 1x4 90 kbs. Muñecos fuertes",
        corrections={"textFixes": [["Muñecos fuertes", "Muñecas fuertes"]]},
    )
    entry = only_entry(result)
    assert entry["exerciseId"] == "dips" and entry["sets"] == [{"reps": 4, "weightLb": 90}]
    assert entry["notes"] == ["Muñecas fuertes"]


def test_technique_log_keeps_repeated_cues_and_picked_ones() -> None:
    result = parse(
        "1/1/26 1:00:00 PM | RDL. 4x8. 150 lbs + barra. First rep cuenta",
        "1/8/26 1:00:00 PM | RDL. 4x8. 150 lbs + barra. First rep cuenta. Pegadita a la pantorrilla",
        corrections={"technique": {"rdl": ["Pegadita a la pantorrilla"]}},
    )
    assert [(n["text"], n["date"], n["lastSeen"], n["sessions"]) for n in result["notes"]] == [
        ("First rep cuenta", "2026-01-01", "2026-01-08", 2),
        ("Pegadita a la pantorrilla", "2026-01-08", "2026-01-08", 1),
    ]


def test_a_cue_that_grows_keeps_only_its_longest_version() -> None:
    result = parse(
        "4/23/26 6:25:19 PM | Deadlift regular 5x3 185 lbs. Fuerza con confianza.",
        "5/6/26 4:44:02 PM | Deadlift regular 3x5 185 lbs. Fuerza con confianza.",
        "6/12/26 6:48:27 PM | Deadlift regular 3x5 185 lbs. Fuerza con confianza y aprieta el cuerpo.",
        "6/23/26 7:16:29 PM | Deadlift regular 4x5 185 lbs. Fuerza con confianza y aprieta el cuerpo.",
    )
    assert [(n["text"], n["date"], n["lastSeen"]) for n in result["notes"]] == [
        ("Fuerza con confianza y aprieta el cuerpo", "2026-04-23", "2026-06-23")]


def test_body_weight() -> None:
    result = parse(
        "10/25/25 12:38:10 PM | 5x5 Squats. 150 lbs + bar",
        "10/25/25 1:17:16 PM | MY WEIGHT: 67.8 kg",
    )
    assert result["body"] == [{"date": "2025-10-25", "weightLb": 149.5, "raw": "67.8 kg"}]
    assert result["workouts"][0]["notes"] == []

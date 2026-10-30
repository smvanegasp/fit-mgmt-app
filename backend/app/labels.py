"""Short session names ("Push", "Legs + Climb", "Cardio") from what was trained.

Since 2026-10-30 squats and deadlifts share one Legs day (heavy squat + lighter deadlift, then
heavy deadlift + light squats). Imported sessions from before keep their old names (Squat,
Deadlift); for day types and the rotation those count as Legs (DAY_TYPE).
"""

SQUAT = {"squat", "smith-squat", "pistol-squat"}
HINGE = {"deadlift", "rdl", "reverse-leg-curl"}
FRONT_LEVER = {"front-raise", "full-front-raise", "advanced-tuck-hold", "half-tuck-front-lever-raise", "high-pull-ups"}
GROUPS = {
    "Push": {"dips", "bench-press", "smith-bench-press", "dumbbell-bench-press", "overhead-press", "bar-dips"},
    "Legs": SQUAT | HINGE,
    "Pull": {"chin-ups", "pull-ups", "muscle-up-complex", "wide-pull-ups", "close-pull-ups", "french-chin-ups"} | FRONT_LEVER,
}
CARDIO = {"treadmill", "peloton-run", "walk"}


# Old day names and the day type they belong to now (2026-10-30: front lever and climbing are pull
# days; runs are cardio).
DAY_TYPE = {"Squat": "Legs", "Deadlift": "Legs", "Front lever": "Pull", "Climb": "Pull", "Run": "Cardio"}


def day_type(label: str) -> str:
    """The kind of day a session was: "Squat + Climb" -> "Legs"."""
    main = label.split(" + ")[0]
    return DAY_TYPE.get(main, main)


def session_label(entries: list[tuple[str, int]], names: dict[str, str], legs_day: bool = True) -> str:
    """entries: (exerciseId, number of sets) in order. The main lifting group (most sets, ties to
    the first logged) plus " + Climb" / " + Run"; otherwise the first exercise's name.
    legs_day=False keeps the old Squat / Deadlift names (the WhatsApp import)."""
    groups = GROUPS if legs_day else {
        "Push": GROUPS["Push"], "Squat": SQUAT, "Deadlift": HINGE, "Pull": GROUPS["Pull"] - FRONT_LEVER,
        "Front lever": FRONT_LEVER | {"l-sit-tuck-planche"},
    }
    parts: list[str] = []
    sets_per_group: dict[str, int] = {}
    for exercise_id, sets in entries:
        group = next((g for g, ids in groups.items() if exercise_id in ids), None)
        if group:
            sets_per_group[group] = sets_per_group.get(group, 0) + sets
    if sets_per_group:
        parts.append(max(sets_per_group, key=lambda g: sets_per_group[g]))
    ids = [exercise_id for exercise_id, _ in entries]
    if "bouldering" in ids:
        parts.append("Climb")
    if CARDIO & set(ids):
        parts.append("Cardio" if legs_day else "Run")
    if not parts and ids:
        parts.append(names.get(ids[0], "Workout"))
    return " + ".join(parts) or "Workout"

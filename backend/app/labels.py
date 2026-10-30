"""Short session names ("Push", "Squat + Climb") from what was trained."""

GROUPS = {
    "Push": {"dips", "bench-press", "smith-bench-press", "dumbbell-bench-press", "overhead-press", "bar-dips"},
    "Squat": {"squat", "smith-squat", "pistol-squat"},
    "Deadlift": {"deadlift", "rdl", "reverse-leg-curl"},
    "Pull": {"chin-ups", "pull-ups", "muscle-up-complex", "wide-pull-ups", "close-pull-ups", "french-chin-ups"},
    "Front lever": {"front-raise", "full-front-raise", "advanced-tuck-hold", "half-tuck-front-lever-raise",
                    "l-sit-tuck-planche", "high-pull-ups"},
}


def session_label(entries: list[tuple[str, int]], names: dict[str, str]) -> str:
    """entries: (exerciseId, number of sets) in order. The main lifting group (most sets, ties to
    the first logged) plus " + Climb" / " + Run"; otherwise the first exercise's name."""
    parts: list[str] = []
    sets_per_group: dict[str, int] = {}
    for exercise_id, sets in entries:
        group = next((g for g, ids in GROUPS.items() if exercise_id in ids), None)
        if group:
            sets_per_group[group] = sets_per_group.get(group, 0) + sets
    if sets_per_group:
        parts.append(max(sets_per_group, key=lambda g: sets_per_group[g]))
    ids = [exercise_id for exercise_id, _ in entries]
    if "bouldering" in ids:
        parts.append("Climb")
    if "treadmill" in ids:
        parts.append("Run")
    if not parts and ids:
        parts.append(names.get(ids[0], "Workout"))
    return " + ".join(parts) or "Workout"

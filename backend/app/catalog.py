"""The built-in exercise catalog: English names, plus the other ways an exercise gets written
(Spanish, shorthand, common typos) so the WhatsApp import and the search box both find it.

Aliases are matched against normalized text (lowercase, no accents, single spaces); the longest
alias that appears wins, so "wide bar dips" beats "dips" and "close chin ups" beats "chin ups".
"""

from dataclasses import dataclass, field
from typing import Literal

Group = Literal["push", "pull", "legs", "posterior", "core", "skill", "cardio", "climbing"]
# How a set's weight is read:
#   barbell   - the logged number is plates; the bar (barLb) is added for totals
#   dumbbell  - weight per hand when "each" is written
#   machine   - the stack or plate number as written
#   added     - weight added to body weight (belt, vest); 0 means body weight only
#   bodyweight - no weight
#   none      - not a set-based exercise (runs, climbing)
Load = Literal["barbell", "dumbbell", "machine", "added", "bodyweight", "none"]
Measure = Literal["reps", "seconds", "run", "climb"]


@dataclass(frozen=True)
class CatalogExercise:
    id: str
    name: str
    group: Group
    load: Load
    measure: Measure = "reps"
    bar_lb: float = 0
    aliases: tuple[str, ...] = field(default_factory=tuple)


BAR = 45.0

EXERCISES: tuple[CatalogExercise, ...] = (
    # Push
    CatalogExercise("dips", "Weighted dips", "push", "added",
                    aliases=("dips", "dios", "weighted dips", "fondos")),
    CatalogExercise("bar-dips", "Bar dips", "push", "bodyweight",
                    aliases=("bar dips", "wide bar dips")),
    CatalogExercise("bench-press", "Bench press", "push", "barbell", bar_lb=BAR,
                    aliases=("bench press", "press banca", "press baca", "press banca con seguridad")),
    CatalogExercise("smith-bench-press", "Smith machine bench press", "push", "barbell", bar_lb=BAR,
                    aliases=("press banca smith machine", "press banca. smith machine", "smith bench")),
    CatalogExercise("dumbbell-bench-press", "Dumbbell bench press", "push", "dumbbell",
                    aliases=("press banca mancuerna", "press banca dumbbells", "dumbbell bench press")),
    CatalogExercise("incline-bench-press", "Incline dumbbell press", "push", "dumbbell",
                    aliases=("press inclinado banca", "press inclinado", "incline press")),
    CatalogExercise("overhead-press", "Dumbbell overhead press", "push", "dumbbell",
                    aliases=("press militar", "press mimate", "military press", "overhead press")),
    CatalogExercise("skull-crusher", "Narrow skull crusher", "push", "barbell",
                    aliases=("skull crusher", "narrow skull crusher")),
    CatalogExercise("triceps-extension", "Single-arm triceps extension", "push", "machine",
                    aliases=("triceps extension", "left arm triceps")),
    CatalogExercise("planche-push-ups", "Planche push-ups", "push", "bodyweight",
                    aliases=("planche push ups",)),
    CatalogExercise("push-ups", "Wide push-ups", "push", "bodyweight",
                    aliases=("push ups", "wide push ups")),
    # Pull
    CatalogExercise("chin-ups", "Weighted chin-ups", "pull", "added",
                    aliases=("chin ups", "chin up s", "chin up", "weighted chin ups")),
    CatalogExercise("french-chin-ups", "French chin-ups", "pull", "added",
                    aliases=("french chin ups",)),
    CatalogExercise("close-chin-ups", "Close-grip chin-ups", "pull", "bodyweight",
                    aliases=("close chin ups", "close ups")),
    CatalogExercise("pull-ups", "Weighted pull-ups", "pull", "added",
                    aliases=("pull ups", "pulls ups", "pull up", "dominadas")),
    CatalogExercise("wide-pull-ups", "Wide pull-ups", "pull", "bodyweight",
                    aliases=("wide pull ups", "pull ups wide")),
    CatalogExercise("close-pull-ups", "Close-grip pull-ups", "pull", "bodyweight",
                    aliases=("close pull ups", "narrow pull ups")),
    CatalogExercise("high-pull-ups", "High pull-ups (to chest)", "pull", "bodyweight",
                    aliases=("high pull ups above chest", "high pull up above chest", "high pull ups")),
    CatalogExercise("muscle-up-complex", "Pull-up / muscle-up / dip complex", "pull", "bodyweight",
                    aliases=("muscle up dip", "pull muscle", "muscle up intercaladas", "pull up muscle up",
                             "muscle up")),
    CatalogExercise("cable-row", "Seated cable row", "pull", "machine",
                    aliases=("cable row", "cable rows", "row. mag", "row mag")),
    CatalogExercise("single-arm-row", "Single-arm cable row", "pull", "machine",
                    aliases=("single hand rows", "single hand row", "row single hand", "roe single hand",
                             "cable rows each")),
    CatalogExercise("back-pull", "Single-arm back pull", "pull", "machine",
                    aliases=("back pull",)),
    # Front lever (pull days)
    CatalogExercise("half-tuck-front-lever-raise", "Half-tuck front lever raise", "pull", "bodyweight",
                    aliases=("half tuck front lever raise",)),
    CatalogExercise("front-raise", "Front lever raise", "pull", "bodyweight",
                    aliases=("front raise",)),
    CatalogExercise("full-front-raise", "Full front lever raise", "pull", "bodyweight",
                    aliases=("full front raise",)),
    CatalogExercise("advanced-tuck-hold", "Advanced tuck front lever hold", "pull", "bodyweight",
                    measure="seconds", aliases=("advanced tuck",)),
    CatalogExercise("l-sit-tuck-planche", "L-sit to tuck planche", "core", "bodyweight",
                    aliases=("l sit to tuck planche",)),
    # Legs
    CatalogExercise("squat", "Back squat", "legs", "barbell", bar_lb=BAR,
                    aliases=("squats", "squat", "sentadilla", "sentadillas")),
    CatalogExercise("smith-squat", "Smith machine squat", "legs", "barbell", bar_lb=BAR,
                    aliases=("squats smith", "squats simitg", "smith machine")),
    CatalogExercise("pistol-squat", "Pistol squat", "legs", "dumbbell",
                    aliases=("pistol squat", "pistol squats")),
    CatalogExercise("lunges", "Walking lunges", "legs", "bodyweight",
                    aliases=("lunges",)),
    CatalogExercise("calf-raises", "Single-leg calf raises", "legs", "dumbbell",
                    aliases=("calves", "calve raises", "calves raises", "clave raises", "calf raises")),
    # Hinge (legs days)
    CatalogExercise("deadlift", "Deadlift", "legs", "barbell", bar_lb=BAR,
                    aliases=("deadlift", "deadlift regular", "peso muerto")),
    CatalogExercise("rdl", "Romanian deadlift", "legs", "barbell", bar_lb=BAR,
                    aliases=("rdl", "romanian deadlift")),
    CatalogExercise("reverse-leg-curl", "Leg curl", "legs", "machine",
                    aliases=("reverse leg curl", "leg curl")),
    CatalogExercise("back-raise", "Back extension", "legs", "bodyweight",
                    aliases=("back raise",)),
    # Core
    CatalogExercise("leg-raises", "Hanging leg raises", "core", "bodyweight",
                    aliases=("leg raises",)),
    CatalogExercise("knee-raises", "Hanging knee raises", "core", "bodyweight",
                    aliases=("knee raises",)),
    # Cardio (once a week from 2026-10-30: a Peloton run or a walk)
    CatalogExercise("peloton-run", "Peloton run", "cardio", "none", measure="run",
                    aliases=("peloton", "peloton run", "run")),
    CatalogExercise("walk", "Walk", "cardio", "none", measure="run",
                    aliases=("walk", "walking", "caminata")),
    CatalogExercise("treadmill", "Treadmill run", "cardio", "none", measure="run",
                    aliases=("treadmill", "treadmill run")),
    # Climbing counts as pull
    CatalogExercise("bouldering", "Bouldering", "climbing", "none", measure="climb",
                    aliases=("boulders", "bouldering", "climb")),
)

BY_ID = {e.id: e for e in EXERCISES}

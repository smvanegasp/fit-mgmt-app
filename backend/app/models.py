"""Request and response shapes. Stored rows use the same field names (see AGENTS.md data model);
optional fields left empty are not stored."""

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.catalog import Group, Load, Measure

LOCAL_TIME = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$")


def _local_time(value: str | None) -> str | None:
    """Times are the phone's local time without a zone ("2026-10-29T13:44:06"), like the import."""
    if value is not None and not LOCAL_TIME.match(value):
        raise ValueError("Use local time like 2026-10-29T13:44:06")
    return value


class SetData(BaseModel):
    reps: float | None = Field(None, ge=0, le=1000)
    weightLb: float | None = Field(None, ge=0, le=2000)
    each: bool | None = None
    seconds: int | None = Field(None, ge=0, le=36_000)
    drop: bool | None = None
    detail: str | None = Field(None, max_length=200)


class Problem(BaseModel):
    """A boulder tried: grade, hold color, sent (count) or attempted (attempts)."""

    grade: str = Field(pattern=r"^V\d{1,2}$")
    color: str | None = Field(None, max_length=30)
    result: Literal["sent", "attempted"] = "sent"
    count: int | None = Field(None, ge=1, le=100)
    attempts: int | None = Field(None, ge=1, le=100)
    note: str | None = Field(None, max_length=300)


class Segment(BaseModel):
    mph: float = Field(ge=0, le=30)
    minutes: float = Field(ge=0, le=600)


class Target(BaseModel):
    text: str = Field(max_length=200)
    times: int | None = None
    kind: str | None = None


class Photo(BaseModel):
    key: str = Field(max_length=120)
    caption: str | None = Field(None, max_length=300)


class Entry(BaseModel):
    exerciseId: str = Field(max_length=80)
    sets: list[SetData] = Field(default_factory=list, max_length=100)
    targets: list[Target] = Field(default_factory=list, max_length=10)
    notes: list[str] = Field(default_factory=list, max_length=20)
    photos: list[Photo] = Field(default_factory=list, max_length=10)
    problems: list[Problem] = Field(default_factory=list, max_length=60)
    segments: list[Segment] = Field(default_factory=list, max_length=60)
    distanceMi: float | None = Field(None, ge=0, le=200)
    minutes: float | None = Field(None, ge=0, le=1000)

    @field_validator("notes")
    @classmethod
    def _short_notes(cls, notes: list[str]) -> list[str]:
        if any(len(n) > 1000 for n in notes):
            raise ValueError("Notes are limited to 1000 characters")
        return notes


class Lap(BaseModel):
    """A stopwatch lap: when it ended and what it was ("Set 2 · Weighted dips"). Logging a set
    ends a lap, so laps are the rest and work times between sets."""

    at: str
    label: str | None = Field(None, max_length=120)

    @field_validator("at")
    @classmethod
    def _time(cls, value: str) -> str:
        return _local_time(value) or value


class WorkoutBody(BaseModel):
    """What the editor sends, for the workout in progress and for saved workouts."""

    startedAt: str
    endedAt: str | None = None
    label: str | None = Field(None, max_length=80)
    # The day type chosen at the start ("Squat"); suggests the usual exercises.
    plan: str | None = Field(None, max_length=40)
    laps: list[Lap] = Field(default_factory=list, max_length=500)
    notes: list[str] = Field(default_factory=list, max_length=20)
    photos: list[Photo] = Field(default_factory=list, max_length=20)
    entries: list[Entry] = Field(default_factory=list, max_length=60)

    @field_validator("startedAt", "endedAt")
    @classmethod
    def _times(cls, value: str | None) -> str | None:
        return _local_time(value)


class Workout(WorkoutBody):
    id: str
    date: str
    label: str
    durationEstimated: bool = False
    # Minutes of training when the day had separate sessions (a midday and an evening one), so
    # the hours in between don't count. Absent: endedAt - startedAt.
    durationMin: float | None = None
    source: Literal["whatsapp", "app"] = "app"


class FinishBody(BaseModel):
    endedAt: str

    @field_validator("endedAt")
    @classmethod
    def _time(cls, value: str) -> str:
        return _local_time(value) or value


class Exercise(BaseModel):
    id: str
    name: str
    group: Group
    load: Load
    measure: Measure = "reps"
    barLb: float = 0
    aliases: list[str] = Field(default_factory=list)
    source: Literal["catalog", "app"] = "catalog"
    lastDone: str | None = None
    timesDone: int = 0
    # Merged into another exercise (its sessions and cues moved there): kept for old ids, not listed.
    hidden: bool = False
    mergedInto: str | None = None


class ExerciseUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    group: Group | None = None


class MergeBody(BaseModel):
    into: str = Field(max_length=80)


class ExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    group: Group = "push"
    load: Load = "machine"
    measure: Measure = "reps"


class Note(BaseModel):
    id: str
    exerciseId: str
    text: str
    date: str
    lastSeen: str | None = None
    sessions: int = 1
    hidden: bool = False
    source: Literal["whatsapp", "app"] = "app"
    # What Sergio wrote, when the text shown is a translation.
    original: str | None = None


class NoteCreate(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class NoteUpdate(BaseModel):
    text: str | None = Field(None, min_length=1, max_length=300)
    hidden: bool | None = None


class Scheme(BaseModel):
    """A target: the working sets at the session's top weight, e.g. 5x4 @ 180 or 3x4 + 1x3 @ 90.
    `sets` holds the reps (or seconds) of each set; reaching it means as many total reps at
    that weight or more."""

    sets: list[float]
    weightLb: float | None = None
    each: bool = False
    seconds: bool = False

    @property
    def total(self) -> float:
        return sum(self.sets)


class Streak(BaseModel):
    """The target and its progress: +1 for a session that reaches it, -1 for one that misses.
    At `goal` it's time to go up."""

    scheme: Scheme
    times: int
    goal: int = 3


class LastTime(BaseModel):
    workoutId: str
    date: str
    entry: Entry


class DatedPhoto(Photo):
    date: str


class DatedSets(BaseModel):
    date: str
    sets: list[SetData]


class ExerciseSummary(BaseModel):
    exercise: Exercise
    cues: list[Note]
    last: LastTime | None
    streak: Streak | None
    # Photos taken for this exercise (machine and rack setups), newest first.
    photos: list[DatedPhoto] = Field(default_factory=list)
    # The drop-set ladder with the most total reps so far (dips, chin-ups).
    bestDrop: DatedSets | None = None


class SessionType(BaseModel):
    """A kind of training day ("Squat", "Push", "Climb") and its usual exercises in order."""

    label: str
    exercises: list[str]
    lastDate: str
    sessions: int


class ExerciseSession(BaseModel):
    workoutId: str
    date: str
    label: str
    entry: Entry


class BestSet(BaseModel):
    """The heaviest set (most reps at that weight); for body-weight work, the most reps."""

    date: str
    set: SetData


class ExerciseHistory(BaseModel):
    """Everything about one exercise for its page: every session (newest first) and all photos."""

    sessions: list[ExerciseSession]
    photos: list[DatedPhoto]
    best: BestSet | None = None


class ProgressDay(BaseModel):
    """A training day for the consistency calendar."""

    date: str
    workoutId: str
    label: str
    # Today's day type: Push, Legs, Pull, Cardio (old names map, see labels.day_type).
    type: str


class StrengthPoint(BaseModel):
    """One session of an exercise: its top set and how the target game went."""

    date: str
    workoutId: str
    # Top-set weight in lb as written (plates for barbell lifts, like the rest of the app; per hand
    # for dumbbells; the added weight for weighted dips and chin-ups), or the most reps (or
    # seconds) in a set for body-weight work.
    value: float
    # Reps (or seconds) of the best set at that value, and the working sets ("5x4").
    reps: float | None = None
    sets: str = ""
    pr: bool = False
    game: Literal["new", "reached", "missed", "light"] | None = None
    times: int | None = None


class Lift(BaseModel):
    exerciseId: str
    name: str
    load: Load
    unit: Literal["lb", "reps", "s"]
    # The bar for barbell lifts (value + barLb = the total lifted).
    barLb: float = 0
    sessions: list[StrengthPoint]


class Progress(BaseModel):
    days: list[ProgressDay]
    lifts: list[Lift]

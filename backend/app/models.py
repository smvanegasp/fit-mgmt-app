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


class WorkoutBody(BaseModel):
    """What the editor sends, for the workout in progress and for saved workouts."""

    startedAt: str
    endedAt: str | None = None
    label: str | None = Field(None, max_length=80)
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


class NoteCreate(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class NoteUpdate(BaseModel):
    text: str | None = Field(None, min_length=1, max_length=300)
    hidden: bool | None = None


class Scheme(BaseModel):
    """The main working sets of a session: 5 x 5 @ 170."""

    count: int
    reps: float | None = None
    seconds: int | None = None
    weightLb: float | None = None
    each: bool = False


class Streak(BaseModel):
    """The last session's main sets and how many sessions in a row reached them."""

    scheme: Scheme
    times: int


class LastTime(BaseModel):
    workoutId: str
    date: str
    entry: Entry


class ExerciseSummary(BaseModel):
    exercise: Exercise
    cues: list[Note]
    last: LastTime | None
    streak: Streak | None

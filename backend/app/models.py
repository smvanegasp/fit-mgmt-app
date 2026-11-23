"""Request and response shapes. Stored rows use the same field names (see AGENTS.md data model);
optional fields left empty are not stored."""

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.catalog import Group, Load, Measure

CueSection = Literal["setup", "brace", "lift"]

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


class Peloton(BaseModel):
    """A Peloton class as read from its summary screenshot (app/peloton.py; Sergio, 2026-11-17: no
    typing). Every field is optional: whatever the screen showed."""

    discipline: str | None = Field(None, max_length=40)
    title: str | None = Field(None, max_length=120)
    instructor: str | None = Field(None, max_length=80)
    minutes: float | None = Field(None, ge=0, le=600)
    outputKj: float | None = Field(None, ge=0, le=5000)
    distanceMi: float | None = Field(None, ge=0, le=200)
    calories: float | None = Field(None, ge=0, le=5000)
    avgWatts: float | None = Field(None, ge=0, le=2000)
    avgCadence: float | None = Field(None, ge=0, le=250)
    avgResistance: float | None = Field(None, ge=0, le=100)
    avgSpeedMph: float | None = Field(None, ge=0, le=60)


class Target(BaseModel):
    text: str = Field(max_length=200)
    times: int | None = None
    kind: str | None = None


class Photo(BaseModel):
    key: str = Field(max_length=120)
    caption: str | None = Field(None, max_length=300)
    # "screenshot": a record of the workout itself (a Peloton summary), not how to set up the
    # exercise; left out of the setup photos shown while training (Sergio, 2026-11-17).
    kind: Literal["screenshot"] | None = None


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
    peloton: Peloton | None = None
    # Marked done during the workout (it folds away); dropped when the workout is saved.
    done: bool | None = None

    def logged(self) -> bool:
        """Anything recorded (a workout starts with its usual exercises filled in, not all get done)."""
        return bool(self.sets or self.problems or self.segments or self.notes or self.photos
                    or self.minutes or self.distanceMi or self.peloton)

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
    # The weight stepper's step in lb (Sergio, 2026-11-19: 2.5 for some exercises); None = the default.
    stepLb: float | None = None


class ExerciseUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    group: Group | None = None
    stepLb: Literal[2.5, 5] | None = None


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
    # Where the cue fits while training (setup, then brace and breathe, then the lift) and its
    # importance there (1 = most important). Unset for cues nobody has placed yet.
    section: CueSection | None = None
    rank: int | None = None


class NoteCreate(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    section: CueSection | None = None


class NoteUpdate(BaseModel):
    text: str | None = Field(None, min_length=1, max_length=300)
    hidden: bool | None = None
    section: CueSection | None = None
    rank: int | None = Field(None, ge=1, le=100)


class CueCheck(BaseModel):
    """A note Sergio wrote today, to check against the exercise's cues."""

    note: str = Field(min_length=1, max_length=1000)


class CueSuggestion(BaseModel):
    """What the cue check proposes; nothing changes until Sergio accepts it. `add`: a new cue;
    `update`: new wording for `noteId`; `none`: just a comment about today."""

    action: Literal["add", "update", "none"]
    noteId: str | None = None
    text: str | None = Field(None, max_length=300)
    section: CueSection | None = None


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
    # The day's first lift, or done later (lighter: squat after deadlift); see history.role.
    role: Literal["first", "later"] = "later"


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
    # Cardio done that day (a ride or run, alone or after lifting): the weekly goal counts it.
    cardio: bool = False


class StepSession(BaseModel):
    date: str
    workoutId: str
    # "new" = the session that set this target (counts as the first time).
    result: Literal["new", "reached", "missed"]


class Step(BaseModel):
    """One rung of an exercise's progression ladder: a target and the sessions spent on it, until
    more sets, more reps or more weight made the next one. Light days aren't listed."""

    scheme: Scheme
    sessions: list[StepSession]
    # The count when the step ended (or now, for the current one); 3 = done, time to go up.
    times: int


class Lift(BaseModel):
    exerciseId: str
    name: str
    load: Load
    # The bar for barbell lifts (weights are plates as written; + barLb = the total lifted).
    barLb: float = 0
    # Oldest first; the last one is the current target.
    steps: list[Step]




class Routine(BaseModel):
    """A routine era (the plan Sergio followed from one date to another), for the timeline."""

    model_config = {"populate_by_name": True}

    id: str
    name: str
    start: str = Field(alias="from")
    end: str | None = Field(None, alias="to")
    days: list[str] = Field(default_factory=list)
    notes: str = ""
    photos: list[Photo] = Field(default_factory=list)
    # Workouts logged in the era.
    sessions: int = 0


class Progress(BaseModel):
    days: list[ProgressDay]
    lifts: list[Lift]
    # Newest first.
    routines: list[Routine] = Field(default_factory=list)


class FeedbackCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    # Where it was written about ("Train", "Exercise: Back squat"...).
    page: str = Field("", max_length=80)
    # Screenshots (Sergio, 2026-11-21): keys of photos uploaded from this session.
    photos: list[str] = Field(default_factory=list, max_length=3)


class Feedback(BaseModel):
    """Feedback left in the app, reviewed by the agent at the start of the next session."""

    id: str
    text: str
    page: str = ""
    role: Literal["owner", "guest"]
    createdAt: str
    status: Literal["new", "done"] = "new"
    userAgent: str = ""
    # Copies under feedback/ (they outlive the demo's photos), readable by the owner.
    photos: list[str] = Field(default_factory=list)
    editedAt: str | None = None
    # Who wrote it (their data space), so they can fix a typo; never sent back.
    space: str = Field("", exclude=True)


class FeedbackUpdate(BaseModel):
    status: Literal["new", "done"] | None = None
    # Fix what was sent (Sergio, 2026-11-21): the owner, or whoever wrote it.
    text: str | None = Field(None, min_length=1, max_length=2000)


class PublicDay(BaseModel):
    date: str
    type: str
    cardio: bool = False


class PublicLift(BaseModel):
    exerciseId: str
    name: str
    group: Group
    load: Load
    scheme: Scheme
    times: int


class PublicSummary(BaseModel):
    """What the welcome page shows before anyone signs in: training days and current targets only
    (no notes, cues, photos or workout details). A guest sees all of this after Continue anyway."""

    days: list[PublicDay]
    lifts: list[PublicLift]


DayKind = Literal["Push", "Legs", "Pull", "Upper", "Lower", "Full body", "Cardio"]


class DayPlan(BaseModel):
    """One day of a week type (app/plans.py): its name, kind and exercises in order. A Cardio day
    with no exercises picks its activity at the start."""

    id: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=40)
    kind: DayKind
    exercises: list[str] = Field(default_factory=list, max_length=20)


class WeekPlan(BaseModel):
    """A week type ("Squat & heavy push week"); week types repeat in their order."""

    id: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=60)
    days: list[DayPlan] = Field(max_length=10)


class TrainingPlans(BaseModel):
    weeks: list[WeekPlan]
    # This week's type (a week id), from the anchor Sergio set or the log.
    current: str | None = None
    # False while the plans are read off the log (nothing saved yet).
    saved: bool = False


class PlansBody(BaseModel):
    weeks: list[WeekPlan] = Field(min_length=1, max_length=8)
    # Set "this week is <id>": the rotation counts from this Monday.
    current: str | None = None

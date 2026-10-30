import re
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app import cue_check, db, history, progress
from app.catalog import EXERCISES
from app.models import (
    CueCheck,
    CueSuggestion,
    Exercise,
    ExerciseCreate,
    ExerciseHistory,
    ExerciseSummary,
    ExerciseUpdate,
    Lift,
    MergeBody,
    Note,
    NoteCreate,
    NoteUpdate,
    SessionType,
)
from app.space import current_space

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


def all_exercises(space: str) -> dict[str, Exercise]:
    """The built-in catalog plus exercises stored in this space (imported copies, custom ones)."""
    out = {
        e.id: Exercise(id=e.id, name=e.name, group=e.group, load=e.load, measure=e.measure,
                       barLb=e.bar_lb, aliases=list(e.aliases))
        for e in EXERCISES
    }
    for row in db.query(space, "EXERCISE#"):
        # Catalog copies (written by the import) follow the code, so catalog changes apply.
        if row.get("source") == "app" or row["id"] not in out:
            out[row["id"]] = Exercise(**row)
    return out


def get_exercise(space: str, exercise_id: str) -> Exercise:
    exercise = all_exercises(space).get(exercise_id)
    if exercise is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
    return exercise


def cues(space: str, exercise_id: str) -> list[Note]:
    return [Note(**row) for row in db.query(space, f"NOTE#{exercise_id}#")]


@router.get("")
def list_exercises(space: str = Depends(current_space)) -> list[Exercise]:
    used = history.usage(space)
    out = []
    for exercise in all_exercises(space).values():
        if exercise.hidden:
            continue
        last, count = used.get(exercise.id, (None, 0))
        out.append(exercise.model_copy(update={"lastDone": last, "timesDone": count}))
    return sorted(out, key=lambda e: e.name.lower())


@router.post("", status_code=status.HTTP_201_CREATED)
def create_exercise(body: ExerciseCreate, space: str = Depends(current_space)) -> Exercise:
    name = " ".join(body.name.split())
    existing = all_exercises(space)
    if any(e.name.lower() == name.lower() for e in existing.values()):
        raise HTTPException(status.HTTP_409_CONFLICT, f'"{name}" already exists')
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "exercise"
    exercise_id = f"custom-{slug}-{uuid.uuid4().hex[:4]}"
    exercise = Exercise(id=exercise_id, name=name, group=body.group, load=body.load, measure=body.measure,
                        barLb=45 if body.load == "barbell" else 0, source="app")
    db.put(space, f"EXERCISE#{exercise_id}", exercise.model_dump(exclude={"lastDone", "timesDone"}))
    return exercise


def _save(space: str, exercise: Exercise) -> None:
    """Changes to a catalog exercise are stored as the space's own version of it."""
    data = exercise.model_dump(exclude={"lastDone", "timesDone"})
    db.put(space, f"EXERCISE#{exercise.id}", {**data, "source": "app"})


@router.patch("/{exercise_id}")
def update_exercise(exercise_id: str, body: ExerciseUpdate, space: str = Depends(current_space)) -> Exercise:
    """Rename or recategorize. The old name stays searchable."""
    exercise = get_exercise(space, exercise_id)
    if body.name is not None:
        name = " ".join(body.name.split())
        others = [e for e in all_exercises(space).values() if e.id != exercise_id and not e.hidden]
        if any(e.name.lower() == name.lower() for e in others):
            raise HTTPException(status.HTTP_409_CONFLICT, f'"{name}" already exists')
        if name != exercise.name:
            exercise.aliases = list(dict.fromkeys([*exercise.aliases, exercise.name.lower()]))
            exercise.name = name
    if body.group is not None:
        exercise.group = body.group
    exercise.source = "app"
    _save(space, exercise)
    return exercise


@router.post("/{exercise_id}/merge")
def merge_exercise(exercise_id: str, body: MergeBody, space: str = Depends(current_space)) -> Exercise:
    """Move every session and cue of a duplicate into another exercise, then hide the duplicate."""
    source = get_exercise(space, exercise_id)
    target = get_exercise(space, body.into)
    if source.id == target.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pick a different exercise to merge into")
    for sk, workout in db.keys(space, "WORKOUT#"):
        entries = workout.get("entries", [])
        if any(e.get("exerciseId") == source.id for e in entries):
            for e in entries:
                if e.get("exerciseId") == source.id:
                    e["exerciseId"] = target.id
            db.put(space, sk, workout)
    for sk, note in db.keys(space, f"NOTE#{source.id}#"):
        db.put(space, f"NOTE#{target.id}#{note['date']}#{note['id']}", {**note, "exerciseId": target.id})
        db.delete(space, sk)
    target.aliases = list(dict.fromkeys([*target.aliases, source.name.lower(), *source.aliases]))
    _save(space, target)
    _save(space, source.model_copy(update={"hidden": True, "mergedInto": target.id}))
    return target


@router.get("/{exercise_id}/history", response_model_exclude_none=True)
def exercise_history(exercise_id: str, space: str = Depends(current_space)) -> ExerciseHistory:
    """For the exercise page: every session, all photos, the best set."""
    get_exercise(space, exercise_id)
    return history.exercise_history(space, exercise_id)


@router.get("/{exercise_id}/progress", response_model_exclude_none=True)
def exercise_progress(exercise_id: str, space: str = Depends(current_space)) -> Lift:
    """The exercise page's progression ladder: each target and the sessions spent on it."""
    return progress.ladder(history.workouts(space), get_exercise(space, exercise_id))


@router.get("/{exercise_id}/summary", response_model_exclude_none=True)
def exercise_summary(exercise_id: str, exclude: str | None = None, space: str = Depends(current_space)) -> ExerciseSummary:
    """What the Train screen shows when an exercise is added: cues, last time, the streak."""
    exercise = get_exercise(space, exercise_id)
    last, streak, photos, best = history.summary(space, exercise_id, exclude=exclude)
    return ExerciseSummary(exercise=exercise, cues=cues(space, exercise_id), last=last, streak=streak, photos=photos,
                           bestDrop=best)


@router.post("/{exercise_id}/notes", status_code=status.HTTP_201_CREATED)
def add_note(exercise_id: str, body: NoteCreate, space: str = Depends(current_space)) -> Note:
    get_exercise(space, exercise_id)
    note = Note(id=uuid.uuid4().hex[:12], exerciseId=exercise_id, text=body.text.strip(), date=body.date,
                lastSeen=body.date, source="app", section=body.section)
    db.put(space, f"NOTE#{exercise_id}#{note.date}#{note.id}", note.model_dump())
    return note


@router.post("/{exercise_id}/cue-check")
def check_cue(exercise_id: str, body: CueCheck, space: str = Depends(current_space)) -> CueSuggestion:
    """Whether today's note should add or reword a cue (a suggestion; Sergio accepts it or not)."""
    exercise = get_exercise(space, exercise_id)
    try:
        return cue_check.check(exercise, cues(space, exercise_id), body.note)
    except cue_check.CueCheckOff:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The cue check is off (no GROQ_API_KEY)") from None
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The cue check didn't answer; try again later") from None


def _find_note(space: str, exercise_id: str, note_id: str) -> tuple[str, Note]:
    for sk, row in db.keys(space, f"NOTE#{exercise_id}#"):
        if row.get("id") == note_id:
            return sk, Note(**row)
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")


@router.patch("/{exercise_id}/notes/{note_id}")
def update_note(exercise_id: str, note_id: str, body: NoteUpdate, space: str = Depends(current_space)) -> Note:
    sk, note = _find_note(space, exercise_id, note_id)
    updated = note.model_copy(update=body.model_dump(exclude_none=True))
    if body.text is not None:
        updated.text = body.text.strip()
    db.put(space, sk, updated.model_dump())
    return updated


@router.delete("/{exercise_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(exercise_id: str, note_id: str, space: str = Depends(current_space)) -> None:
    sk, _ = _find_note(space, exercise_id, note_id)
    db.delete(space, sk)


session_types_router = APIRouter(prefix="/api/session-types", tags=["exercises"])


@session_types_router.get("")
def list_session_types(space: str = Depends(current_space)) -> list[SessionType]:
    """Kinds of training day with their usual exercises, for "Usual on Squat days"."""
    return history.session_types(space)

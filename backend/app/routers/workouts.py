"""Saved workouts and the workout in progress.

The workout in progress is one ACTIVE row: the phone saves it after every change, and its
`startedAt` lives on the server, so the stopwatch survives the screen locking or a reload.
Finishing turns it into a WORKOUT row.
"""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app import db
from app.labels import session_label
from app.models import FinishBody, Workout, WorkoutBody
from app.routers.exercises import all_exercises
from app.space import current_space

router = APIRouter(prefix="/api", tags=["workouts"])

ACTIVE = "ACTIVE"


def _clean(data: dict[str, Any]) -> dict[str, Any]:
    """Drop empty lists and None so stored rows look like the imported ones."""
    if isinstance(data, dict):
        return {k: _clean(v) for k, v in data.items() if v is not None and v != []}
    if isinstance(data, list):
        return [_clean(v) for v in data]
    return data


def _label(space: str, body: WorkoutBody, legs_day: bool = True) -> str:
    """legs_day=False keeps the old Squat / Deadlift names, for imported workouts being edited."""
    names = {e.id: e.name for e in all_exercises(space).values()}
    return body.label or session_label([(e.exerciseId, len(e.sets)) for e in body.entries], names, legs_day)


def _sk(workout_id: str) -> str:
    # Ids start with the date ("2026-10-29-1", "2026-10-29-a1b2c3"), which leads the sort key.
    return f"WORKOUT#{workout_id[:10]}#{workout_id}"


def _get(space: str, workout_id: str) -> Workout:
    row = db.get(space, _sk(workout_id))
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout not found")
    return Workout(**row)


# ------------------------------------------------------------------ saved workouts


@router.get("/workouts", response_model_exclude_none=True)
def list_workouts(limit: int = Query(20, ge=1, le=1000), space: str = Depends(current_space)) -> list[Workout]:
    """Most recent first."""
    rows = db.query(space, "WORKOUT#")
    rows.sort(key=lambda w: (w["date"], w.get("startedAt", "")), reverse=True)
    return [Workout(**w) for w in rows[:limit]]


@router.get("/workouts/{workout_id}", response_model_exclude_none=True)
def get_workout(workout_id: str, space: str = Depends(current_space)) -> Workout:
    return _get(space, workout_id)


@router.put("/workouts/{workout_id}", response_model_exclude_none=True)
def update_workout(workout_id: str, body: WorkoutBody, space: str = Depends(current_space)) -> Workout:
    old = _get(space, workout_id)
    label = _label(space, body, legs_day=old.source == "app")
    workout = Workout(**{**body.model_dump(), "label": label}, id=old.id, date=old.date,
                      durationEstimated=old.durationEstimated, source=old.source)
    db.put(space, _sk(workout_id), _clean(workout.model_dump()))
    return workout


@router.delete("/workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(workout_id: str, space: str = Depends(current_space)) -> None:
    _get(space, workout_id)
    db.delete(space, _sk(workout_id))


# ------------------------------------------------------------------ the workout in progress


@router.get("/active", response_model_exclude_none=True)
def get_active(space: str = Depends(current_space)) -> WorkoutBody | None:
    row = db.get(space, ACTIVE)
    return WorkoutBody(**row) if row else None


@router.post("/active", status_code=status.HTTP_201_CREATED, response_model_exclude_none=True)
def start_workout(body: WorkoutBody, space: str = Depends(current_space)) -> WorkoutBody:
    """Start the stopwatch. The phone sends its local time; starting twice keeps the first."""
    row = db.get(space, ACTIVE)
    if row:
        return WorkoutBody(**row)
    db.put(space, ACTIVE, _clean(body.model_dump()))
    return body


@router.put("/active", response_model_exclude_none=True)
def save_active(body: WorkoutBody, space: str = Depends(current_space)) -> WorkoutBody:
    row = db.get(space, ACTIVE)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No workout in progress")
    # The start time can't move: it's the stopwatch.
    body = body.model_copy(update={"startedAt": row["startedAt"]})
    db.put(space, ACTIVE, _clean(body.model_dump()))
    return body


@router.post("/active/finish", status_code=status.HTTP_201_CREATED, response_model_exclude_none=True)
def finish_workout(body: FinishBody, space: str = Depends(current_space)) -> Workout:
    row = db.get(space, ACTIVE)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No workout in progress")
    active = WorkoutBody(**row)
    if not active.entries:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add at least one exercise before finishing")
    date = active.startedAt[:10]
    same_day = db.query(space, f"WORKOUT#{date}#")
    if same_day:
        # One workout per day: a second session joins the first one.
        first = Workout(**same_day[0])

        def minutes(start: str, end: str | None) -> float:
            return (datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds() / 60 if end else 0

        merged = first.model_copy(update={
            "durationMin": round((first.durationMin or minutes(first.startedAt, first.endedAt))
                                 + minutes(active.startedAt, body.endedAt)),
            "entries": first.entries + active.entries,
            "notes": first.notes + active.notes,
            "photos": first.photos + active.photos,
            "laps": first.laps + active.laps,
            "endedAt": max(first.endedAt or "", body.endedAt),
            "plan": first.plan or active.plan,
        })
        merged = merged.model_copy(update={"label": _label(space, merged, legs_day=first.source == "app")})
        db.put(space, _sk(merged.id), _clean(merged.model_dump()))
        db.delete(space, ACTIVE)
        return merged
    workout = Workout(**{**active.model_dump(), "endedAt": body.endedAt, "label": _label(space, active)},
                      id=f"{date}-{uuid.uuid4().hex[:6]}", date=date, source="app")
    db.put(space, _sk(workout.id), _clean(workout.model_dump()))
    db.delete(space, ACTIVE)
    return workout


@router.delete("/active", status_code=status.HTTP_204_NO_CONTENT)
def discard_workout(space: str = Depends(current_space)) -> None:
    db.delete(space, ACTIVE)

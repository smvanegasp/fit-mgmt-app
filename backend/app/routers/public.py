from fastapi import APIRouter

from app import progress
from app.models import PublicDay, PublicLift, PublicSummary
from app.routers.exercises import all_exercises
from app.sandbox import OWNER_SPACE

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/summary")
def summary() -> PublicSummary:
    """The welcome page's live stats, without a session: Sergio's training days (date and day
    type) and the main lifts' current targets."""
    exercises = all_exercises(OWNER_SPACE)
    data = progress.progress(OWNER_SPACE, exercises)
    days = [PublicDay(date=d.date, type=d.type) for d in data.days]
    lifts = [
        PublicLift(exerciseId=lift.exerciseId, name=lift.name, group=exercises[lift.exerciseId].group, load=lift.load,
                   scheme=lift.steps[-1].scheme, times=lift.steps[-1].times)
        for lift in data.lifts if lift.steps
    ]
    return PublicSummary(days=days, lifts=lifts)

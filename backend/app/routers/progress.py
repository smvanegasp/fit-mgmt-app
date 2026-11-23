from datetime import date

from fastapi import APIRouter, Depends, Query

from app import plans, progress
from app.models import Progress
from app.routers.exercises import all_exercises
from app.space import current_space

router = APIRouter(prefix="/api", tags=["progress"])


@router.get("/progress", response_model_exclude_none=True)
def get_progress(today: str = Query(default_factory=lambda: date.today().isoformat(), pattern=r"^\d{4}-\d{2}-\d{2}$"),
                 space: str = Depends(current_space)) -> Progress:
    """The Progress tab: every training day, the main lifts session by session, and each week's
    goal from the plans (`today`: the phone's date, for this week)."""
    out = progress.progress(space, all_exercises(space))
    out.goals = plans.goals(space, today)
    return out

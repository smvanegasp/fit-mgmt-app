from fastapi import APIRouter, Depends

from app import progress
from app.models import Progress
from app.routers.exercises import all_exercises
from app.space import current_space

router = APIRouter(prefix="/api", tags=["progress"])


@router.get("/progress", response_model_exclude_none=True)
def get_progress(space: str = Depends(current_space)) -> Progress:
    """The Progress tab: every training day, and the main lifts session by session."""
    return progress.progress(space, all_exercises(space))

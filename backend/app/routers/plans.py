"""Training plans: GET reads them (saved, or read off the log), PUT saves them (app/plans.py)."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app import plans
from app.models import PlansBody, TrainingPlans
from app.routers.exercises import all_exercises
from app.space import current_space

router = APIRouter(prefix="/api/plans", tags=["plans"])


@router.get("")
def get_plans(today: str = Query(default_factory=lambda: date.today().isoformat(), pattern=r"^\d{4}-\d{2}-\d{2}$"),
              space: str = Depends(current_space)) -> TrainingPlans:
    """`today` is the phone's local date, which decides this week's type."""
    return plans.get_plans(space, all_exercises(space), today)


@router.put("")
def save_plans(body: PlansBody, today: str = Query(default_factory=lambda: date.today().isoformat(), pattern=r"^\d{4}-\d{2}-\d{2}$"),
               space: str = Depends(current_space)) -> TrainingPlans:
    known = all_exercises(space)
    for p in body.plans:
        missing = [x for x in p.exercises if x not in known]
        if missing:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown exercise: {missing[0]}")
    if len({p.id for p in body.plans}) != len(body.plans):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Two plans share an id")
    plans.save_plans(space, body.plans)
    return plans.get_plans(space, known, today)

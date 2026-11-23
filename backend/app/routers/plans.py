"""Training plans: GET reads them (saved, or read off the log), PUT saves them (app/plans.py)."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app import plans
from app.models import PlansBody, PlanVersion, TrainingPlans
from app.routers.exercises import all_exercises
from app.space import current_space

router = APIRouter(prefix="/api/plans", tags=["plans"])

TODAY = Query(default_factory=lambda: date.today().isoformat(), pattern=r"^\d{4}-\d{2}-\d{2}$")


@router.get("")
def get_plans(today: str = TODAY, space: str = Depends(current_space)) -> TrainingPlans:
    """`today` is the phone's local date, which decides this week's type."""
    return plans.get_plans(space, all_exercises(space), today)


@router.get("/history")
def plan_history(space: str = Depends(current_space)) -> list[PlanVersion]:
    """Every saved version of the plans, newest first."""
    return plans.history(space)


@router.put("")
def save_plans(body: PlansBody, today: str = TODAY, space: str = Depends(current_space)) -> TrainingPlans:
    known = all_exercises(space)
    week_ids = [w.id for w in body.weeks]
    day_ids = [d.id for w in body.weeks for d in w.days]
    if len(set(week_ids)) != len(week_ids) or len(set(day_ids)) != len(day_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Two weeks or two days share an id")
    if body.current is not None and body.current not in week_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This week must be one of the week types")
    for week in body.weeks:
        for day in week.days:
            missing = [x for x in day.exercises if x not in known]
            if missing:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown exercise: {missing[0]}")
    plans.save_plans(space, body.weeks, body.current, today)
    return plans.get_plans(space, known, today)

"""Body weight (Sergio, 2026-11-03): one weight per day, `BODY#<yyyy-mm-dd>`, in pounds."""

from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, Field

from app import db
from app.space import current_space

router = APIRouter(prefix="/api/body", tags=["body"])

DAY = Path(pattern=r"^\d{4}-\d{2}-\d{2}$")


class BodyWeight(BaseModel):
    date: str
    weightLb: float


class BodyWeightIn(BaseModel):
    weightLb: float = Field(gt=50, lt=500)


@router.get("")
def list_weights(space: str = Depends(current_space)) -> list[BodyWeight]:
    """Every weigh-in, oldest first."""
    return [BodyWeight(date=row["date"], weightLb=row["weightLb"]) for row in db.query(space, "BODY#")]


@router.put("/{day}")
def log_weight(body: BodyWeightIn, day: str = DAY, space: str = Depends(current_space)) -> BodyWeight:
    """Logging a day again replaces that day's weight."""
    try:
        Date.fromisoformat(day)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Not a date") from None
    row = {"date": day, "weightLb": round(body.weightLb, 1), "source": "app"}
    db.put(space, f"BODY#{day}", row)
    return BodyWeight(date=day, weightLb=row["weightLb"])


@router.delete("/{day}", status_code=status.HTTP_204_NO_CONTENT)
def delete_weight(day: str = DAY, space: str = Depends(current_space)) -> None:
    db.delete(space, f"BODY#{day}")

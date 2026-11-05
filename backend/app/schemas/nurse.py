from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import LocationStatus, NurseOutcome
from app.schemas.common import ORMModel


class NurseVisitCreate(BaseModel):
    student_id: int
    reason: str = Field(min_length=1, max_length=255, examples=["Головная боль"])
    notes: str | None = None
    outcome: NurseOutcome = NurseOutcome.RESTING
    start_time: datetime | None = None


class NurseVisitUpdate(BaseModel):
    outcome: NurseOutcome | None = None
    reason: str | None = Field(default=None, min_length=1, max_length=255)
    notes: str | None = None


class NurseVisitOut(ORMModel):
    id: int
    student_id: int
    student_name: str
    class_name: str
    nurse_id: int | None
    start_time: datetime
    end_time: datetime | None
    reason: str
    outcome: NurseOutcome
    notes: str | None
    is_active: bool
    student_status: LocationStatus

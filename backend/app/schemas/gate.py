from datetime import UTC, datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import GateDirection, LocationStatus


class GatePassIn(BaseModel):
    """Вебхук турникета. Ученик идентифицируется по student_id ИЛИ rfid_card_id."""

    student_id: int | None = None
    rfid_card_id: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    direction: GateDirection
    gate_id: str | None = Field(default=None, examples=["main-entrance-1"])

    @model_validator(mode="after")
    def _check_identity(self) -> "GatePassIn":
        if self.student_id is None and not self.rfid_card_id:
            raise ValueError("Нужно указать student_id или rfid_card_id")
        if self.timestamp.tzinfo is None:  # считаем наивное время UTC
            self.timestamp = self.timestamp.replace(tzinfo=UTC)
        return self


class GatePassOut(BaseModel):
    log_id: int
    student_id: int
    direction: GateDirection
    timestamp: datetime
    applied: bool  # False — событие старше последнего учтённого прохода
    status: LocationStatus
    is_discrepancy: bool

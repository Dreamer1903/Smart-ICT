from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UTCDateTime, str_enum, utcnow
from app.models.enums import GateDirection, LocationStatus

if TYPE_CHECKING:
    from app.models.student import Student


class StudentPresenceState(Base):
    """Материализованный Live-статус ученика (одна строка на ученика).

    Изменяется ТОЛЬКО через app.services.presence — там же генерируются события.
    """

    __tablename__ = "student_presence_states"

    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), primary_key=True
    )
    current_location_status: Mapped[LocationStatus] = mapped_column(
        str_enum(LocationStatus, "location_status"), default=LocationStatus.UNKNOWN, index=True
    )
    last_updated: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    # Денормализованные данные для быстрых сверок
    last_gate_direction: Mapped[GateDirection | None] = mapped_column(
        str_enum(GateDirection, "presence_gate_direction")
    )
    last_gate_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    is_discrepancy: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    discrepancy_since: Mapped[datetime | None] = mapped_column(UTCDateTime)
    note: Mapped[str | None] = mapped_column(String(255))  # человекочитаемая причина статуса

    student: Mapped["Student"] = relationship(back_populates="presence")

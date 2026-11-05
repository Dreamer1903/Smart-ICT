from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UTCDateTime, str_enum, utcnow
from app.models.enums import NurseOutcome

if TYPE_CHECKING:
    from app.models.student import Student


class NurseVisit(Base):
    """Визит в медпункт. Активный визит — тот, у которого end_time IS NULL."""

    __tablename__ = "nurse_visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    nurse_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    start_time: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    end_time: Mapped[datetime | None] = mapped_column(UTCDateTime)
    reason: Mapped[str] = mapped_column(String(255))
    outcome: Mapped[NurseOutcome] = mapped_column(
        str_enum(NurseOutcome, "nurse_outcome"), default=NurseOutcome.RESTING
    )
    notes: Mapped[str | None] = mapped_column(Text)

    student: Mapped["Student"] = relationship()

    @property
    def is_active(self) -> bool:
        return self.end_time is None

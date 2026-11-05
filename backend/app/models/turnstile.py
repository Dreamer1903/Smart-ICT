from datetime import datetime

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UTCDateTime, str_enum, utcnow
from app.models.enums import GateDirection


class TurnstileLog(Base):
    """Сырой журнал проходов СКУД (append-only)."""

    __tablename__ = "turnstile_logs"
    __table_args__ = (Index("ix_turnstile_logs_student_ts", "student_id", "timestamp"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    timestamp: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    direction: Mapped[GateDirection] = mapped_column(str_enum(GateDirection, "gate_direction"))
    gate_id: Mapped[str | None] = mapped_column(String(64))  # идентификатор турникета
    received_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

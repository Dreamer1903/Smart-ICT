"""Дежурства: посты (этажи, столовая) с QR-кодом, смены, назначения учителей и отметка по QR."""

import datetime as dt
import secrets
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UTCDateTime, str_enum, utcnow
from app.models.enums import DutyStatus

if TYPE_CHECKING:
    from app.models.user import User


def new_qr_token() -> str:
    return secrets.token_urlsafe(16)


class DutyPost(Base):
    """Пост дежурства. На посту висит QR-код со ссылкой /duty/checkin/<qr_token>."""

    __tablename__ = "duty_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))  # «2 этаж», «Столовая»
    location: Mapped[str | None] = mapped_column(String(255))  # где висит QR
    qr_token: Mapped[str] = mapped_column(String(64), unique=True, default=new_qr_token)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    shifts: Mapped[list["DutyShift"]] = relationship(back_populates="post", cascade="all, delete-orphan",
                                                     order_by="DutyShift.start_time")


class DutyShift(Base):
    """Смена на посту: время и сколько учителей нужно."""

    __tablename__ = "duty_shifts"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("duty_posts.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64))  # «Утро», «Большая перемена», «Обед»
    start_time: Mapped[dt.time] = mapped_column(Time)
    end_time: Mapped[dt.time] = mapped_column(Time)
    required: Mapped[int] = mapped_column(Integer, default=1)

    post: Mapped[DutyPost] = relationship(back_populates="shifts")


class DutyAssignment(Base):
    __tablename__ = "duty_assignments"
    __table_args__ = (UniqueConstraint("date", "shift_id", "teacher_id", name="uq_duty_assignments_date_shift_teacher"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[dt.date] = mapped_column(Date, index=True)
    shift_id: Mapped[int] = mapped_column(ForeignKey("duty_shifts.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[DutyStatus] = mapped_column(str_enum(DutyStatus, "duty_status"), default=DutyStatus.PLANNED)
    checked_in_at: Mapped[dt.datetime | None] = mapped_column(UTCDateTime)
    late_minutes: Mapped[int | None] = mapped_column(Integer)
    manual: Mapped[bool] = mapped_column(Boolean, default=False)  # назначен вручную — перегенерация не трогает
    notified_at: Mapped[dt.datetime | None] = mapped_column(UTCDateTime)
    reminded_at: Mapped[dt.datetime | None] = mapped_column(UTCDateTime)  # завучу: «не приступил»
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    shift: Mapped[DutyShift] = relationship()
    teacher: Mapped["User"] = relationship()

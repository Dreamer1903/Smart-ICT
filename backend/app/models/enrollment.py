"""Процесс приёма ученика, история событий по ученику и уведомления сотрудникам."""

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UTCDateTime, str_enum, utcnow
from app.models.enums import EnrollmentStatus, EnrollmentStepKind, StepStatus, UserRole

if TYPE_CHECKING:
    from app.models.student import Student
    from app.models.user import User


class Enrollment(Base):
    """Заявка на приём: один ученик — одна заявка; этапы — в EnrollmentStep."""

    __tablename__ = "enrollments"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), unique=True)
    status: Mapped[EnrollmentStatus] = mapped_column(
        str_enum(EnrollmentStatus, "enrollment_status"), default=EnrollmentStatus.IN_PROGRESS, index=True
    )
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    student: Mapped["Student"] = relationship()
    created_by: Mapped["User | None"] = relationship()
    steps: Mapped[list["EnrollmentStep"]] = relationship(
        back_populates="enrollment", cascade="all, delete-orphan", order_by="EnrollmentStep.id"
    )


class EnrollmentStep(Base):
    __tablename__ = "enrollment_steps"
    __table_args__ = (UniqueConstraint("enrollment_id", "kind", name="uq_enrollment_steps_enrollment_kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("enrollments.id", ondelete="CASCADE"), index=True)
    kind: Mapped[EnrollmentStepKind] = mapped_column(str_enum(EnrollmentStepKind, "enrollment_step_kind"))
    status: Mapped[StepStatus] = mapped_column(str_enum(StepStatus, "step_status"), default=StepStatus.PENDING)
    assignee_role: Mapped[UserRole] = mapped_column(str_enum(UserRole, "step_assignee_role"))
    assignee_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))  # напр. классный руководитель
    completed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    data: Mapped[dict[str, Any] | None] = mapped_column(JSON)  # что заполнили на этапе
    comment: Mapped[str | None] = mapped_column(Text)

    enrollment: Mapped[Enrollment] = relationship(back_populates="steps")
    assignee_user: Mapped["User | None"] = relationship(foreign_keys=[assignee_user_id])
    completed_by: Mapped["User | None"] = relationship(foreign_keys=[completed_by_id])


class StudentTimelineEvent(Base):
    """История ученика: поступление, этапы приёма, смена класса, пансионат и т.д. (кто, что, когда)."""

    __tablename__ = "student_timeline"
    __table_args__ = (Index("ix_student_timeline_student_at", "student_id", "at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(String(48))
    text: Mapped[str] = mapped_column(String(500))

    actor: Mapped["User | None"] = relationship()


class StaffNotification(Base):
    """Уведомление сотруднику внутри SchoolOS (колокольчик) — дублируется в Telegram, если указан chat_id."""

    __tablename__ = "staff_notifications"
    __table_args__ = (Index("ix_staff_notifications_user_read", "user_id", "read_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str | None] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(255))  # путь во фронтенде, напр. /students/12
    read_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

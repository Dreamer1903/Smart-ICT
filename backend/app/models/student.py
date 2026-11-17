from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UTCDateTime, str_enum, utcnow
from app.models.enums import StudentStatus

if TYPE_CHECKING:
    from app.models.presence import StudentPresenceState
    from app.models.school import SchoolClass


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), index=True)
    full_name_latin: Mapped[str | None] = mapped_column(String(255))  # как в HikCentral / документах
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="RESTRICT"), index=True)
    rfid_card_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    parent_phone: Mapped[str | None] = mapped_column(String(32))
    parent_telegram_chat_id: Mapped[str | None] = mapped_column(String(64))
    # Внешние идентификаторы интеграций
    external_1c_id: Mapped[str | None] = mapped_column(String(64), unique=True)  # лицевой счёт / договор в 1С
    hik_person_id: Mapped[str | None] = mapped_column(String(64), unique=True)  # personId в HikCentral

    # Анкета и жизненный цикл
    status: Mapped[StudentStatus] = mapped_column(
        str_enum(StudentStatus, "student_status"), default=StudentStatus.ACTIVE, server_default="ACTIVE", index=True
    )
    birth_date: Mapped[date | None] = mapped_column(Date)
    admission_date: Mapped[date | None] = mapped_column(Date)  # дата поступления
    notes: Mapped[str | None] = mapped_column(Text)
    # Пансионат: None — классный руководитель ещё не отметил
    is_boarder: Mapped[bool | None] = mapped_column(Boolean)
    boarding_room: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=utcnow)

    school_class: Mapped["SchoolClass"] = relationship(back_populates="students")
    presence: Mapped["StudentPresenceState | None"] = relationship(
        back_populates="student", uselist=False, cascade="all, delete-orphan"
    )
    guardians: Mapped[list["Guardian"]] = relationship(
        back_populates="student", cascade="all, delete-orphan", order_by="Guardian.id"
    )


class Guardian(Base):
    """Родитель / законный представитель."""

    __tablename__ = "guardians"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    relation: Mapped[str | None] = mapped_column(String(32))  # мать, отец, опекун…
    phone: Mapped[str | None] = mapped_column(String(32))
    telegram_chat_id: Mapped[str | None] = mapped_column(String(64))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)  # основной контакт для уведомлений

    student: Mapped["Student"] = relationship(back_populates="guardians")

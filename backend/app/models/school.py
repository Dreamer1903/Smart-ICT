"""Справочники: классы (учебные группы), кабинеты, предметы."""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.student import Student
    from app.models.user import User


class ClassRoom(Base):
    """Физический кабинет, например №204 «Кабинет информатики»."""

    __tablename__ = "classrooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(16), unique=True)
    name: Mapped[str] = mapped_column(String(255))


class SchoolClass(Base):
    """Учебный класс, например 9"А"."""

    __tablename__ = "school_classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(32), unique=True)
    grade_level: Mapped[int] = mapped_column(Integer, index=True)
    homeroom_teacher_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    curator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))  # куратор класса
    classroom_id: Mapped[int | None] = mapped_column(ForeignKey("classrooms.id", ondelete="SET NULL"))

    students: Mapped[list["Student"]] = relationship(back_populates="school_class")
    homeroom_teacher: Mapped["User | None"] = relationship(foreign_keys=[homeroom_teacher_id])
    classroom: Mapped[ClassRoom | None] = relationship()


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    short_name: Mapped[str | None] = mapped_column(String(16))
    # Предмет идёт только в своём кабинете (биология, информатика, физика): кабинет один —
    # значит такие уроки не могут стоять параллельно в разных классах.
    room_id: Mapped[int | None] = mapped_column(ForeignKey("classrooms.id", ondelete="SET NULL"))

    room: Mapped[ClassRoom | None] = relationship()

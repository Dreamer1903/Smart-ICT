from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.presence import StudentPresenceState
    from app.models.school import SchoolClass


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="RESTRICT"), index=True)
    rfid_card_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    parent_phone: Mapped[str | None] = mapped_column(String(32))
    parent_telegram_chat_id: Mapped[str | None] = mapped_column(String(64))
    # Внешние идентификаторы интеграций
    external_1c_id: Mapped[str | None] = mapped_column(String(64), unique=True)  # лицевой счёт / договор в 1С
    robi_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    hik_person_id: Mapped[str | None] = mapped_column(String(64), unique=True)  # personId в HikCentral

    school_class: Mapped["SchoolClass"] = relationship(back_populates="students")
    presence: Mapped["StudentPresenceState | None"] = relationship(
        back_populates="student", uselist=False, cascade="all, delete-orphan"
    )

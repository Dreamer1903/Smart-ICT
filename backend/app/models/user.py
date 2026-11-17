from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UTCDateTime, str_enum, utcnow
from app.models.enums import UserRole


class User(Base):
    """Сотрудник школы с доступом в систему (RBAC по полю role)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(str_enum(UserRole, "user_role"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    phone: Mapped[str | None] = mapped_column(String(32))
    hashed_password: Mapped[str] = mapped_column(String(255))
    telegram_chat_id: Mapped[str | None] = mapped_column(String(64))  # для уведомлений сотруднику
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True)  # ID Google-аккаунта (привязывается при первом входе)
    # Учётная запись ученика (роль Student). use_alter — разрывает цикл users ↔ students при создании/удалении схемы.
    student_id: Mapped[int | None] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE", use_alter=True, name="fk_users_student_id_students")
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

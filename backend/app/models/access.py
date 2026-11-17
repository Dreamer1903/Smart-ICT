"""Модели контура контроля доступа: идентификаторы, устройства, журнал решений,
временные пропуска, кэш статуса оплаты из 1С и outbox для внешних систем."""

from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, Date, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UTCDateTime, str_enum, utcnow
from app.models.enums import (
    AccessDecision,
    AccessReason,
    CredentialKind,
    DeviceAdapter,
    GateDirection,
    OutboxStatus,
)

if TYPE_CHECKING:
    from app.models.student import Student
    from app.models.user import User


class StudentCredential(Base):
    """Идентификатор ученика: RFID-карта, QR-код или ID биометрического шаблона на контроллере."""

    __tablename__ = "student_credentials"
    __table_args__ = (UniqueConstraint("kind", "value", name="uq_student_credentials_kind_value"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    kind: Mapped[CredentialKind] = mapped_column(str_enum(CredentialKind, "credential_kind"))
    value: Mapped[str] = mapped_column(String(128))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    student: Mapped["Student"] = relationship()


class AccessDevice(Base):
    """Контроллер доступа (турникет / группа турникетов)."""

    __tablename__ = "access_devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True)  # идентификатор, который шлёт контроллер
    name: Mapped[str] = mapped_column(String(128))
    location: Mapped[str | None] = mapped_column(String(128))
    adapter: Mapped[DeviceAdapter] = mapped_column(
        str_enum(DeviceAdapter, "device_adapter"), default=DeviceAdapter.RESPONSE
    )
    command_url: Mapped[str | None] = mapped_column(String(512))  # для adapter=HTTP
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True)  # doorIndexCode в HikCentral
    default_direction: Mapped[GateDirection | None] = mapped_column(
        str_enum(GateDirection, "device_direction")
    )  # если дверь работает только на вход или только на выход
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class AccessEvent(Base):
    """Журнал решений о проходе (append-only): и разрешения, и отказы."""

    __tablename__ = "access_events"
    __table_args__ = (Index("ix_access_events_student_time", "student_id", "occurred_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    device_id: Mapped[int | None] = mapped_column(ForeignKey("access_devices.id", ondelete="SET NULL"))
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"))
    credential_kind: Mapped[CredentialKind | None] = mapped_column(str_enum(CredentialKind, "event_credential_kind"))
    credential_value: Mapped[str | None] = mapped_column(String(128))
    direction: Mapped[GateDirection] = mapped_column(str_enum(GateDirection, "event_direction"))
    decision: Mapped[AccessDecision] = mapped_column(str_enum(AccessDecision, "access_decision"), index=True)
    reason: Mapped[AccessReason] = mapped_column(str_enum(AccessReason, "access_reason"))
    debt_amount: Mapped[float | None] = mapped_column(Float)
    payment_source: Mapped[str | None] = mapped_column(String(16))  # 1c | cache | stale_cache | none
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    command_status: Mapped[str | None] = mapped_column(String(32))  # in_response | sent | failed | not_connected
    message: Mapped[str | None] = mapped_column(String(255))
    # Для событий из внешней СКУД (HikCentral): id события (дедупликация) и сырой тип события
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    external_event_type: Mapped[int | None] = mapped_column(Integer)

    student: Mapped["Student | None"] = relationship()
    device: Mapped[AccessDevice | None] = relationship()


class AccessOverride(Base):
    """Временный пропуск: разрешает вход несмотря на задолженность (решение администрации)."""

    __tablename__ = "access_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    valid_from: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    valid_until: Mapped[datetime] = mapped_column(UTCDateTime)
    reason: Mapped[str] = mapped_column(String(255))
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    created_by: Mapped["User | None"] = relationship()


class PaymentStatusRecord(Base):
    """Последний известный финансовый статус ученика из 1С (кэш + источник для fallback)."""

    __tablename__ = "payment_statuses"

    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), primary_key=True)
    has_debt: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    debt_amount: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(8), default="UZS")
    paid_until: Mapped[date | None] = mapped_column(Date)
    checked_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)  # последний УСПЕШНЫЙ ответ 1С
    last_error: Mapped[str | None] = mapped_column(String(255))
    last_error_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class OutboxMessage(Base):
    """Transactional outbox: сообщения во внешние системы (Telegram, SMS) с повторами.

    Пишется в той же транзакции, что и бизнес-событие, — ни одно событие не теряется,
    даже если внешняя система недоступна.
    """

    __tablename__ = "outbox_messages"
    __table_args__ = (Index("ix_outbox_status_next", "status", "next_attempt_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    channel: Mapped[str] = mapped_column(String(32), index=True)  # telegram | sms | log | hik
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    status: Mapped[OutboxStatus] = mapped_column(str_enum(OutboxStatus, "outbox_status"), default=OutboxStatus.PENDING)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    sent_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class HikAccessState(Base):
    """Что SchoolOS последним успешно применил в HikCentral для ученика."""

    __tablename__ = "hik_access_states"

    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), primary_key=True)
    full_access: Mapped[bool | None] = mapped_column(Boolean)  # True — вход+выход, False — только выход
    pending: Mapped[bool | None] = mapped_column(Boolean)  # целевое состояние, ожидающее применения
    queued: Mapped[bool] = mapped_column(Boolean, default=False)  # задача уже в outbox
    synced_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    last_error: Mapped[str | None] = mapped_column(String(255))


class IntegrationCursor(Base):
    """Курсоры опроса внешних систем (напр. время последнего события HikCentral)."""

    __tablename__ = "integration_cursors"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

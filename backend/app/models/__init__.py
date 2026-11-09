"""Импорт всех моделей — нужен Alembic (autogenerate) и Base.metadata.create_all."""

from app.models.access import (
    AccessDevice,
    AccessEvent,
    AccessOverride,
    OutboxMessage,
    PaymentStatusRecord,
    StudentCredential,
)
from app.models.enums import (
    AccessDecision,
    AccessReason,
    CredentialKind,
    DeviceAdapter,
    GateDirection,
    LocationStatus,
    NurseOutcome,
    OutboxStatus,
    UserRole,
)
from app.models.nurse import NurseVisit
from app.models.presence import StudentPresenceState
from app.models.school import ClassRoom, SchoolClass, Subject
from app.models.student import Student
from app.models.turnstile import TurnstileLog
from app.models.user import User

__all__ = [
    "AccessDecision",
    "AccessDevice",
    "AccessEvent",
    "AccessOverride",
    "AccessReason",
    "CredentialKind",
    "DeviceAdapter",
    "OutboxMessage",
    "OutboxStatus",
    "PaymentStatusRecord",
    "StudentCredential",
    "ClassRoom",
    "GateDirection",
    "LocationStatus",
    "NurseOutcome",
    "NurseVisit",
    "SchoolClass",
    "Student",
    "StudentPresenceState",
    "Subject",
    "TurnstileLog",
    "User",
    "UserRole",
]

"""Импорт всех моделей — нужен Alembic (autogenerate) и Base.metadata.create_all."""

from app.models.access import (
    AccessDevice,
    AccessEvent,
    AccessOverride,
    HikAccessState,
    IntegrationCursor,
    OutboxMessage,
    PaymentStatusRecord,
    StudentCredential,
)
from app.models.enrollment import Enrollment, EnrollmentStep, StaffNotification, StudentTimelineEvent
from app.models.enums import (
    AccessDecision,
    AccessReason,
    CredentialKind,
    DeviceAdapter,
    EnrollmentStatus,
    EnrollmentStepKind,
    GateDirection,
    LocationStatus,
    NurseOutcome,
    OutboxStatus,
    StepStatus,
    StudentStatus,
    UserRole,
)
from app.models.nurse import NurseVisit
from app.models.presence import StudentPresenceState
from app.models.school import ClassRoom, SchoolClass, Subject
from app.models.student import Guardian, Student
from app.models.turnstile import TurnstileLog
from app.models.user import User

__all__ = [
    "Enrollment",
    "EnrollmentStatus",
    "EnrollmentStep",
    "EnrollmentStepKind",
    "Guardian",
    "StaffNotification",
    "StepStatus",
    "StudentStatus",
    "StudentTimelineEvent",
    "AccessDecision",
    "AccessDevice",
    "AccessEvent",
    "AccessOverride",
    "AccessReason",
    "CredentialKind",
    "DeviceAdapter",
    "HikAccessState",
    "IntegrationCursor",
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

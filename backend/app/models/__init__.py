"""Импорт всех моделей — нужен Alembic (autogenerate) и Base.metadata.create_all."""

from app.models.enums import GateDirection, LocationStatus, NurseOutcome, UserRole
from app.models.nurse import NurseVisit
from app.models.presence import StudentPresenceState
from app.models.school import ClassRoom, SchoolClass, Subject
from app.models.student import Student
from app.models.turnstile import TurnstileLog
from app.models.user import User

__all__ = [
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

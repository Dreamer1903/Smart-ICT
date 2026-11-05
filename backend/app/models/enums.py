"""Перечисления доменной модели. Значения — то, что хранится в БД и уходит в API."""

from enum import StrEnum


class UserRole(StrEnum):
    SUPER_ADMIN = "SuperAdmin"
    DIRECTOR = "Director"
    ZAVUCH = "Zavuch"
    TEACHER = "Teacher"
    NURSE = "Nurse"
    DUTY_TEACHER = "DutyTeacher"


class GateDirection(StrEnum):
    IN = "IN"
    OUT = "OUT"


class NurseOutcome(StrEnum):
    RESTING = "RESTING"  # «На осмотре»
    SENT_HOME = "SENT_HOME"  # «Освобождён / Домой»
    RETURNED_TO_CLASS = "RETURNED_TO_CLASS"  # «Вернулся на урок»


class LocationStatus(StrEnum):
    IN_BUILDING = "IN_BUILDING"  # прошёл турникет, но не в классе
    IN_CLASS = "IN_CLASS"
    IN_NURSE = "IN_NURSE"
    LEFT_SCHOOL = "LEFT_SCHOOL"
    UNKNOWN = "UNKNOWN"  # сегодня ещё не появлялся

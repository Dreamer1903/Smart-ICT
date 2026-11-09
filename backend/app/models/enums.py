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


class CredentialKind(StrEnum):
    RFID = "RFID"
    QR = "QR"
    BIOMETRIC = "BIOMETRIC"


class AccessDecision(StrEnum):
    GRANTED = "GRANTED"
    DENIED = "DENIED"


class AccessReason(StrEnum):
    OK = "OK"  # оплата в порядке
    EXIT_ALWAYS_ALLOWED = "EXIT_ALWAYS_ALLOWED"  # выход не блокируется никогда (безопасность)
    OVERRIDE = "OVERRIDE"  # временный пропуск от администрации
    PAYMENT_CACHED = "PAYMENT_CACHED"  # 1С недоступна, решение по последнему известному статусу
    PAYMENT_UNAVAILABLE_ALLOWED = "PAYMENT_UNAVAILABLE_ALLOWED"  # 1С недоступна, политика allow
    REOPENED_AFTER_PAYMENT = "REOPENED_AFTER_PAYMENT"  # оплата пришла, пока ученик стоял у турникета
    DEBT = "DEBT"
    UNKNOWN_CREDENTIAL = "UNKNOWN_CREDENTIAL"
    PAYMENT_UNAVAILABLE_DENIED = "PAYMENT_UNAVAILABLE_DENIED"


class DeviceAdapter(StrEnum):
    """Как SchoolOS доставляет команду OPEN/DENY контроллеру."""

    RESPONSE = "RESPONSE"  # решение возвращается в ответе на HTTP-запрос контроллера
    HTTP = "HTTP"  # SchoolOS делает POST на command_url контроллера
    WEBSOCKET = "WEBSOCKET"  # контроллер держит WebSocket с SchoolOS
    TCP = "TCP"  # контроллер держит TCP-соединение (JSON lines)


class OutboxStatus(StrEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"

"""Перечисления доменной модели. Значения — то, что хранится в БД и уходит в API."""

from enum import StrEnum


class UserRole(StrEnum):
    SUPER_ADMIN = "SuperAdmin"
    DIRECTOR = "Director"
    ZAVUCH = "Zavuch"
    TEACHER = "Teacher"
    NURSE = "Nurse"
    DUTY_TEACHER = "DutyTeacher"
    PARENT_RELATIONS = "ParentRelations"  # завуч по работе с родителями
    ADMISSIONS = "Admissions"  # менеджер по приёму учеников
    CASHIER = "Cashier"  # кассир / бухгалтерия
    ZAVUCH_ACADEMIC = "ZavuchAcademic"  # завуч по учебной части (расписание, журнал)
    ZAVUCH_UPBRINGING = "ZavuchUpbringing"  # завуч по воспитательной части (посещаемость, опоздания)
    STUDENT = "Student"
    PARENT = "Parent"
    STAFF = "Staff"  # сотрудник, роль ещё не назначена (доступа к разделам нет)


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
    IN_BOARDING = "IN_BOARDING"  # в пансионате (пансионат находится в здании школы)
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
    TERMINAL_GRANTED = "TERMINAL_GRANTED"  # терминал (HikCentral) пропустил по своему уровню доступа
    DEBT = "DEBT"
    UNKNOWN_CREDENTIAL = "UNKNOWN_CREDENTIAL"
    PAYMENT_UNAVAILABLE_DENIED = "PAYMENT_UNAVAILABLE_DENIED"
    TERMINAL_DENIED = "TERMINAL_DENIED"  # терминал отказал (лицо/ладонь не распознаны, нет прав и т.п.)


class DeviceAdapter(StrEnum):
    """Как SchoolOS доставляет команду OPEN/DENY контроллеру."""

    RESPONSE = "RESPONSE"  # решение возвращается в ответе на HTTP-запрос контроллера
    HTTP = "HTTP"  # SchoolOS делает POST на command_url контроллера
    WEBSOCKET = "WEBSOCKET"  # контроллер держит WebSocket с SchoolOS
    TCP = "TCP"  # контроллер держит TCP-соединение (JSON lines)
    HIKCENTRAL = "HIKCENTRAL"  # дверь под управлением HikCentral: решение принимает терминал по уровням доступа


class OutboxStatus(StrEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class StudentStatus(StrEnum):
    ENROLLING = "ENROLLING"  # идёт приём: ещё не все этапы закрыты
    ACTIVE = "ACTIVE"  # учится
    WITHDRAWN = "WITHDRAWN"  # выбыл


class EnrollmentStatus(StrEnum):
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class EnrollmentStepKind(StrEnum):
    REGISTRATION = "REGISTRATION"  # анкета и родители (менеджер / завуч по работе с родителями)
    PAYMENT_SETUP = "PAYMENT_SETUP"  # лицевой счёт 1С и договор (кассир)
    CLASS_ACCEPTANCE = "CLASS_ACCEPTANCE"  # принят в класс + пансионат (классный руководитель)
    ACCESS_SETUP = "ACCESS_SETUP"  # лицо / ладонь в HikCentral (администратор СКУД)


class StepStatus(StrEnum):
    PENDING = "PENDING"
    DONE = "DONE"


class TimetableStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class ProposalStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class AttendanceMark(StrEnum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE = "LATE"
    EXCUSED = "EXCUSED"  # отсутствует по уважительной причине


class GradeKind(StrEnum):
    CLASSWORK = "CLASSWORK"  # работа на уроке
    HOMEWORK = "HOMEWORK"
    ORAL = "ORAL"  # устный ответ
    TEST = "TEST"  # самостоятельная / тест
    CONTROL = "CONTROL"  # контрольная


class PeriodCode(StrEnum):
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"
    H1 = "H1"  # 1-е полугодие
    H2 = "H2"
    YEAR = "YEAR"
    FINAL = "FINAL"  # итоговая аттестация


class MaterialKind(StrEnum):
    LESSON_PLAN = "LESSON_PLAN"  # поурочный план
    OUTLINE = "OUTLINE"  # план-конспект
    BOOK = "BOOK"
    CARDS = "CARDS"  # карточки
    PRESENTATION = "PRESENTATION"
    OTHER = "OTHER"


class Visibility(StrEnum):
    PRIVATE = "PRIVATE"  # только автор
    TEACHERS = "TEACHERS"  # все учителя
    ALL = "ALL"  # учителя и ученики


class DutyStatus(StrEnum):
    PLANNED = "PLANNED"  # назначен
    STARTED = "STARTED"  # отсканировал QR на посту
    MISSED = "MISSED"  # смена закончилась, отметки нет

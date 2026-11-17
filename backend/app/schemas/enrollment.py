from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import (
    EnrollmentStatus,
    EnrollmentStepKind,
    GateDirection,
    LocationStatus,
    StepStatus,
    StudentStatus,
    UserRole,
)


class GuardianIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    relation: str | None = Field(default=None, examples=["мать"])
    phone: str | None = Field(default=None, examples=["+998901234567"])
    telegram_chat_id: str | None = None
    is_primary: bool = False


class GuardianOut(GuardianIn):
    id: int


class RegistrationIn(BaseModel):
    full_name: str = Field(min_length=3, max_length=255)
    class_id: int
    birth_date: date | None = None
    admission_date: date | None = None
    notes: str | None = None
    guardians: list[GuardianIn] = Field(min_length=1)


class StepCompleteIn(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict, examples=[{"external_1c_id": "LS-0021", "contract_number": "Д-2026/021"}])
    comment: str | None = None


class StepOut(BaseModel):
    kind: EnrollmentStepKind
    label: str
    status: StepStatus
    assignee_role: UserRole
    assignee_name: str | None
    completed_by_name: str | None
    completed_at: datetime | None
    comment: str | None
    data: dict[str, Any] | None
    can_complete: bool  # может ли текущий пользователь закрыть этап


class EnrollmentStudentOut(BaseModel):
    id: int
    full_name: str
    class_id: int
    class_name: str
    birth_date: date | None
    status: StudentStatus


class EnrollmentOut(BaseModel):
    id: int
    status: EnrollmentStatus
    created_at: datetime
    completed_at: datetime | None
    created_by_name: str | None
    student: EnrollmentStudentOut
    steps: list[StepOut]
    done_steps: int
    total_steps: int
    my_pending: bool  # есть этап, который ждёт текущего пользователя


class StudentPatch(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=255)
    class_id: int | None = None
    birth_date: date | None = None
    is_boarder: bool | None = None
    boarding_room: str | None = None
    notes: str | None = None
    parent_telegram_chat_id: str | None = None


class TimelineOut(BaseModel):
    at: datetime
    kind: str
    text: str
    actor_name: str | None


class DayOut(BaseModel):
    date: date
    first_in: datetime | None
    last_out: datetime | None
    passes: int
    late: bool


class CardEventOut(BaseModel):
    occurred_at: datetime
    direction: GateDirection
    decision: str
    reason_label: str
    device_name: str | None


class CardNurseOut(BaseModel):
    start_time: datetime
    end_time: datetime | None
    reason: str
    outcome: str


class CardPaymentOut(BaseModel):
    has_debt: bool
    debt_amount: float
    currency: str
    paid_until: date | None
    checked_at: datetime


class StudentCardOut(BaseModel):
    id: int
    full_name: str
    status: StudentStatus
    class_id: int
    class_name: str
    homeroom_teacher: str | None
    birth_date: date | None
    admission_date: date | None
    is_boarder: bool | None
    boarding_room: str | None
    notes: str | None
    external_1c_id: str | None
    hik_person_id: str | None
    rfid_card_id: str | None
    guardians: list[GuardianOut]
    presence_status: LocationStatus
    presence_note: str | None
    presence_since: datetime | None
    is_discrepancy: bool
    payment: CardPaymentOut | None  # только для ролей с доступом к финансам
    enrollment: EnrollmentOut | None
    history: list[DayOut]
    recent_events: list[CardEventOut]
    nurse_visits: list[CardNurseOut]
    timeline: list[TimelineOut]


class NotificationOut(BaseModel):
    id: int
    created_at: datetime
    title: str
    body: str | None
    link: str | None
    read: bool


class NotificationsOut(BaseModel):
    unread: int
    items: list[NotificationOut]


class AttendanceRowOut(BaseModel):
    student_id: int
    full_name: str
    class_id: int
    class_name: str
    is_boarder: bool
    first_in: datetime | None
    last_out: datetime | None
    passes: int
    denied: int
    late: bool
    came: bool


class AttendanceSummary(BaseModel):
    total: int
    came: int
    late: int
    absent: int  # не пришли (кроме пансионеров)
    boarders: int


class AttendanceReportOut(BaseModel):
    date: date
    school_start_time: str
    summary: AttendanceSummary
    rows: list[AttendanceRowOut]

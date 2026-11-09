from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import AccessDecision, AccessReason, CredentialKind, DeviceAdapter, GateDirection


class AccessEventIn(BaseModel):
    """Событие от контроллера: ученик приложил карту / QR / прошёл биометрию."""

    device_code: str = Field(examples=["main-entrance-1"])
    direction: GateDirection
    credential_kind: CredentialKind | None = CredentialKind.RFID
    credential_value: str | None = Field(default=None, examples=["RFID-0001"])
    student_id: int | None = None
    timestamp: datetime | None = None

    @model_validator(mode="after")
    def _identity(self) -> "AccessEventIn":
        if not self.credential_value and self.student_id is None:
            raise ValueError("Нужно указать credential_value или student_id")
        return self


class AccessDecisionOut(BaseModel):
    event_id: int
    decision: AccessDecision
    reason: AccessReason
    command: str  # OPEN | DENY — то, что контроллер должен выполнить
    display_text: str | None
    student_id: int | None
    student_name: str | None
    class_name: str | None
    latency_ms: int | None
    command_status: str | None


class AccessEventOut(BaseModel):
    id: int
    occurred_at: datetime
    device_code: str | None
    device_name: str | None
    student_id: int | None
    student_name: str | None
    class_name: str | None
    credential_kind: CredentialKind | None
    credential_value: str | None
    direction: GateDirection
    decision: AccessDecision
    reason: AccessReason
    reason_label: str
    debt_amount: float | None
    payment_source: str | None
    latency_ms: int | None
    command_status: str | None


class DebtorOut(BaseModel):
    student_id: int
    full_name: str
    class_name: str
    external_1c_id: str | None
    debt_amount: float
    currency: str
    paid_until: date | None
    checked_at: datetime
    last_error: str | None
    override_id: int | None
    override_until: datetime | None
    denied_today: int
    hik_person_id: str | None = None
    hik_full_access: bool | None = None  # что применено в HikCentral
    hik_pending: bool | None = None  # что нужно применить (в режиме наблюдения — не применяется)
    hik_error: str | None = None


class OverrideIn(BaseModel):
    student_id: int
    reason: str = Field(min_length=1, max_length=255, examples=["Обещание оплаты до пятницы"])
    valid_until: datetime | None = None
    hours: int = Field(default=24, ge=1, le=24 * 31)


class OverrideOut(BaseModel):
    id: int
    student_id: int
    valid_from: datetime
    valid_until: datetime
    reason: str
    created_by_id: int | None
    revoked_at: datetime | None


class PaymentCheckOut(BaseModel):
    student_id: int
    has_debt: bool | None
    debt_amount: float | None
    source: str
    error: str | None
    reopened_event_id: int | None = None


class IntegrationHealthOut(BaseModel):
    name: str
    healthy: bool | None
    last_ok_at: datetime | None
    last_error_at: datetime | None
    last_error: str | None
    calls: int
    errors: int


class DeviceOut(BaseModel):
    id: int
    code: str
    name: str
    location: str | None
    adapter: DeviceAdapter
    command_url: str | None
    is_active: bool
    last_seen_at: datetime | None
    connected: bool
    default_direction: GateDirection | None = None


class DeviceIn(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    location: str | None = None
    adapter: DeviceAdapter = DeviceAdapter.RESPONSE
    command_url: str | None = None


class DevicePatch(BaseModel):
    name: str | None = None
    location: str | None = None
    default_direction: GateDirection | None = None
    is_active: bool | None = None


class AccessSummary(BaseModel):
    entries: int
    exits: int
    denied: int
    denied_debt: int
    unknown_credentials: int
    debtors: int
    active_overrides: int
    outbox_pending: int
    outbox_failed: int
    avg_latency_ms: float | None
    integrations: list[IntegrationHealthOut]
    devices: list[DeviceOut]


class OneCPaymentWebhook(BaseModel):
    """Вебхук из 1С при поступлении оплаты. Если debt не передан — SchoolOS сам перезапросит баланс."""

    account: str
    debt: float | None = None
    currency: str = "UZS"
    paid_until: date | None = None


class HikStatus(BaseModel):
    enabled: bool
    enforce: bool
    event_mode: str
    full_access_group_id: str
    exit_only_group_id: str
    linked_students: int
    total_students: int
    would_revoke: int  # должники, у которых в HikCentral ещё полный доступ
    would_grant: int
    queued: int
    last_event_cursor: str | None
    seen_event_types: dict[str, int]

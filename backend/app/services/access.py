"""Service Access Control: решение «пустить / не пустить» по каждому событию контроллера.

Алгоритм:
  1. Определить ученика по идентификатору (RFID / QR / биометрия).
  2. Выход (OUT) разрешается всегда — ребёнка нельзя «запереть» в здании.
  3. Активный временный пропуск → разрешить.
  4. Запрос статуса оплаты в 1С (кэш TTL; при недоступности — политика cache/allow/deny).
  5. Нет долга → OPEN, есть долг → DENY.
  6. Журнал решения, обновление Live-статуса, outbox → Robi и уведомления, событие в шину.
"""

import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.events import DomainEvent, enqueue_event
from app.db.base import utcnow
from app.models import (
    AccessDecision,
    AccessDevice,
    AccessEvent,
    AccessOverride,
    AccessReason,
    CredentialKind,
    GateDirection,
    LocationStatus,
    Student,
    StudentCredential,
)
from app.services import outbox, presence
from app.services.payment import PaymentCheck, check_payment

# Текст для экрана турникета. Сумму долга публично НЕ показываем (персональные данные).
DISPLAY_TEXT: dict[AccessReason, str] = {
    AccessReason.OK: "Проход разрешён",
    AccessReason.EXIT_ALWAYS_ALLOWED: "До свидания!",
    AccessReason.OVERRIDE: "Проход разрешён (временный пропуск)",
    AccessReason.PAYMENT_CACHED: "Проход разрешён",
    AccessReason.PAYMENT_UNAVAILABLE_ALLOWED: "Проход разрешён",
    AccessReason.REOPENED_AFTER_PAYMENT: "Оплата получена, проходите",
    AccessReason.DEBT: "Доступ ограничен. Обратитесь в администрацию",
    AccessReason.UNKNOWN_CREDENTIAL: "Карта не зарегистрирована",
    AccessReason.PAYMENT_UNAVAILABLE_DENIED: "Проверка недоступна. Обратитесь к охране",
    AccessReason.TERMINAL_GRANTED: "Проход разрешён",
    AccessReason.TERMINAL_DENIED: "Проход не выполнен",
}

REASON_LABEL: dict[AccessReason, str] = {
    AccessReason.OK: "Оплата в порядке",
    AccessReason.EXIT_ALWAYS_ALLOWED: "Выход разрешён всегда",
    AccessReason.OVERRIDE: "Временный пропуск",
    AccessReason.PAYMENT_CACHED: "1С недоступна — по последнему статусу",
    AccessReason.PAYMENT_UNAVAILABLE_ALLOWED: "1С недоступна — пропущен по политике",
    AccessReason.REOPENED_AFTER_PAYMENT: "Открыт после поступления оплаты",
    AccessReason.DEBT: "Задолженность по оплате",
    AccessReason.UNKNOWN_CREDENTIAL: "Неизвестный идентификатор",
    AccessReason.PAYMENT_UNAVAILABLE_DENIED: "1С недоступна — отказ по политике",
    AccessReason.TERMINAL_GRANTED: "Пропущен терминалом",
    AccessReason.TERMINAL_DENIED: "Отказ терминала",
}


class DeviceNotFoundError(Exception):
    pass


@dataclass(slots=True)
class AccessRequest:
    device_code: str
    direction: GateDirection
    credential_kind: CredentialKind | None = None
    credential_value: str | None = None
    student_id: int | None = None  # прямое указание (симулятор/ручной пропуск)
    timestamp: datetime | None = None


@dataclass(slots=True)
class AccessResult:
    event: AccessEvent
    device: AccessDevice
    student: Student | None

    @property
    def command(self) -> dict[str, object]:
        """Команда контроллеру (одинаковый формат для REST-ответа, HTTP, WS и TCP)."""
        granted = self.event.decision is AccessDecision.GRANTED
        return {
            "type": "command",
            "event_id": self.event.id,
            "command": "OPEN" if granted else "DENY",
            "direction": self.event.direction.value,
            "display_text": self.event.message,
            "student_name": self.student.full_name if self.student and granted else None,
        }


async def _resolve_student(session: AsyncSession, req: AccessRequest) -> Student | None:
    if req.student_id is not None:
        return await session.get(Student, req.student_id)
    if not req.credential_value:
        return None
    stmt = select(StudentCredential).options(selectinload(StudentCredential.student)).where(
        StudentCredential.value == req.credential_value, StudentCredential.is_active.is_(True)
    )
    if req.credential_kind is not None:
        stmt = stmt.where(StudentCredential.kind == req.credential_kind)
    cred = (await session.execute(stmt.limit(1))).scalar_one_or_none()
    return cred.student if cred else None


async def active_override(session: AsyncSession, student_id: int, at: datetime | None = None) -> AccessOverride | None:
    at = at or utcnow()
    return (
        await session.execute(
            select(AccessOverride)
            .where(
                AccessOverride.student_id == student_id,
                AccessOverride.revoked_at.is_(None),
                AccessOverride.valid_from <= at,
                AccessOverride.valid_until > at,
            )
            .limit(1)
        )
    ).scalar_one_or_none()


def _decide_by_payment(pay: PaymentCheck) -> tuple[AccessDecision, AccessReason]:
    if pay.has_debt is True:
        return AccessDecision.DENIED, AccessReason.DEBT
    if pay.has_debt is False:
        if pay.source == "stale_cache":
            if settings.payment_unavailable_policy == "deny":
                return AccessDecision.DENIED, AccessReason.PAYMENT_UNAVAILABLE_DENIED
            return AccessDecision.GRANTED, AccessReason.PAYMENT_CACHED
        return AccessDecision.GRANTED, AccessReason.OK
    # статус неизвестен
    if settings.payment_unavailable_policy == "deny":
        return AccessDecision.DENIED, AccessReason.PAYMENT_UNAVAILABLE_DENIED
    return AccessDecision.GRANTED, AccessReason.PAYMENT_UNAVAILABLE_ALLOWED


async def _record(
    session: AsyncSession,
    *,
    device: AccessDevice,
    student: Student | None,
    req_kind: CredentialKind | None,
    req_value: str | None,
    direction: GateDirection,
    decision: AccessDecision,
    reason: AccessReason,
    at: datetime,
    pay: PaymentCheck | None,
    started: float,
    external_id: str | None = None,
    external_event_type: int | None = None,
    notify_admin_unknown: bool = True,
) -> AccessEvent:
    event = AccessEvent(
        occurred_at=at,
        device_id=device.id,
        student_id=student.id if student else None,
        credential_kind=req_kind,
        credential_value=req_value,
        direction=direction,
        decision=decision,
        reason=reason,
        debt_amount=pay.debt_amount if pay else None,
        payment_source=pay.source if pay else None,
        latency_ms=int((time.perf_counter() - started) * 1000),
        message=DISPLAY_TEXT[reason],
        external_id=external_id,
        external_event_type=external_event_type,
    )
    session.add(event)
    await session.flush()

    time_str = at.astimezone(ZoneInfo(settings.school_timezone)).strftime("%H:%M")
    if decision is AccessDecision.GRANTED and student is not None:
        # Факт прохода → Live-статус (presence), Robi, родителям
        await presence.register_gate_pass(session, student.id, direction, at, gate_id=device.code)
        if settings.robi_enabled:
            outbox.enqueue(session, "robi", {
                "event_id": f"schoolos-{event.id}",
                "robi_student_id": student.robi_id,
                "student_external_id": student.external_1c_id,
                "direction": direction.value,
                "timestamp": at.isoformat(),
                "device": device.code,
            })
        kind = "entry" if direction is GateDirection.IN else "exit"
        verb = "пришёл(ла) в школу" if direction is GateDirection.IN else "вышел(ла) из школы"
        outbox.notify_parent(session, student, kind, f"{student.full_name} {verb} в {time_str}.")
    elif decision is AccessDecision.DENIED:
        if student is not None:
            # Причина отсутствия видна в «Пульсе школы» (если ученик ещё не в здании)
            state = await presence.get_or_create_state(session, student.id)
            if state.current_location_status in (LocationStatus.UNKNOWN, LocationStatus.LEFT_SCHOOL):
                await presence.set_status(
                    session, student.id, state.current_location_status,
                    note=f"Не пропущен турникетом в {time_str}: {REASON_LABEL[reason].lower()}",
                    source="access", at=at,
                )
            # Терминал может выдать серию отказов подряд — родителю пишем не чаще раза в 10 минут
            recent_deny = (await session.execute(
                select(AccessEvent.id).where(
                    AccessEvent.student_id == student.id, AccessEvent.decision == AccessDecision.DENIED,
                    AccessEvent.id != event.id, AccessEvent.occurred_at >= at - timedelta(minutes=10),
                ).limit(1)
            )).first()
        if student is not None and not recent_deny:
            outbox.notify_parent(
                session, student, "deny",
                f"{student.full_name}: в {time_str} проход в школу не выполнен — {REASON_LABEL[reason].lower()}. "
                "Пожалуйста, свяжитесь с администрацией школы.",
            )
            outbox.notify_admin(session, f"Отказ в проходе: {student.full_name} ({REASON_LABEL[reason]}), {device.name}")
        elif student is None and notify_admin_unknown:
            outbox.notify_admin(session, f"Неизвестный идентификатор {req_value} на {device.name} в {time_str}")

    enqueue_event(session, DomainEvent(type="access.decision", payload={
        "event_id": event.id,
        "student_id": event.student_id,
        "student_name": student.full_name if student else None,
        "device": device.code,
        "direction": direction.value,
        "decision": decision.value,
        "reason": reason.value,
    }))
    return event


async def handle_access_request(session: AsyncSession, req: AccessRequest) -> AccessResult:
    """Принять решение по событию контроллера. Коммит — на стороне вызывающего."""
    started = time.perf_counter()
    at = req.timestamp or utcnow()

    device = (
        await session.execute(select(AccessDevice).where(AccessDevice.code == req.device_code))
    ).scalar_one_or_none()
    if device is None or not device.is_active:
        raise DeviceNotFoundError(req.device_code)
    device.last_seen_at = utcnow()

    student = await _resolve_student(session, req)
    pay: PaymentCheck | None = None
    if student is None:
        decision, reason = AccessDecision.DENIED, AccessReason.UNKNOWN_CREDENTIAL
    elif req.direction is GateDirection.OUT and settings.access_always_allow_exit:
        decision, reason = AccessDecision.GRANTED, AccessReason.EXIT_ALWAYS_ALLOWED
    elif await active_override(session, student.id, at):
        decision, reason = AccessDecision.GRANTED, AccessReason.OVERRIDE
    else:
        pay, _ = await check_payment(session, student)
        decision, reason = _decide_by_payment(pay)

    event = await _record(
        session, device=device, student=student, req_kind=req.credential_kind, req_value=req.credential_value,
        direction=req.direction, decision=decision, reason=reason, at=at, pay=pay, started=started,
    )
    return AccessResult(event=event, device=device, student=student)


async def on_payment_received(session: AsyncSession, student: Student) -> AccessResult | None:
    """Оплата поступила: уведомить родителей и, если ученик только что получил отказ
    (окно REOPEN_AFTER_PAYMENT_WINDOW_MINUTES) и с тех пор не проходил, — открыть ему турникет."""
    outbox.notify_parent(session, student, "payment", f"Оплата за {student.full_name} получена. Доступ в школу открыт.")

    since = utcnow() - timedelta(minutes=settings.reopen_after_payment_window_minutes)
    last = (
        await session.execute(
            select(AccessEvent)
            .options(selectinload(AccessEvent.device))
            .where(AccessEvent.student_id == student.id, AccessEvent.direction == GateDirection.IN)
            .order_by(AccessEvent.occurred_at.desc(), AccessEvent.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if (
        last is None
        or last.decision is not AccessDecision.DENIED
        or last.reason is not AccessReason.DEBT
        or last.occurred_at < since
        or last.device is None
    ):
        return None

    event = await _record(
        session, device=last.device, student=student, req_kind=last.credential_kind, req_value=last.credential_value,
        direction=GateDirection.IN, decision=AccessDecision.GRANTED, reason=AccessReason.REOPENED_AFTER_PAYMENT,
        at=utcnow(), pay=None, started=time.perf_counter(),
    )
    return AccessResult(event=event, device=last.device, student=student)


async def deliver_command(session: AsyncSession, result: AccessResult) -> None:
    """После коммита: доставить команду контроллеру и записать статус доставки."""
    from app.integrations.registry import integrations

    result.event.command_status = await integrations.commander.send(result.device, result.command)
    await session.commit()

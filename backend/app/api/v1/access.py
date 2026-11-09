"""Service Access Control API: события контроллеров (REST / WebSocket) и панель администратора."""

import json
import logging
from datetime import datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import MANAGEMENT, CurrentUser, DbSession, gate_auth, require_roles
from app.core.config import settings
from app.core.events import commit_and_dispatch
from app.db.base import utcnow
from app.db.session import SessionLocal
from app.integrations.controllers import hub
from app.integrations.health import health
from app.models import (
    AccessDecision,
    AccessDevice,
    AccessEvent,
    AccessOverride,
    AccessReason,
    GateDirection,
    OutboxMessage,
    OutboxStatus,
    PaymentStatusRecord,
    Student,
)
from app.schemas.access import (
    AccessDecisionOut,
    AccessEventIn,
    AccessEventOut,
    AccessSummary,
    DebtorOut,
    DeviceIn,
    DeviceOut,
    IntegrationHealthOut,
    OverrideIn,
    OverrideOut,
    PaymentCheckOut,
)
from app.services import outbox
from app.services.access import (
    REASON_LABEL,
    AccessRequest,
    AccessResult,
    DeviceNotFoundError,
    deliver_command,
    handle_access_request,
    on_payment_received,
)
from app.services.payment import check_payment

logger = logging.getLogger("schoolos.access")
router = APIRouter(prefix="/access", tags=["access-control"])

ADMIN_VIEW = (*MANAGEMENT, )
Admin = Annotated[object, Depends(require_roles(*ADMIN_VIEW))]


def _decision_out(r: AccessResult) -> AccessDecisionOut:
    return AccessDecisionOut(
        event_id=r.event.id,
        decision=r.event.decision,
        reason=r.event.reason,
        command="OPEN" if r.event.decision is AccessDecision.GRANTED else "DENY",
        display_text=r.event.message,
        student_id=r.student.id if r.student else None,
        student_name=r.student.full_name if r.student else None,
        class_name=None,
        latency_ms=r.event.latency_ms,
        command_status=r.event.command_status,
    )


async def process_controller_event(body: AccessEventIn) -> tuple[AccessResult, AccessDecisionOut]:
    """Общий конвейер для REST, WebSocket и TCP: решение → коммит → команда → outbox."""
    async with SessionLocal() as session:
        try:
            result = await handle_access_request(session, AccessRequest(**body.model_dump()))
        except DeviceNotFoundError:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Устройство {body.device_code} не зарегистрировано") from None
        await commit_and_dispatch(session)
        await deliver_command(session, result)
        outbox.kick()
        out = _decision_out(result)
        if result.student is not None:
            cls = await session.execute(
                select(Student).options(selectinload(Student.school_class)).where(Student.id == result.student.id)
            )
            out.class_name = cls.scalar_one().school_class.name
        return result, out


@router.post("/events", response_model=AccessDecisionOut, summary="Событие контроллера → решение OPEN/DENY")
async def controller_event(body: AccessEventIn, _source: Annotated[str, Depends(gate_auth)]) -> AccessDecisionOut:
    """Контроллер сообщает об идентификации ученика и получает решение в ответе.

    Авторизация: `X-Gate-Api-Key` (контроллер) или JWT Director/Zavuch/DutyTeacher (симулятор).
    """
    _, out = await process_controller_event(body)
    return out


@router.websocket("/ws/{device_code}")
async def controller_ws(websocket: WebSocket, device_code: str, key: str = Query(...)) -> None:
    """Постоянное соединение контроллера. Вход: JSON AccessEventIn (без device_code);
    выход: {"type":"command", ...} — и в ответ на событие, и по инициативе SchoolOS."""
    if key != settings.gate_api_key:
        await websocket.close(code=4401)
        return
    await websocket.accept()

    async def sender(msg: dict) -> None:  # type: ignore[type-arg]
        await websocket.send_json(msg)

    hub.register(device_code, sender)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                body = AccessEventIn.model_validate({**json.loads(raw), "device_code": device_code})
                result, _ = await process_controller_event(body)
                if result.device.adapter.value not in ("WEBSOCKET",):
                    await websocket.send_json(result.command)  # иначе команда уже ушла через hub
            except (ValidationError, ValueError) as e:
                await websocket.send_json({"type": "error", "detail": str(e)[:500]})
            except HTTPException as e:
                await websocket.send_json({"type": "error", "detail": e.detail})
    except WebSocketDisconnect:
        pass
    finally:
        hub.unregister(device_code, sender)


# ---------------------------------------------------------------- Журнал и сводка

def _today_start() -> datetime:
    tz = ZoneInfo(settings.school_timezone)
    return datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)


def _event_out(e: AccessEvent) -> AccessEventOut:
    return AccessEventOut(
        id=e.id, occurred_at=e.occurred_at,
        device_code=e.device.code if e.device else None, device_name=e.device.name if e.device else None,
        student_id=e.student_id, student_name=e.student.full_name if e.student else None,
        class_name=e.student.school_class.name if e.student else None,
        credential_kind=e.credential_kind, credential_value=e.credential_value,
        direction=e.direction, decision=e.decision, reason=e.reason, reason_label=REASON_LABEL[e.reason],
        debt_amount=e.debt_amount, payment_source=e.payment_source,
        latency_ms=e.latency_ms, command_status=e.command_status,
    )


@router.get("/events", response_model=list[AccessEventOut])
async def list_events(
    db: DbSession,
    _: Admin,
    decision: AccessDecision | None = None,
    student_id: int | None = None,
    limit: Annotated[int, Query(le=500)] = 100,
) -> list[AccessEventOut]:
    stmt = (
        select(AccessEvent)
        .options(selectinload(AccessEvent.device),
                 selectinload(AccessEvent.student).selectinload(Student.school_class))
        .order_by(AccessEvent.occurred_at.desc(), AccessEvent.id.desc())
        .limit(limit)
    )
    if decision is not None:
        stmt = stmt.where(AccessEvent.decision == decision)
    if student_id is not None:
        stmt = stmt.where(AccessEvent.student_id == student_id)
    return [_event_out(e) for e in (await db.execute(stmt)).scalars()]


async def _devices(db: DbSession) -> list[DeviceOut]:
    devices = (await db.execute(select(AccessDevice).order_by(AccessDevice.code))).scalars()
    return [
        DeviceOut(id=d.id, code=d.code, name=d.name, location=d.location, adapter=d.adapter,
                  command_url=d.command_url, is_active=d.is_active, last_seen_at=d.last_seen_at,
                  connected=hub.is_connected(d.code))
        for d in devices
    ]


@router.get("/summary", response_model=AccessSummary)
async def summary(db: DbSession, _: Admin) -> AccessSummary:
    since = _today_start()
    rows = (
        await db.execute(
            select(AccessEvent.decision, AccessEvent.reason, AccessEvent.direction, func.count(), func.avg(AccessEvent.latency_ms))
            .where(AccessEvent.occurred_at >= since)
            .group_by(AccessEvent.decision, AccessEvent.reason, AccessEvent.direction)
        )
    ).all()
    entries = sum(c for d, _, dr, c, _ in rows if d is AccessDecision.GRANTED and dr is GateDirection.IN)
    exits = sum(c for d, _, dr, c, _ in rows if d is AccessDecision.GRANTED and dr is GateDirection.OUT)
    denied = sum(c for d, *_r, c, _ in rows if d is AccessDecision.DENIED)
    denied_debt = sum(c for _, r, _, c, _ in rows if r is AccessReason.DEBT)
    unknown = sum(c for _, r, _, c, _ in rows if r is AccessReason.UNKNOWN_CREDENTIAL)
    total = sum(c for *_r, c, _ in rows)
    avg = sum((a or 0) * c for *_r, c, a in rows) / total if total else None

    now = utcnow()
    debtors = await db.scalar(select(func.count()).select_from(PaymentStatusRecord).where(PaymentStatusRecord.has_debt.is_(True)))
    overrides = await db.scalar(select(func.count()).select_from(AccessOverride).where(
        AccessOverride.revoked_at.is_(None), AccessOverride.valid_until > now))
    pending = await db.scalar(select(func.count()).select_from(OutboxMessage).where(OutboxMessage.status == OutboxStatus.PENDING))
    failed = await db.scalar(select(func.count()).select_from(OutboxMessage).where(OutboxMessage.status == OutboxStatus.FAILED))

    return AccessSummary(
        entries=entries, exits=exits, denied=denied, denied_debt=denied_debt, unknown_credentials=unknown,
        debtors=debtors or 0, active_overrides=overrides or 0, outbox_pending=pending or 0, outbox_failed=failed or 0,
        avg_latency_ms=round(avg, 1) if avg is not None else None,
        integrations=[
            IntegrationHealthOut(name=s.name, healthy=s.healthy, last_ok_at=s.last_ok_at, last_error_at=s.last_error_at,
                                 last_error=s.last_error, calls=s.calls, errors=s.errors)
            for s in health.snapshot()
        ],
        devices=await _devices(db),
    )


# ---------------------------------------------------------------- Должники и пропуска

@router.get("/debtors", response_model=list[DebtorOut])
async def debtors(db: DbSession, _: Admin) -> list[DebtorOut]:
    now = utcnow()
    records = (
        await db.execute(
            select(PaymentStatusRecord, Student)
            .join(Student, Student.id == PaymentStatusRecord.student_id)
            .options(selectinload(Student.school_class))
            .where(PaymentStatusRecord.has_debt.is_(True))
            .order_by(PaymentStatusRecord.debt_amount.desc())
        )
    ).all()
    overrides = {
        o.student_id: o
        for o in (await db.execute(select(AccessOverride).where(
            AccessOverride.revoked_at.is_(None), AccessOverride.valid_until > now))).scalars()
    }
    denied = dict(
        (await db.execute(
            select(AccessEvent.student_id, func.count())
            .where(AccessEvent.reason == AccessReason.DEBT, AccessEvent.occurred_at >= _today_start())
            .group_by(AccessEvent.student_id)
        )).all()
    )
    return [
        DebtorOut(
            student_id=s.id, full_name=s.full_name, class_name=s.school_class.name, external_1c_id=s.external_1c_id,
            debt_amount=r.debt_amount, currency=r.currency, paid_until=r.paid_until, checked_at=r.checked_at,
            last_error=r.last_error,
            override_id=overrides[s.id].id if s.id in overrides else None,
            override_until=overrides[s.id].valid_until if s.id in overrides else None,
            denied_today=denied.get(s.id, 0),
        )
        for r, s in records
    ]


def _override_out(o: AccessOverride) -> OverrideOut:
    return OverrideOut(id=o.id, student_id=o.student_id, valid_from=o.valid_from, valid_until=o.valid_until,
                       reason=o.reason, created_by_id=o.created_by_id, revoked_at=o.revoked_at)


@router.post("/overrides", response_model=OverrideOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_roles(*MANAGEMENT))])
async def create_override(body: OverrideIn, db: DbSession, user: CurrentUser) -> OverrideOut:
    """Временный пропуск (решение директора/завуча), напр. при обещании оплаты."""
    if await db.get(Student, body.student_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ученик не найден")
    now = utcnow()
    o = AccessOverride(student_id=body.student_id, valid_from=now,
                       valid_until=body.valid_until or now + timedelta(hours=body.hours),
                       reason=body.reason, created_by_id=user.id)
    db.add(o)
    await db.commit()
    return _override_out(o)


@router.delete("/overrides/{override_id}", response_model=OverrideOut, dependencies=[Depends(require_roles(*MANAGEMENT))])
async def revoke_override(override_id: int, db: DbSession) -> OverrideOut:
    o = await db.get(AccessOverride, override_id)
    if o is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пропуск не найден")
    o.revoked_at = o.revoked_at or utcnow()
    await db.commit()
    return _override_out(o)


@router.post("/students/{student_id}/payment-check", response_model=PaymentCheckOut)
async def recheck_payment(student_id: int, db: DbSession, _: Admin) -> PaymentCheckOut:
    """Принудительно запросить статус оплаты в 1С (мимо кэша)."""
    student = await db.get(Student, student_id)
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ученик не найден")
    pay, became_paid = await check_payment(db, student, force=True)
    reopened = await on_payment_received(db, student) if became_paid else None
    await commit_and_dispatch(db)
    if reopened:
        await deliver_command(db, reopened)
    outbox.kick()
    return PaymentCheckOut(student_id=student_id, has_debt=pay.has_debt, debt_amount=pay.debt_amount,
                           source=pay.source, error=pay.error,
                           reopened_event_id=reopened.event.id if reopened else None)


# ---------------------------------------------------------------- Устройства

@router.get("/devices", response_model=list[DeviceOut])
async def list_devices(db: DbSession, _: Admin) -> list[DeviceOut]:
    return await _devices(db)


@router.post("/devices", response_model=DeviceOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_roles())])  # только SuperAdmin
async def create_device(body: DeviceIn, db: DbSession) -> DeviceOut:
    if (await db.execute(select(AccessDevice).where(AccessDevice.code == body.code))).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Устройство с таким кодом уже есть")
    d = AccessDevice(**body.model_dump(), is_active=True)
    db.add(d)
    await db.commit()
    return DeviceOut(id=d.id, code=d.code, name=d.name, location=d.location, adapter=d.adapter,
                     command_url=d.command_url, is_active=d.is_active, last_seen_at=d.last_seen_at,
                     connected=hub.is_connected(d.code))

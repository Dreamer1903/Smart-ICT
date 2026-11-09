"""Интеграция с HikCentral Professional.

Терминалы Hikvision (лицо / ладонь) решают «пустить или нет» сами, по уровням доступа.
Поэтому SchoolOS не отвечает на каждый проход, а заранее управляет правами:

  * нет долга или есть временный пропуск → ученик в уровне «Вход и выход»;
  * долг → ученик в уровне «Только выход» (выход не блокируется никогда);
  * события проходов из HikCentral → журнал, «Пульс школы», Robi, уведомления родителям.

HIK_ENFORCE=false (по умолчанию) — режим наблюдения: SchoolOS вычисляет, кого надо
закрыть/открыть, и показывает это в панели, но в HikCentral ничего не меняет.
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.base import utcnow
from app.integrations.health import health
from app.integrations.hikcentral import HikCentralError
from app.integrations.registry import integrations
from app.models import (
    AccessDecision,
    AccessDevice,
    AccessEvent,
    AccessReason,
    DeviceAdapter,
    GateDirection,
    HikAccessState,
    IntegrationCursor,
    PaymentStatusRecord,
    Student,
)
from app.services import outbox

logger = logging.getLogger("schoolos.hik")
EVENTS_CURSOR = "hik.events"


def _norm(name: str) -> str:
    return " ".join(name.lower().replace("ё", "е").split())


# ---------------------------------------------------------------- Сопоставление людей и дверей

@dataclass
class PersonSyncReport:
    hik_total: int = 0
    matched: int = 0
    already_linked: int = 0
    unmatched_hik: list[str] = field(default_factory=list)
    unmatched_students: list[str] = field(default_factory=list)


async def sync_persons(session: AsyncSession) -> PersonSyncReport:
    """Связать людей HikCentral с учениками (Student.hik_person_id)."""
    report = PersonSyncReport()
    students = (await session.execute(select(Student))).scalars().all()
    by_code = {s.external_1c_id: s for s in students if s.external_1c_id}
    by_name: dict[str, list[Student]] = {}
    for s in students:
        by_name.setdefault(_norm(s.full_name), []).append(s)
    linked = {s.hik_person_id for s in students if s.hik_person_id}

    try:
        async for p in integrations.hik.paged(settings.hik_path_person_list, {}):
            report.hik_total += 1
            person_id = str(p.get("personId") or "")
            name = p.get("personName") or " ".join(
                x for x in (p.get("personFamilyName"), p.get("personGivenName")) if x
            )
            if not person_id:
                continue
            if person_id in linked:
                report.already_linked += 1
                continue
            student: Student | None = None
            if settings.hik_match_by == "personCode":
                student = by_code.get(str(p.get("personCode") or ""))
            if student is None and name:  # запасной вариант — однозначное совпадение ФИО
                candidates = by_name.get(_norm(name), [])
                student = candidates[0] if len(candidates) == 1 else None
            if student is None or student.hik_person_id:
                if len(report.unmatched_hik) < 50:
                    report.unmatched_hik.append(f"{person_id}: {name or '—'}")
                continue
            student.hik_person_id = person_id
            linked.add(person_id)
            report.matched += 1
    except HikCentralError as e:
        health.error("hikcentral", str(e))
        raise
    health.ok("hikcentral")
    report.unmatched_students = [s.full_name for s in students if not s.hik_person_id][:50]
    await session.flush()
    return report


async def sync_doors(session: AsyncSession) -> int:
    """Импортировать двери HikCentral как устройства SchoolOS (adapter=HIKCENTRAL)."""
    created = 0
    try:
        async for d in integrations.hik.paged(settings.hik_path_door_list, {}):
            index = str(d.get("doorIndexCode") or "")
            if not index:
                continue
            dev = (await session.execute(select(AccessDevice).where(AccessDevice.external_id == index))).scalar_one_or_none()
            if dev is None:
                session.add(AccessDevice(code=f"hik-{index}", name=d.get("doorName") or f"Дверь {index}",
                                         adapter=DeviceAdapter.HIKCENTRAL, external_id=index, is_active=True))
                created += 1
            elif d.get("doorName"):
                dev.name = d["doorName"]
    except HikCentralError as e:
        health.error("hikcentral", str(e))
        raise
    health.ok("hikcentral")
    await session.flush()
    return created


# ---------------------------------------------------------------- Права доступа

async def desired_full_access(session: AsyncSession, student: Student) -> bool | None:
    """True — пускать на вход, False — только выход, None — статус оплаты неизвестен (не трогаем)."""
    from app.services.access import active_override

    if await active_override(session, student.id):
        return True
    record = await session.get(PaymentStatusRecord, student.id)
    if record is None:
        return None
    return not record.has_debt


async def reconcile_student(session: AsyncSession, student: Student) -> str:
    """Сравнить целевое состояние с применённым и поставить изменение в очередь."""
    if not settings.hik_enabled:
        return "disabled"
    if not student.hik_person_id:
        return "not_linked"
    desired = await desired_full_access(session, student)
    if desired is None:
        return "unknown"
    state = await session.get(HikAccessState, student.id)
    if state is None:
        # Исходно в HikCentral все ученики имеют полный доступ (как сейчас работает школа)
        state = HikAccessState(student_id=student.id, full_access=True)
        session.add(state)
    if state.full_access == desired:
        state.pending = None
        return "in_sync"
    state.pending = desired
    action = "grant" if desired else "revoke"
    if not settings.hik_enforce:
        return f"would_{action}"
    if not state.queued:
        outbox.enqueue(session, "hik", {"student_id": student.id})
        state.queued = True
    return action


async def reconcile_all(session: AsyncSession) -> dict[str, int]:
    counts: dict[str, int] = {}
    for student in (await session.execute(select(Student))).scalars():
        action = await reconcile_student(session, student)
        counts[action] = counts.get(action, 0) + 1
    await session.flush()
    return counts


def _group_body(group_id: str, person_id: str) -> dict[str, Any]:
    return {"privilegeGroupId": group_id, "type": 1, "list": [{"id": person_id}]}


async def apply_access(session: AsyncSession, student_id: int) -> None:
    """Доставка из outbox: применить ТЕКУЩЕЕ целевое состояние (а не то, что было при постановке)."""
    state = await session.get(HikAccessState, student_id)
    student = await session.get(Student, student_id)
    if state is None or student is None or state.pending is None or not student.hik_person_id:
        if state:
            state.queued = False
        return
    full, exit_only, pid = settings.hik_full_access_group_id, settings.hik_exit_only_group_id, student.hik_person_id
    if not full:
        raise HikCentralError("Не задан HIK_FULL_ACCESS_GROUP_ID")
    try:
        if state.pending:
            await integrations.hik.call(settings.hik_path_group_add, _group_body(full, pid))
            if exit_only:
                await integrations.hik.call(settings.hik_path_group_delete, _group_body(exit_only, pid))
        else:
            if exit_only:  # сначала даём выход, потом забираем вход — ученик не остаётся «запертым»
                await integrations.hik.call(settings.hik_path_group_add, _group_body(exit_only, pid))
            await integrations.hik.call(settings.hik_path_group_delete, _group_body(full, pid))
    except HikCentralError as e:
        state.last_error = str(e)[:255]
        raise
    state.full_access = state.pending
    state.pending = None
    state.queued = False
    state.synced_at = utcnow()
    state.last_error = None


async def on_delivery_failed(session: AsyncSession, payload: dict[str, Any]) -> None:
    """Outbox исчерпал попытки — разрешаем следующей сверке поставить задачу заново."""
    state = await session.get(HikAccessState, payload["student_id"])
    if state:
        state.queued = False


# ---------------------------------------------------------------- События проходов

@dataclass(slots=True)
class HikEvent:
    event_id: str
    event_type: int | None
    time: datetime
    person_id: str | None
    door_index: str | None
    direction: GateDirection | None


def _parse_time(value: Any) -> datetime:
    if not value:
        return utcnow()
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=ZoneInfo(settings.school_timezone))


def normalize_event(raw: dict[str, Any]) -> HikEvent | None:
    """Привести событие (из опроса door/events или из push-подписки) к единому виду."""
    data = raw.get("data") if isinstance(raw.get("data"), dict) else {}
    event_id = raw.get("eventId") or raw.get("eventIndexCode") or data.get("eventId")
    if not event_id:
        return None
    in_out = raw.get("inAndOutType", data.get("inAndOutType"))
    direction = {1: GateDirection.IN, 0: GateDirection.OUT}.get(int(in_out)) if str(in_out).lstrip("-").isdigit() else None
    etype = raw.get("eventType")
    return HikEvent(
        event_id=str(event_id),
        event_type=int(etype) if str(etype).isdigit() else None,
        time=_parse_time(raw.get("eventTime") or raw.get("happenTime")),
        person_id=str(raw.get("personId") or data.get("personId") or "") or None,
        door_index=str(raw.get("doorIndexCode") or raw.get("srcIndex") or "") or None,
        direction=direction,
    )


def classify(ev: HikEvent) -> AccessDecision | None:
    """GRANTED / DENIED / None (не событие прохода — пропускаем)."""
    granted, denied = settings.hik_granted_types, settings.hik_denied_types
    if ev.event_type is not None and ev.event_type in granted:
        return AccessDecision.GRANTED
    if ev.event_type is not None and ev.event_type in denied:
        return AccessDecision.DENIED
    if granted or denied:
        return None  # коды настроены, а этот — посторонний (тревога двери и т.п.)
    return AccessDecision.GRANTED if ev.person_id else AccessDecision.DENIED


async def ingest_event(session: AsyncSession, ev: HikEvent) -> str:
    from app.services.access import _record

    external_id = f"hik:{ev.event_id}"
    if (await session.execute(select(AccessEvent.id).where(AccessEvent.external_id == external_id))).first():
        return "duplicate"
    decision = classify(ev)
    if decision is None:
        return "ignored"

    device = None
    if ev.door_index:
        device = (await session.execute(select(AccessDevice).where(AccessDevice.external_id == ev.door_index))).scalar_one_or_none()
        if device is None:
            device = AccessDevice(code=f"hik-{ev.door_index}", name=f"Дверь HikCentral {ev.door_index}",
                                  adapter=DeviceAdapter.HIKCENTRAL, external_id=ev.door_index, is_active=True)
            session.add(device)
            await session.flush()
    if device is None:
        return "ignored"
    device.last_seen_at = utcnow()

    student = None
    if ev.person_id:
        student = (await session.execute(select(Student).where(Student.hik_person_id == ev.person_id))).scalar_one_or_none()
    direction = ev.direction or device.default_direction or GateDirection.IN

    if student is None:
        reason = AccessReason.UNKNOWN_CREDENTIAL
        decision = AccessDecision.DENIED if not ev.person_id else decision  # сотрудник / неизвестный — только журнал
        if ev.person_id:
            return "not_student"
    elif decision is AccessDecision.GRANTED:
        reason = AccessReason.TERMINAL_GRANTED
    else:
        record = await session.get(PaymentStatusRecord, student.id)
        reason = AccessReason.DEBT if record and record.has_debt and direction is GateDirection.IN else AccessReason.TERMINAL_DENIED

    await _record(
        session, device=device, student=student, req_kind=None, req_value=ev.person_id, direction=direction,
        decision=decision, reason=reason, at=ev.time, pay=None, started=time.perf_counter(),
        external_id=external_id, external_event_type=ev.event_type, notify_admin_unknown=False,
    )
    return decision.value.lower()


async def poll_events(session: AsyncSession) -> dict[str, int]:
    """Забрать новые события из HikCentral (с перекрытием окна; дубли отсекаются по eventId)."""
    tz = ZoneInfo(settings.school_timezone)
    cursor = await session.get(IntegrationCursor, EVENTS_CURSOR)
    now = utcnow()
    start = datetime.fromisoformat(cursor.value) - timedelta(minutes=2) if cursor else now - timedelta(minutes=10)
    body = {"startTime": start.astimezone(tz).isoformat(timespec="seconds"),
            "endTime": now.astimezone(tz).isoformat(timespec="seconds")}
    counts: dict[str, int] = {}
    try:
        async for raw in integrations.hik.paged(settings.hik_path_door_events, body):
            ev = normalize_event(raw)
            result = await ingest_event(session, ev) if ev else "invalid"
            counts[result] = counts.get(result, 0) + 1
    except HikCentralError as e:
        health.error("hikcentral", str(e))
        raise
    health.ok("hikcentral")
    if cursor is None:
        session.add(IntegrationCursor(name=EVENTS_CURSOR, value=now.isoformat()))
    else:
        cursor.value = now.isoformat()
    await session.flush()
    return counts

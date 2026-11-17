"""Ядро Live-статусов: единственное место, где меняется StudentPresenceState.

Правила (state machine):
  * Турникет IN   → IN_BUILDING (если ученик уже IN_CLASS/IN_NURSE — статус не трогаем,
                    это повторный проход/«дребезг» карты).
  * Турникет OUT  → LEFT_SCHOOL; активный визит в медпункт закрывается как SENT_HOME.
  * Медпункт RESTING           → IN_NURSE
  * Медпункт RETURNED_TO_CLASS → IN_CLASS
  * Медпункт SENT_HOME         → LEFT_SCHOOL (отпущен домой)
  * Отметка учителя «присутствует» → IN_CLASS; «отсутствует» (был IN_CLASS) → IN_BUILDING
  * DISCREPANCY: ученик IN_BUILDING дольше grace-периода после прохода IN
    (не в классе и не в медпункте) — потенциальный прогул внутри здания.

Каждое изменение кладёт DomainEvent("presence.changed") в очередь сессии;
публикация происходит в commit_and_dispatch() после коммита.
"""

from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.events import DomainEvent, enqueue_event
from app.db.base import utcnow
from app.models import (
    GateDirection,
    LocationStatus,
    NurseOutcome,
    NurseVisit,
    StudentPresenceState,
    TurnstileLog,
)

NURSE_OUTCOME_TO_STATUS: dict[NurseOutcome, LocationStatus] = {
    NurseOutcome.RESTING: LocationStatus.IN_NURSE,
    NurseOutcome.RETURNED_TO_CLASS: LocationStatus.IN_CLASS,
    NurseOutcome.SENT_HOME: LocationStatus.LEFT_SCHOOL,
}


async def get_or_create_state(session: AsyncSession, student_id: int) -> StudentPresenceState:
    state = await session.get(StudentPresenceState, student_id)
    if state is None:
        state = StudentPresenceState(
            student_id=student_id,
            current_location_status=LocationStatus.UNKNOWN,
            last_updated=utcnow(),
            is_discrepancy=False,
        )
        session.add(state)
        await session.flush()
    return state


def _emit(session: AsyncSession, state: StudentPresenceState, previous: LocationStatus, source: str) -> None:
    enqueue_event(
        session,
        DomainEvent(
            type="presence.changed",
            payload={
                "student_id": state.student_id,
                "previous_status": previous.value,
                "status": state.current_location_status.value,
                "is_discrepancy": state.is_discrepancy,
                "note": state.note,
                "source": source,
            },
        ),
    )


async def set_status(
    session: AsyncSession,
    student_id: int,
    status: LocationStatus,
    *,
    note: str | None,
    source: str,
    at: datetime | None = None,
) -> StudentPresenceState:
    """Установить статус ученика. Любой явный переход снимает флаг DISCREPANCY."""
    state = await get_or_create_state(session, student_id)
    previous = state.current_location_status
    state.current_location_status = status
    state.note = note
    state.last_updated = at or utcnow()
    state.is_discrepancy = False
    state.discrepancy_since = None
    _emit(session, state, previous, source)
    return state


# ---------------------------------------------------------------- СКУД / турникеты


async def register_gate_pass(
    session: AsyncSession,
    student_id: int,
    direction: GateDirection,
    timestamp: datetime,
    gate_id: str | None = None,
) -> tuple[TurnstileLog, StudentPresenceState, bool]:
    """Сохранить проход и обновить статус.

    Возвращает (лог, состояние, applied). applied=False, если событие «опоздало»
    (timestamp старше последнего учтённого прохода) — лог сохраняется, статус нет.
    """
    log = TurnstileLog(student_id=student_id, direction=direction, timestamp=timestamp, gate_id=gate_id)
    session.add(log)
    state = await get_or_create_state(session, student_id)

    enqueue_event(
        session,
        DomainEvent(
            type="gate.pass",
            payload={"student_id": student_id, "direction": direction.value, "timestamp": timestamp.isoformat()},
        ),
    )

    if state.last_gate_at is not None and timestamp < state.last_gate_at:
        await session.flush()
        return log, state, False

    state.last_gate_direction = direction
    state.last_gate_at = timestamp

    if direction is GateDirection.IN:
        if state.current_location_status not in (LocationStatus.IN_CLASS, LocationStatus.IN_NURSE):
            await set_status(
                session, student_id, LocationStatus.IN_BUILDING,
                note="Прошёл турникет, направляется в класс", source="gate", at=timestamp,
            )
    else:
        # Выход из здания закрывает незавершённый визит в медпункт
        active_visit = await get_active_visit(session, student_id)
        if active_visit is not None:
            active_visit.end_time = timestamp
            active_visit.outcome = NurseOutcome.SENT_HOME
            active_visit.notes = ((active_visit.notes or "") + "\n[авто] Закрыт: выход через турникет").strip()
        await set_status(
            session, student_id, LocationStatus.LEFT_SCHOOL,
            note="Покинул школу (турникет OUT)", source="gate", at=timestamp,
        )

    await session.flush()
    return log, state, True


# ---------------------------------------------------------------- Медпункт


async def get_active_visit(session: AsyncSession, student_id: int) -> NurseVisit | None:
    result = await session.execute(
        select(NurseVisit)
        .where(NurseVisit.student_id == student_id, NurseVisit.end_time.is_(None))
        .order_by(NurseVisit.start_time.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _nurse_note(visit: NurseVisit) -> str:
    match visit.outcome:
        case NurseOutcome.RESTING:
            return f"Медпункт: {visit.reason}"
        case NurseOutcome.SENT_HOME:
            return f"Отпущен домой медсестрой: {visit.reason}"
        case NurseOutcome.RETURNED_TO_CLASS:
            return "Вернулся на урок из медпункта"


async def apply_nurse_visit(session: AsyncSession, visit: NurseVisit) -> StudentPresenceState:
    """Синхронизировать Live-статус с текущим исходом визита."""
    if visit.outcome is not NurseOutcome.RESTING and visit.end_time is None:
        visit.end_time = utcnow()
    status = NURSE_OUTCOME_TO_STATUS[visit.outcome]
    state = await set_status(session, visit.student_id, status, note=_nurse_note(visit), source="nurse")
    enqueue_event(
        session,
        DomainEvent(
            type="nurse.visit",
            payload={"visit_id": visit.id, "student_id": visit.student_id, "outcome": visit.outcome.value},
        ),
    )
    return state


# ---------------------------------------------------------------- Сверка DISCREPANCY


async def recompute_discrepancies(session: AsyncSession, now: datetime | None = None) -> int:
    """Пометить учеников, которые прошли IN, но так и не дошли до класса/медпункта.

    Возвращает число НОВЫХ флагов. Вызывается периодически планировщиком
    и при каждом запросе live-pulse (дешёвый индексируемый запрос).
    """
    now = now or utcnow()
    threshold = now - timedelta(minutes=settings.discrepancy_grace_minutes)
    result = await session.execute(
        select(StudentPresenceState).where(
            StudentPresenceState.current_location_status == LocationStatus.IN_BUILDING,
            StudentPresenceState.last_gate_direction == GateDirection.IN,
            StudentPresenceState.last_gate_at <= threshold,
            StudentPresenceState.is_discrepancy.is_(False),
        )
    )
    flagged = 0
    for state in result.scalars():
        state.is_discrepancy = True
        state.discrepancy_since = now
        state.note = "В здании по СКУД, но не в классе и не в медпункте"
        flagged += 1
        enqueue_event(
            session,
            DomainEvent(
                type="presence.discrepancy",
                payload={"student_id": state.student_id, "since": now.isoformat()},
            ),
        )
    if flagged:
        await session.flush()
    return flagged


async def reset_daily_presence(session: AsyncSession) -> None:
    """Начало учебного дня: пансионеры → IN_BOARDING (они уже в здании), остальные → UNKNOWN."""
    from app.models import Student

    boarders = select(Student.id).where(Student.is_boarder.is_(True))
    common = dict(is_discrepancy=False, discrepancy_since=None, last_gate_direction=None,
                  last_gate_at=None, last_updated=utcnow())
    await session.execute(update(StudentPresenceState).where(StudentPresenceState.student_id.not_in(boarders))
                          .values(current_location_status=LocationStatus.UNKNOWN, note=None, **common))
    await session.execute(update(StudentPresenceState).where(StudentPresenceState.student_id.in_(boarders))
                          .values(current_location_status=LocationStatus.IN_BOARDING, note="В пансионате", **common))
    enqueue_event(session, DomainEvent(type="presence.reset", payload={}))

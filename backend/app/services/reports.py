"""Отчёты посещаемости: кто когда пришёл, когда ушёл, кто опоздал — по дням и по ученику."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models import AccessDecision, AccessEvent, GateDirection, Student, StudentStatus, TurnstileLog


def _tz() -> ZoneInfo:
    return ZoneInfo(settings.school_timezone)


def day_window(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=_tz())
    return start, start + timedelta(days=1)


def _start_time() -> time:
    h, m = settings.school_start_time.split(":")
    return time(int(h), int(m))


@dataclass
class DayRow:
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


async def _passes(session: AsyncSession, start: datetime, end: datetime, student_ids: list[int] | None = None):
    stmt = select(TurnstileLog.student_id, TurnstileLog.direction, TurnstileLog.timestamp).where(
        TurnstileLog.timestamp >= start, TurnstileLog.timestamp < end)
    if student_ids is not None:
        stmt = stmt.where(TurnstileLog.student_id.in_(student_ids))
    return (await session.execute(stmt)).all()


def _summarize(passes, student_id: int) -> tuple[datetime | None, datetime | None, int]:
    ins = [ts for sid, d, ts in passes if sid == student_id and d is GateDirection.IN]
    outs = [ts for sid, d, ts in passes if sid == student_id and d is GateDirection.OUT]
    return (min(ins) if ins else None), (max(outs) if outs else None), len(ins) + len(outs)


async def daily_attendance(session: AsyncSession, day: date, class_id: int | None = None) -> list[DayRow]:
    start, end = day_window(day)
    stmt = (select(Student).options(selectinload(Student.school_class))
            .where(Student.status == StudentStatus.ACTIVE).order_by(Student.class_id, Student.full_name))
    if class_id is not None:
        stmt = stmt.where(Student.class_id == class_id)
    students = (await session.execute(stmt)).scalars().all()
    passes = await _passes(session, start, end, [s.id for s in students])
    denied = dict((await session.execute(
        select(AccessEvent.student_id, func.count()).where(
            AccessEvent.decision == AccessDecision.DENIED, AccessEvent.occurred_at >= start, AccessEvent.occurred_at < end)
        .group_by(AccessEvent.student_id)
    )).all())
    rows = []
    for s in students:
        first_in, last_out, n = _summarize(passes, s.id)
        late = bool(first_in and first_in.astimezone(_tz()).time() > _start_time())
        rows.append(DayRow(
            student_id=s.id, full_name=s.full_name, class_id=s.class_id, class_name=s.school_class.name,
            is_boarder=bool(s.is_boarder), first_in=first_in, last_out=last_out, passes=n,
            denied=denied.get(s.id, 0), late=late, came=first_in is not None,
        ))
    return rows


async def student_history(session: AsyncSession, student_id: int, days: int = 14) -> list[dict]:
    """Последние N дней по ученику: первый вход, последний выход, число проходов, опоздание."""
    today = datetime.now(_tz()).date()
    start, _ = day_window(today - timedelta(days=days - 1))
    _, end = day_window(today)
    passes = await _passes(session, start, end, [student_id])
    out = []
    for i in range(days):
        day = today - timedelta(days=i)
        ds, de = day_window(day)
        day_passes = [p for p in passes if ds <= p[2] < de]
        first_in, last_out, n = _summarize(day_passes, student_id)
        out.append({
            "date": day, "first_in": first_in, "last_out": last_out, "passes": n,
            "late": bool(first_in and first_in.astimezone(_tz()).time() > _start_time()),
        })
    return out

"""Дежурства: составление графика по расписанию, отметка по QR, уведомления и контроль.

Кого ставим на смену (в порядке важности):
  1. Учитель в этот день в школе (есть хотя бы один урок) и не отметил день как «не могу» (совместитель).
  2. Во время смены у него нет урока.
  3. В один день — не больше одного дежурства.
  4. Меньше уроков в этот день — выше приоритет («дежурят те, у кого мало уроков»).
  5. Справедливость: меньше дежурств за последний месяц, не два дня подряд.
"""

import datetime as dt
from collections import defaultdict
from dataclasses import dataclass, field
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.base import utcnow
from app.models import (
    BellSlot,
    DutyAssignment,
    DutyPost,
    DutyShift,
    DutyStatus,
    TeacherPreference,
    TimetableEntry,
    User,
    UserRole,
)
from app.services.enrollment import notify_users, users_with_roles
from app.services.timetable import DAY_NAMES
from app.services.timetable_db import published

DUTY_MANAGERS = (UserRole.ZAVUCH_UPBRINGING, UserRole.DIRECTOR, UserRole.ZAVUCH)


class DutyError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def tz() -> ZoneInfo:
    return ZoneInfo(settings.school_timezone)


def local_now() -> dt.datetime:
    return dt.datetime.now(tz())


def at(day: dt.date, t: dt.time) -> dt.datetime:
    return dt.datetime.combine(day, t, tzinfo=tz())


def overlaps(a1: dt.time, a2: dt.time, b1: dt.time, b2: dt.time) -> bool:
    return a1 < b2 and b1 < a2


@dataclass
class GenerateReport:
    assigned: int = 0
    kept: int = 0
    unfilled: list[str] = field(default_factory=list)
    per_teacher: dict[str, int] = field(default_factory=dict)


async def _teacher_lessons(session: AsyncSession) -> dict[tuple[int, int], list[int]]:
    """(учитель, день недели) → номера уроков по действующему расписанию."""
    v = await published(session)
    out: dict[tuple[int, int], list[int]] = defaultdict(list)
    if v is None:
        return out
    for t, d, s in (await session.execute(select(TimetableEntry.teacher_id, TimetableEntry.day, TimetableEntry.slot)
                                          .where(TimetableEntry.version_id == v.id))).all():
        out[t, d].append(s)
    return out


async def generate(session: AsyncSession, date_from: dt.date, date_to: dt.date, replace: bool = True) -> GenerateReport:
    if date_to < date_from or (date_to - date_from).days > 62:
        raise DutyError("Период — от 1 дня до 2 месяцев")
    report = GenerateReport()
    shifts = list((await session.execute(select(DutyShift).join(DutyPost).options(selectinload(DutyShift.post))
                                         .where(DutyPost.is_active.is_(True)).order_by(DutyShift.start_time))).scalars())
    if not shifts:
        raise DutyError("Нет постов и смен — добавьте их (этажи, столовая)")
    teachers = list((await session.execute(select(User).where(User.role == UserRole.TEACHER, User.is_active.is_(True))
                                           .order_by(User.id))).scalars())
    lessons = await _teacher_lessons(session)
    if settings.duty_require_lesson_day and not lessons:
        raise DutyError("Нет действующего расписания — график строится по нему (у кого мало уроков)")
    bells = {b.number: (b.start_time, b.end_time) for b in (await session.execute(select(BellSlot))).scalars()}
    no_cells: dict[int, set[tuple[int, int]]] = {}
    for p in (await session.execute(select(TeacherPreference))).scalars():
        no_cells[p.teacher_id] = {tuple(int(x) for x in k.split("-")) for k, v in (p.cells or {}).items() if v == "no"}

    if replace:  # пересоздаём только автоматические и ещё не начатые
        await session.execute(delete(DutyAssignment).where(
            DutyAssignment.date >= date_from, DutyAssignment.date <= date_to,
            DutyAssignment.status == DutyStatus.PLANNED, DutyAssignment.manual.is_(False)))
    existing = list((await session.execute(select(DutyAssignment).where(
        DutyAssignment.date >= date_from - dt.timedelta(days=30), DutyAssignment.date <= date_to))).scalars())
    count: dict[int, int] = defaultdict(int)  # справедливость: дежурств за последний месяц
    by_day: dict[dt.date, set[int]] = defaultdict(set)
    filled: dict[tuple[dt.date, int], int] = defaultdict(int)
    for a in existing:
        count[a.teacher_id] += 1
        by_day[a.date].add(a.teacher_id)
        filled[a.date, a.shift_id] += 1
        if date_from <= a.date <= date_to:
            report.kept += 1

    day = date_from
    while day <= date_to:
        wd = day.isoweekday()
        if wd in settings.school_day_list:
            for sh in shifts:
                for _ in range(sh.required - filled[day, sh.id]):
                    best, best_score = None, None
                    for t in teachers:
                        slots = lessons.get((t.id, wd), [])
                        if settings.duty_require_lesson_day and not slots:
                            continue  # в этот день учителя нет в школе
                        if t.id in by_day[day]:
                            continue  # уже дежурит сегодня
                        if any(overlaps(sh.start_time, sh.end_time, *bells[s]) for s in slots if s in bells):
                            continue  # во время смены у него урок
                        busy_no = no_cells.get(t.id, set())
                        if any((wd, s) in busy_no and overlaps(sh.start_time, sh.end_time, *bells[s]) for s in bells) or \
                                (bells and all((wd, s) in busy_no for s in bells)):
                            continue  # «не могу» в это время / весь день
                        yesterday = t.id in by_day[day - dt.timedelta(days=1)]
                        score = len(slots) * 10 + count[t.id] * 15 + (30 if yesterday else 0)
                        if best_score is None or score < best_score:
                            best, best_score = t, score
                    if best is None:
                        report.unfilled.append(f"{day:%d.%m} ({DAY_NAMES.get(wd)}), {sh.post.name} — {sh.name}: нет свободного учителя")
                        break
                    session.add(DutyAssignment(date=day, shift_id=sh.id, teacher_id=best.id))
                    count[best.id] += 1
                    by_day[day].add(best.id)
                    filled[day, sh.id] += 1
                    report.assigned += 1
                    report.per_teacher[best.full_name] = report.per_teacher.get(best.full_name, 0) + 1
        day += dt.timedelta(days=1)
    await session.flush()
    return report


def describe(a: DutyAssignment) -> str:
    sh = a.shift
    return f"{sh.post.name} — {sh.name}, {a.date:%d.%m} {sh.start_time:%H:%M}–{sh.end_time:%H:%M}"


async def checkin(session: AsyncSession, user: User, token: str, now: dt.datetime | None = None) -> DutyAssignment:
    """Учитель отсканировал QR на посту: отмечаем начало дежурства."""
    now = (now or local_now()).astimezone(tz())
    post = (await session.execute(select(DutyPost).where(DutyPost.qr_token == token))).scalar_one_or_none()
    if post is None or not post.is_active:
        raise DutyError("QR-код недействителен. Возможно, его заменили — обратитесь к завучу.", 404)
    today = list((await session.execute(select(DutyAssignment).join(DutyShift).options(
        selectinload(DutyAssignment.shift).selectinload(DutyShift.post))
        .where(DutyAssignment.teacher_id == user.id, DutyAssignment.date == now.date())
        .order_by(DutyShift.start_time))).scalars())
    here = [a for a in today if a.shift.post_id == post.id]
    early = dt.timedelta(minutes=settings.duty_checkin_early_minutes)
    for a in here:
        start, end = at(a.date, a.shift.start_time), at(a.date, a.shift.end_time)
        if start - early <= now <= end:
            if a.status is DutyStatus.STARTED:
                return a  # повторное сканирование
            a.status, a.checked_in_at = DutyStatus.STARTED, utcnow()
            late = int((now - start).total_seconds() // 60)
            a.late_minutes = late if late > settings.duty_grace_minutes else None
            if a.reminded_at:  # завучу уже писали «не приступил» — сообщим, что пришёл
                notify_users(session, await users_with_roles(session, UserRole.ZAVUCH_UPBRINGING),
                             "Дежурный приступил", f"{user.full_name}: {describe(a)} (опоздание {late} мин)", "/duty")
            await session.flush()
            return a
    if here:
        a = here[0]
        raise DutyError(f"Ваше дежурство здесь: {a.shift.start_time:%H:%M}–{a.shift.end_time:%H:%M}. "
                        f"Отметиться можно за {settings.duty_checkin_early_minutes} мин до начала и до конца смены.", 409)
    if today:
        raise DutyError(f"Сегодня вы дежурите на другом посту: {describe(today[0])}", 409)
    raise DutyError(f"Сегодня у вас нет дежурства на посту «{post.name}»", 404)


async def notify_today(session: AsyncSession, now: dt.datetime | None = None) -> int:
    """Утреннее уведомление «сегодня у вас дежурство» (один раз на назначение)."""
    now = (now or local_now()).astimezone(tz())
    if now.hour < settings.duty_notify_hour:
        return 0
    items = list((await session.execute(select(DutyAssignment).options(
        selectinload(DutyAssignment.shift).selectinload(DutyShift.post), selectinload(DutyAssignment.teacher))
        .where(DutyAssignment.date == now.date(), DutyAssignment.notified_at.is_(None)))).scalars())
    for a in items:
        notify_users(session, [a.teacher], "Сегодня у вас дежурство",
                     f"{describe(a)}. На посту отсканируйте QR-код телефоном — это отметка о начале дежурства.", "/duty")
        a.notified_at = utcnow()
    await session.flush()  # чтобы повторный вызов не отправил уведомление ещё раз
    return len(items)


async def watch(session: AsyncSession, now: dt.datetime | None = None) -> dict[str, int]:
    """Контроль: через N минут без отметки — уведомление завучу; после конца смены — «пропустил»."""
    now = (now or local_now()).astimezone(tz())
    items = list((await session.execute(select(DutyAssignment).options(
        selectinload(DutyAssignment.shift).selectinload(DutyShift.post), selectinload(DutyAssignment.teacher))
        .where(DutyAssignment.date <= now.date(), DutyAssignment.status == DutyStatus.PLANNED))).scalars())
    reminded = missed = 0
    managers = await users_with_roles(session, UserRole.ZAVUCH_UPBRINGING)
    for a in items:
        start, end = at(a.date, a.shift.start_time), at(a.date, a.shift.end_time)
        if now > end:
            a.status = DutyStatus.MISSED
            missed += 1
        elif now >= start + dt.timedelta(minutes=settings.duty_remind_after_minutes) and a.reminded_at is None:
            notify_users(session, managers, "Дежурный не приступил",
                         f"{a.teacher.full_name}: {describe(a)} — нет отметки по QR", "/duty")
            notify_users(session, [a.teacher], "Вы не отметились на дежурстве",
                         f"{describe(a)}. Отсканируйте QR-код на посту.", "/duty")
            a.reminded_at = utcnow()
            reminded += 1
    await session.flush()
    return {"reminded": reminded, "missed": missed}

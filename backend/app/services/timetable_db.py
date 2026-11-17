"""Расписание в базе: сбор задачи для решателя, генерация вариантов, проверка ручных правок, отчёт."""

import asyncio
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.base import utcnow
from app.models import (
    BellSlot,
    ClassRoom,
    SchoolClass,
    Subject,
    TeacherPreference,
    TeachingAssignment,
    TimetableEntry,
    TimetableStatus,
    TimetableVersion,
    User,
)
from app.services.timetable import DAY_NAMES, Cell, Load, Problem, analyze, solve


class TimetableError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


async def slots(session: AsyncSession) -> list[int]:
    nums = [b.number for b in (await session.execute(select(BellSlot).order_by(BellSlot.number))).scalars()]
    return nums or list(range(1, 8))


async def build_problem(session: AsyncSession, locked_from: int | None = None) -> tuple[Problem, dict[int, TeachingAssignment]]:
    assignments = (await session.execute(select(TeachingAssignment).options(
        selectinload(TeachingAssignment.subject)))).scalars().all()
    loads = [Load(a.id, a.class_id, a.subject_id, a.teacher_id, a.hours_per_week, a.subject.room_id)
             for a in assignments if a.hours_per_week > 0]
    prefs = (await session.execute(select(TeacherPreference))).scalars().all()
    no, avoid, max_day = {}, {}, {}
    for pr in prefs:
        for key, val in (pr.cells or {}).items():
            d, s = (int(v) for v in key.split("-"))
            (no if val == "no" else avoid).setdefault(pr.teacher_id, set()).add((d, s))
        if pr.max_lessons_per_day:
            max_day[pr.teacher_id] = pr.max_lessons_per_day

    names = {
        "class": dict((await session.execute(select(SchoolClass.id, SchoolClass.name))).all()),
        "subject": dict((await session.execute(select(Subject.id, Subject.name))).all()),
        "teacher": dict((await session.execute(select(User.id, User.full_name))).all()),
        "room": dict((await session.execute(select(ClassRoom.id, ClassRoom.name))).all()),
    }
    locked = []
    if locked_from:
        by_cs = {(a.class_id, a.subject_id): a.id for a in assignments}
        for e in (await session.execute(select(TimetableEntry).where(
                TimetableEntry.version_id == locked_from, TimetableEntry.locked.is_(True)))).scalars():
            if (lid := by_cs.get((e.class_id, e.subject_id))) is not None:
                locked.append((lid, e.day, e.slot))
    problem = Problem(days=settings.school_day_list, slots=await slots(session), loads=loads,
                      no_cells=no, avoid_cells=avoid, max_per_day=max_day, locked=locked, names=names)
    return problem, {a.id: a for a in assignments}


async def generate(session: AsyncSession, actor: User, name: str, base_version_id: int | None,
                   time_limit: float | None) -> tuple[TimetableVersion | None, list[str], dict[str, Any]]:
    problem, by_id = await build_problem(session, base_version_id)
    if not problem.loads:
        raise TimetableError("Нет нагрузки: заполните «кто что ведёт и сколько часов»")
    result = await asyncio.to_thread(solve, problem, time_limit or settings.timetable_time_limit_seconds)
    meta = {"status": result.status, "seconds": result.seconds}
    if not result.ok:
        return None, result.problems, meta
    version = TimetableVersion(name=name, status=TimetableStatus.DRAFT, created_by_id=actor.id)
    session.add(version)
    await session.flush()
    locked = {(lid, d, s) for lid, d, s in problem.locked}
    for pl in result.placements:
        a = by_id[pl.load_id]
        session.add(TimetableEntry(version_id=version.id, class_id=a.class_id, subject_id=a.subject_id,
                                   teacher_id=a.teacher_id, room_id=a.subject.room_id, day=pl.day, slot=pl.slot,
                                   locked=(pl.load_id, pl.day, pl.slot) in locked))
    await session.flush()
    version.report = {**await analyze_version(session, version.id), "solver": meta}
    return version, [], meta


async def analyze_version(session: AsyncSession, version_id: int) -> dict[str, Any]:
    problem, _ = await build_problem(session)
    entries = (await session.execute(select(TimetableEntry).where(TimetableEntry.version_id == version_id))).scalars()
    cells = [Cell(e.class_id, e.subject_id, e.teacher_id, e.room_id, e.day, e.slot) for e in entries]
    return analyze(cells, problem)


async def check_move(session: AsyncSession, entry: TimetableEntry, day: int, slot: int) -> tuple[list[str], list[str]]:
    """Можно ли поставить урок в (day, slot)? → (ошибки, предупреждения)."""
    errors, warnings = [], []
    if day not in settings.school_day_list or slot not in await slots(session):
        return ["Такого дня или урока нет в сетке"], []
    others = (await session.execute(select(TimetableEntry).options(
        selectinload(TimetableEntry.school_class), selectinload(TimetableEntry.teacher), selectinload(TimetableEntry.subject))
        .where(TimetableEntry.version_id == entry.version_id, TimetableEntry.day == day,
               TimetableEntry.slot == slot, TimetableEntry.id != entry.id))).scalars().all()
    when = f"{DAY_NAMES.get(day, day)}, {slot}-й урок"
    for o in others:
        if o.class_id == entry.class_id:
            errors.append(f"У класса {o.school_class.name} уже {o.subject.name} ({when})")
        if o.teacher_id == entry.teacher_id:
            errors.append(f"{o.teacher.full_name} уже ведёт урок в {o.school_class.name} ({when})")
        if entry.room_id and o.room_id == entry.room_id:
            errors.append(f"Кабинет занят: {o.subject.name} в {o.school_class.name} ({when})")
    pref = await session.get(TeacherPreference, entry.teacher_id)
    cell = (pref.cells or {}).get(f"{day}-{slot}") if pref else None
    if cell == "no":
        errors.append(f"Учитель указал, что не может в {when}")
    elif cell == "avoid":
        warnings.append(f"Учитель просил не ставить уроки в {when}")
    return errors, warnings


async def published(session: AsyncSession) -> TimetableVersion | None:
    return (await session.execute(select(TimetableVersion).where(
        TimetableVersion.status == TimetableStatus.PUBLISHED).order_by(TimetableVersion.published_at.desc()).limit(1))).scalar_one_or_none()


async def publish(session: AsyncSession, version: TimetableVersion) -> None:
    report = await analyze_version(session, version.id)
    if report["conflicts"]:
        raise TimetableError("Нельзя опубликовать: в расписании есть конфликты — " + "; ".join(report["conflicts"][:3]), 409)
    for v in (await session.execute(select(TimetableVersion).where(
            TimetableVersion.status == TimetableStatus.PUBLISHED))).scalars():
        v.status = TimetableStatus.ARCHIVED
    version.status = TimetableStatus.PUBLISHED
    version.published_at = utcnow()
    version.report = {**(version.report or {}), **report}


async def copy_version(session: AsyncSession, src: TimetableVersion, name: str, actor: User) -> TimetableVersion:
    v = TimetableVersion(name=name, status=TimetableStatus.DRAFT, created_by_id=actor.id, report=src.report)
    session.add(v)
    await session.flush()
    for e in (await session.execute(select(TimetableEntry).where(TimetableEntry.version_id == src.id))).scalars():
        session.add(TimetableEntry(version_id=v.id, class_id=e.class_id, subject_id=e.subject_id, teacher_id=e.teacher_id,
                                   room_id=e.room_id, day=e.day, slot=e.slot, locked=e.locked))
    await session.flush()
    return v


async def delete_version(session: AsyncSession, version: TimetableVersion) -> None:
    if version.status is TimetableStatus.PUBLISHED:
        raise TimetableError("Действующее расписание удалить нельзя", 409)
    await session.execute(delete(TimetableEntry).where(TimetableEntry.version_id == version.id))
    await session.delete(version)

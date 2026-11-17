"""Электронный журнал: права учителя, уроки по расписанию, посещаемость с уведомлениями, оценки, итоговые оценки."""

from datetime import date, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.base import utcnow
from app.models import (
    AcademicPeriod,
    AttendanceMark,
    Grade,
    Lesson,
    LessonAttendance,
    LocationStatus,
    PeriodCode,
    SchoolClass,
    Student,
    StudentStatus,
    TeachingAssignment,
    TimetableEntry,
    User,
    UserRole,
)
from app.services import outbox, presence
from app.services.enrollment import notify_users, users_with_roles
from app.services.timetable_db import published

R = UserRole
JOURNAL_ADMINS = {R.SUPER_ADMIN, R.DIRECTOR, R.ZAVUCH, R.ZAVUCH_ACADEMIC}
JOURNAL_READERS = JOURNAL_ADMINS | {R.ZAVUCH_UPBRINGING}

MARK_LABEL = {AttendanceMark.PRESENT: "присутствовал", AttendanceMark.ABSENT: "отсутствовал",
              AttendanceMark.LATE: "опоздал", AttendanceMark.EXCUSED: "отсутствовал по уважительной причине"}


class JournalError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def today() -> date:
    from datetime import datetime

    return datetime.now(ZoneInfo(settings.school_timezone)).date()


async def can_write(session: AsyncSession, user: User, class_id: int, subject_id: int) -> bool:
    if user.role in JOURNAL_ADMINS:
        return True
    return (await session.execute(select(TeachingAssignment.id).where(
        TeachingAssignment.class_id == class_id, TeachingAssignment.subject_id == subject_id,
        TeachingAssignment.teacher_id == user.id))).first() is not None


async def can_read_class(session: AsyncSession, user: User, class_id: int) -> bool:
    if user.role in JOURNAL_READERS:
        return True
    c = await session.get(SchoolClass, class_id)
    if c and user.id in (c.homeroom_teacher_id, c.curator_id):
        return True
    return (await session.execute(select(TeachingAssignment.id).where(
        TeachingAssignment.class_id == class_id, TeachingAssignment.teacher_id == user.id))).first() is not None


async def class_students(session: AsyncSession, class_id: int) -> list[Student]:
    return list((await session.execute(select(Student).where(
        Student.class_id == class_id, Student.status == StudentStatus.ACTIVE).order_by(Student.full_name))).scalars())


async def scheduled_slots(session: AsyncSession, class_id: int, subject_id: int) -> list[tuple[int, int]]:
    """(день недели, урок) по действующему расписанию."""
    v = await published(session)
    if v is None:
        return []
    return sorted((d, s) for d, s in (await session.execute(select(TimetableEntry.day, TimetableEntry.slot).where(
        TimetableEntry.version_id == v.id, TimetableEntry.class_id == class_id,
        TimetableEntry.subject_id == subject_id))).all())


async def lesson_calendar(session: AsyncSession, class_id: int, subject_id: int, start: date, end: date) -> list[tuple[date, int]]:
    slots = await scheduled_slots(session, class_id, subject_id)
    out, d = [], start
    while d <= end:
        out += [(d, s) for wd, s in slots if wd == d.isoweekday()]
        d += timedelta(days=1)
    return out


async def get_or_create_lesson(session: AsyncSession, user: User, class_id: int, subject_id: int, day: date, slot: int) -> Lesson:
    lesson = (await session.execute(select(Lesson).where(
        Lesson.class_id == class_id, Lesson.date == day, Lesson.slot == slot))).scalar_one_or_none()
    if lesson is not None:
        if lesson.subject_id != subject_id:
            raise JournalError("В это время у класса другой урок", 409)
        return lesson
    if (day.isoweekday(), slot) not in await scheduled_slots(session, class_id, subject_id) and user.role not in JOURNAL_ADMINS:
        raise JournalError("По расписанию в это время нет такого урока", 409)
    teacher_id = user.id
    if user.role in JOURNAL_ADMINS:
        ta = (await session.execute(select(TeachingAssignment).where(
            TeachingAssignment.class_id == class_id, TeachingAssignment.subject_id == subject_id))).scalar_one_or_none()
        teacher_id = ta.teacher_id if ta else user.id
    lesson = Lesson(class_id=class_id, subject_id=subject_id, teacher_id=teacher_id, date=day, slot=slot)
    session.add(lesson)
    await session.flush()
    return lesson


async def _already_notified(session: AsyncSession, student_id: int, day: date, mark: AttendanceMark, exclude_id: int) -> bool:
    """Уже была такая отметка у ученика сегодня (на другом уроке) — повторно не уведомляем."""
    return (await session.execute(select(LessonAttendance.id).join(Lesson, Lesson.id == LessonAttendance.lesson_id).where(
        LessonAttendance.student_id == student_id, LessonAttendance.mark == mark, Lesson.date == day,
        LessonAttendance.id != exclude_id).limit(1))).first() is not None


async def save_attendance(session: AsyncSession, user: User, lesson: Lesson, marks: list[dict]) -> dict[str, int]:
    """Сохранить отметки. При «нет» и «опоздал» — уведомить кл. руководителя, куратора, завуча по воспитательной
    части и родителей (не чаще раза в день по каждому ученику и типу отметки)."""
    students = {s.id: s for s in await class_students(session, lesson.class_id)}
    existing = {a.student_id: a for a in (await session.execute(select(LessonAttendance).where(
        LessonAttendance.lesson_id == lesson.id))).scalars()}
    school_class = await session.get(SchoolClass, lesson.class_id)
    from app.models import Subject

    subject = await session.get(Subject, lesson.subject_id)
    staff_to_notify: list[User] = await users_with_roles(session, R.ZAVUCH_UPBRINGING)
    for uid in (school_class.homeroom_teacher_id, school_class.curator_id):
        if uid and (u := await session.get(User, uid)):
            staff_to_notify.append(u)

    counts = {"saved": 0, "notified": 0}
    alerts: list[str] = []
    for m in marks:
        sid, mark = int(m["student_id"]), AttendanceMark(m["mark"])
        if sid not in students:
            raise JournalError(f"Ученик {sid} не из этого класса", 422)
        row = existing.get(sid)
        changed = row is None or row.mark is not mark
        if row is None:
            row = LessonAttendance(lesson_id=lesson.id, student_id=sid, mark=mark)
            session.add(row)
        row.mark, row.late_minutes, row.comment = mark, m.get("late_minutes"), m.get("comment")
        row.marked_by_id, row.marked_at = user.id, utcnow()
        await session.flush()
        counts["saved"] += 1
        st = students[sid]

        # Связь с турникетом и «Пульсом» (только для сегодняшних уроков)
        if lesson.date == today():
            state = await presence.get_or_create_state(session, sid)
            if mark in (AttendanceMark.PRESENT, AttendanceMark.LATE) and state.current_location_status is not LocationStatus.IN_NURSE:
                await presence.set_status(session, sid, LocationStatus.IN_CLASS, note=f"На уроке: {subject.name}", source="journal")
            elif mark is AttendanceMark.ABSENT and state.current_location_status in (LocationStatus.IN_BUILDING, LocationStatus.IN_CLASS) \
                    and state.last_gate_direction is not None and state.last_gate_direction.value == "IN":
                await presence.set_status(session, sid, LocationStatus.IN_BUILDING,
                                          note=f"Прошёл турникет, но отсутствует на уроке «{subject.name}»", source="journal")
                state.is_discrepancy, state.discrepancy_since = True, utcnow()

        if changed and mark in (AttendanceMark.ABSENT, AttendanceMark.LATE) \
                and not await _already_notified(session, sid, lesson.date, mark, row.id):
            what = f"опоздал(а) на {row.late_minutes} мин" if mark is AttendanceMark.LATE and row.late_minutes else MARK_LABEL[mark]
            text = f"{st.full_name} ({school_class.name}) {what} — {subject.name}, {lesson.slot}-й урок, {lesson.date:%d.%m}"
            alerts.append(text)
            outbox.notify_parent(session, st, "absence" if mark is AttendanceMark.ABSENT else "late", text)
            counts["notified"] += 1
    if alerts:
        notify_users(session, staff_to_notify, f"Посещаемость: {school_class.name}, {subject.name}",
                     "\n".join(alerts[:10]) + (f"\n…и ещё {len(alerts) - 10}" if len(alerts) > 10 else ""),
                     f"/journal?class_id={lesson.class_id}&subject_id={lesson.subject_id}", exclude=user)
    return counts


async def period_bounds(session: AsyncSession, school_year: str, code: PeriodCode) -> tuple[date, date] | None:
    p = (await session.execute(select(AcademicPeriod).where(
        AcademicPeriod.school_year == school_year, AcademicPeriod.code == code))).scalar_one_or_none()
    return (p.start_date, p.end_date) if p else None


async def current_school_year(session: AsyncSession) -> str:
    d = today()
    p = (await session.execute(select(AcademicPeriod).where(
        AcademicPeriod.code == PeriodCode.YEAR, AcademicPeriod.start_date <= d + timedelta(days=100))
        .order_by(AcademicPeriod.start_date.desc()).limit(1))).scalar_one_or_none()
    return p.school_year if p else f"{d.year if d.month >= 8 else d.year - 1}-{d.year + 1 if d.month >= 8 else d.year}"


def average(values: list[int]) -> float | None:
    return round(sum(values) / len(values), 2) if values else None


def suggest(avg: float | None) -> int | None:
    """Подсказка итоговой оценки по среднему: 4.5 → 5, 3.5 → 4 (округление 0.5 вверх)."""
    if avg is None:
        return None
    return max(1, min(settings.grade_max, int(avg + 0.5)))


async def grades_for(session: AsyncSession, student_ids: list[int], subject_id: int | None,
                     start: date | None, end: date | None) -> list[Grade]:
    stmt = select(Grade).where(Grade.student_id.in_(student_ids))
    if subject_id:
        stmt = stmt.where(Grade.subject_id == subject_id)
    if start:
        stmt = stmt.where(Grade.date >= start)
    if end:
        stmt = stmt.where(Grade.date <= end)
    return list((await session.execute(stmt.order_by(Grade.date, Grade.id))).scalars())

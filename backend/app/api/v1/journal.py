"""Электронный журнал (учитель, завучи) и дневник (ученик, родитель)."""

import datetime as dt
from collections import defaultdict
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import FAMILY, STAFF_ALL, CurrentUser, DbSession, require_roles
from app.api.v1.academic import family_students
from app.core.config import settings
from app.core.events import commit_and_dispatch
from app.models import (
    AttendanceMark,
    BellSlot,
    Grade,
    GradeKind,
    Lesson,
    LessonAttendance,
    PeriodCode,
    PeriodGrade,
    SchoolClass,
    Student,
    Subject,
    TeachingAssignment,
    TimetableEntry,
    User,
    UserRole,
)
from app.services import journal as j
from app.services import outbox
from app.services.timetable import DAY_NAMES
from app.services.timetable_db import published

router = APIRouter(tags=["journal"])
R = UserRole
Staff = Annotated[User, Depends(require_roles(*STAFF_ALL))]


def _http(e: j.JournalError) -> HTTPException:
    return HTTPException(e.status_code, detail=str(e))


async def _require_write(db: DbSession, user: User, class_id: int, subject_id: int) -> None:
    if not await j.can_write(db, user, class_id, subject_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Этот предмет в этом классе ведёт другой учитель")


async def _require_read(db: DbSession, user: User, class_id: int) -> None:
    if not await j.can_read_class(db, user, class_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Нет доступа к журналу этого класса")


# ---------------------------------------------------------------- Мои классы

@router.get("/journal/my-classes")
async def my_classes(db: DbSession, user: Staff) -> list[dict[str, Any]]:
    """Что пользователь может открыть в журнале: свои предметы (запись) и свои классы (просмотр)."""
    stmt = select(TeachingAssignment).options(selectinload(TeachingAssignment.school_class),
                                              selectinload(TeachingAssignment.subject))
    if user.role not in j.JOURNAL_READERS:
        own = select(SchoolClass.id).where((SchoolClass.homeroom_teacher_id == user.id) | (SchoolClass.curator_id == user.id))
        stmt = stmt.where((TeachingAssignment.teacher_id == user.id) | (TeachingAssignment.class_id.in_(own)))
    rows = []
    for a in (await db.execute(stmt)).scalars():
        rows.append({"class_id": a.class_id, "class_name": a.school_class.name, "subject_id": a.subject_id,
                     "subject_name": a.subject.name, "can_write": user.role in j.JOURNAL_ADMINS or a.teacher_id == user.id})
    return sorted(rows, key=lambda r: (not r["can_write"], r["class_name"], r["subject_name"]))


# ---------------------------------------------------------------- Уроки

class LessonPatch(BaseModel):
    topic: str | None = Field(default=None, max_length=255)
    homework: str | None = None
    homework_due: dt.date | None = None


class AttendanceItem(BaseModel):
    student_id: int
    mark: AttendanceMark
    late_minutes: int | None = Field(default=None, ge=1, le=240)
    comment: str | None = None


class GradeIn(BaseModel):
    student_id: int
    subject_id: int
    class_id: int
    date: dt.date
    value: int = Field(ge=1)
    kind: GradeKind = GradeKind.CLASSWORK
    comment: str | None = None
    lesson_id: int | None = None


class GradePatch(BaseModel):
    value: int | None = Field(default=None, ge=1)
    kind: GradeKind | None = None
    comment: str | None = None


@router.get("/journal/lessons")
async def lessons(db: DbSession, user: Staff, class_id: int, subject_id: int,
                  date_from: dt.date | None = None, date_to: dt.date | None = None) -> list[dict[str, Any]]:
    """Уроки по расписанию за период (по умолчанию — текущая и прошлая неделя) с темами и ДЗ."""
    await _require_read(db, user, class_id)
    today = j.today()
    date_from = date_from or today - dt.timedelta(days=today.weekday() + 7)
    date_to = date_to or today - dt.timedelta(days=today.weekday()) + dt.timedelta(days=6)
    cal = await j.lesson_calendar(db, class_id, subject_id, date_from, date_to)
    existing = {(lesson.date, lesson.slot): lesson for lesson in (await db.execute(select(Lesson).where(
        Lesson.class_id == class_id, Lesson.subject_id == subject_id, Lesson.date >= date_from, Lesson.date <= date_to))).scalars()}
    marked = {lid for (lid,) in (await db.execute(select(LessonAttendance.lesson_id).where(
        LessonAttendance.lesson_id.in_([lesson.id for lesson in existing.values()])).distinct())).all()}
    keys = sorted(set(cal) | set(existing))
    return [{"date": d, "slot": s, "weekday": DAY_NAMES.get(d.isoweekday(), ""), "lesson_id": existing[d, s].id if (d, s) in existing else None,
             "topic": existing[d, s].topic if (d, s) in existing else None,
             "homework": existing[d, s].homework if (d, s) in existing else None,
             "attendance_marked": (d, s) in existing and existing[d, s].id in marked, "is_today": d == today} for d, s in keys]


@router.get("/journal/lesson")
async def open_lesson(db: DbSession, user: Staff, class_id: int, subject_id: int, date: dt.date, slot: int) -> dict[str, Any]:
    """Открыть урок: тема, ДЗ, список класса с отметками посещаемости и оценками за этот день."""
    await _require_write(db, user, class_id, subject_id)
    try:
        lesson = await j.get_or_create_lesson(db, user, class_id, subject_id, date, slot)
    except j.JournalError as e:
        raise _http(e) from None
    await db.commit()
    students = await j.class_students(db, class_id)
    att = {a.student_id: a for a in (await db.execute(select(LessonAttendance).where(LessonAttendance.lesson_id == lesson.id))).scalars()}
    grades = defaultdict(list)
    for g in await j.grades_for(db, [s.id for s in students], subject_id, date, date):
        grades[g.student_id].append({"id": g.id, "value": g.value, "kind": g.kind, "comment": g.comment})
    return {
        "lesson": {"id": lesson.id, "class_id": class_id, "subject_id": subject_id, "date": lesson.date, "slot": lesson.slot,
                   "topic": lesson.topic, "homework": lesson.homework, "homework_due": lesson.homework_due},
        "grade_max": settings.grade_max,
        "students": [{"id": s.id, "full_name": s.full_name,
                      "mark": att[s.id].mark if s.id in att else None,
                      "late_minutes": att[s.id].late_minutes if s.id in att else None,
                      "comment": att[s.id].comment if s.id in att else None,
                      "grades": grades.get(s.id, [])} for s in students],
    }


async def _lesson(db: DbSession, user: User, lesson_id: int) -> Lesson:
    lesson = await db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Урок не найден")
    await _require_write(db, user, lesson.class_id, lesson.subject_id)
    return lesson


@router.patch("/journal/lessons/{lesson_id}")
async def update_lesson(lesson_id: int, body: LessonPatch, db: DbSession, user: Staff) -> dict[str, Any]:
    """Тема и домашнее задание (видно ученикам и родителям в дневнике)."""
    lesson = await _lesson(db, user, lesson_id)
    changes = body.model_dump(exclude_unset=True)
    new_homework = "homework" in changes and changes["homework"] and changes["homework"] != lesson.homework
    for k, v in changes.items():
        setattr(lesson, k, v)
    if new_homework:
        subject = await db.get(Subject, lesson.subject_id)
        for st in await j.class_students(db, lesson.class_id):
            outbox.notify_parent(db, st, "homework", f"Домашнее задание ({subject.name}, {lesson.date:%d.%m}): {lesson.homework}")
    await commit_and_dispatch(db)
    outbox.kick()
    return {"id": lesson.id, "topic": lesson.topic, "homework": lesson.homework, "homework_due": lesson.homework_due}


@router.put("/journal/lessons/{lesson_id}/attendance")
async def set_attendance(lesson_id: int, body: list[AttendanceItem], db: DbSession, user: Staff) -> dict[str, int]:
    lesson = await _lesson(db, user, lesson_id)
    try:
        counts = await j.save_attendance(db, user, lesson, [m.model_dump() for m in body])
    except j.JournalError as e:
        raise _http(e) from None
    await commit_and_dispatch(db)
    outbox.kick()
    return counts


# ---------------------------------------------------------------- Оценки

def _grade_out(g: Grade) -> dict[str, Any]:
    return {"id": g.id, "student_id": g.student_id, "subject_id": g.subject_id, "date": g.date, "value": g.value,
            "kind": g.kind, "comment": g.comment, "lesson_id": g.lesson_id}


@router.post("/journal/grades", status_code=status.HTTP_201_CREATED)
async def add_grade(body: GradeIn, db: DbSession, user: Staff) -> dict[str, Any]:
    await _require_write(db, user, body.class_id, body.subject_id)
    if body.value > settings.grade_max:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Оценка от 1 до {settings.grade_max}")
    st = await db.get(Student, body.student_id)
    if st is None or st.class_id != body.class_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Ученик не из этого класса")
    g = Grade(student_id=body.student_id, subject_id=body.subject_id, lesson_id=body.lesson_id, teacher_id=user.id,
              date=body.date, value=body.value, kind=body.kind, comment=body.comment)
    db.add(g)
    await db.commit()
    return _grade_out(g)


async def _grade(db: DbSession, user: User, grade_id: int) -> Grade:
    g = await db.get(Grade, grade_id)
    if g is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Оценка не найдена")
    st = await db.get(Student, g.student_id)
    await _require_write(db, user, st.class_id, g.subject_id)
    return g


@router.patch("/journal/grades/{grade_id}")
async def update_grade(grade_id: int, body: GradePatch, db: DbSession, user: Staff) -> dict[str, Any]:
    g = await _grade(db, user, grade_id)
    if body.value is not None and body.value > settings.grade_max:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Оценка от 1 до {settings.grade_max}")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(g, k, v)
    await db.commit()
    return _grade_out(g)


@router.delete("/journal/grades/{grade_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grade(grade_id: int, db: DbSession, user: Staff) -> None:
    await db.delete(await _grade(db, user, grade_id))
    await db.commit()


@router.get("/journal/gradebook")
async def gradebook(db: DbSession, user: Staff, class_id: int, subject_id: int,
                    period: PeriodCode = PeriodCode.Q1, school_year: str | None = None) -> dict[str, Any]:
    """Сводная ведомость: ученики × оценки за период, средний балл, подсказка и выставленная итоговая оценка."""
    await _require_read(db, user, class_id)
    school_year = school_year or await j.current_school_year(db)
    bounds = await j.period_bounds(db, school_year, period)
    students = await j.class_students(db, class_id)
    ids = [s.id for s in students]
    grades = await j.grades_for(db, ids, subject_id, *(bounds or (None, None)))
    finals = {(p.student_id, p.period): p for p in (await db.execute(select(PeriodGrade).where(
        PeriodGrade.student_id.in_(ids), PeriodGrade.subject_id == subject_id, PeriodGrade.school_year == school_year))).scalars()}
    by_student = defaultdict(list)
    for g in grades:
        by_student[g.student_id].append(g)
    dates = sorted({g.date for g in grades})
    rows = []
    for s in students:
        gs = by_student.get(s.id, [])
        avg = j.average([g.value for g in gs])
        fin = finals.get((s.id, period))
        rows.append({"student_id": s.id, "full_name": s.full_name, "grades": [_grade_out(g) for g in gs], "average": avg,
                     "suggested": j.suggest(avg), "period_grade": fin.value if fin else None,
                     "period_comment": fin.comment if fin else None,
                     "all_periods": {p.value: finals[s.id, p].value for p in PeriodCode if (s.id, p) in finals}})
    return {"school_year": school_year, "period": period, "bounds": bounds, "dates": dates, "rows": rows,
            "can_write": await j.can_write(db, user, class_id, subject_id), "grade_max": settings.grade_max}


class PeriodGradeItem(BaseModel):
    student_id: int
    value: int = Field(ge=1)
    comment: str | None = None


class PeriodGradesIn(BaseModel):
    class_id: int
    subject_id: int
    period: PeriodCode
    school_year: str | None = None
    grades: list[PeriodGradeItem]


@router.put("/journal/period-grades")
async def set_period_grades(body: PeriodGradesIn, db: DbSession, user: Staff) -> dict[str, int]:
    """Выставить четвертные / полугодовые / годовые оценки и итоговую аттестацию."""
    await _require_write(db, user, body.class_id, body.subject_id)
    school_year = body.school_year or await j.current_school_year(db)
    ids = {s.id for s in await j.class_students(db, body.class_id)}
    existing = {p.student_id: p for p in (await db.execute(select(PeriodGrade).where(
        PeriodGrade.subject_id == body.subject_id, PeriodGrade.school_year == school_year,
        PeriodGrade.period == body.period, PeriodGrade.student_id.in_(ids)))).scalars()}
    for item in body.grades:
        if item.student_id not in ids:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"Ученик {item.student_id} не из этого класса")
        if item.value > settings.grade_max:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Оценка от 1 до {settings.grade_max}")
        p = existing.get(item.student_id) or PeriodGrade(student_id=item.student_id, subject_id=body.subject_id,
                                                         school_year=school_year, period=body.period)
        p.value, p.comment, p.teacher_id = item.value, item.comment, user.id
        db.add(p)
    await db.commit()
    return {"saved": len(body.grades)}


@router.get("/journal/attendance-report")
async def attendance_report(db: DbSession, _: Annotated[User, Depends(require_roles(*j.JOURNAL_READERS, R.TEACHER))],
                            date_from: dt.date | None = None, date_to: dt.date | None = None,
                            class_id: int | None = None) -> list[dict[str, Any]]:
    """Пропуски и опоздания по урокам (для завуча по воспитательной части и классных руководителей)."""
    date_from = date_from or j.today()
    date_to = date_to or date_from
    stmt = (select(LessonAttendance, Lesson, Student, Subject).join(Lesson, Lesson.id == LessonAttendance.lesson_id)
            .join(Student, Student.id == LessonAttendance.student_id).join(Subject, Subject.id == Lesson.subject_id)
            .where(LessonAttendance.mark != AttendanceMark.PRESENT, Lesson.date >= date_from, Lesson.date <= date_to)
            .order_by(Lesson.date, Lesson.slot))
    if class_id:
        stmt = stmt.where(Lesson.class_id == class_id)
    classes = dict((await db.execute(select(SchoolClass.id, SchoolClass.name))).all())
    return [{"date": l_.date, "slot": l_.slot, "class_name": classes.get(l_.class_id), "student_id": s.id, "full_name": s.full_name,
             "subject": sub.name, "mark": a.mark, "late_minutes": a.late_minutes, "comment": a.comment}
            for a, l_, s, sub in (await db.execute(stmt)).all()]


# ---------------------------------------------------------------- Дневник (ученик, родитель, сотрудники)

async def _diary_student(db: DbSession, user: User, student_id: int | None) -> Student:
    if user.role in FAMILY:
        allowed = await family_students(db, user)
        st = next((s for s in allowed if student_id in (None, s.id)), None)
        if st is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Нет доступа к дневнику этого ученика")
        return st
    st = await db.get(Student, student_id) if student_id else None
    if st is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ученик не найден")
    await _require_read(db, user, st.class_id)
    return st


@router.get("/diary/children")
async def diary_children(db: DbSession, user: CurrentUser) -> list[dict[str, Any]]:
    out = []
    for s in await family_students(db, user):
        cls = await db.get(SchoolClass, s.class_id)
        out.append({"id": s.id, "full_name": s.full_name, "class_name": cls.name})
    return out


@router.get("/diary/week")
async def diary_week(db: DbSession, user: CurrentUser, student_id: int | None = None, date: dt.date | None = None) -> dict[str, Any]:
    """Неделя дневника: расписание, темы, ДЗ, отметки посещаемости и оценки."""
    st = await _diary_student(db, user, student_id)
    d0 = (date or j.today())
    monday = d0 - dt.timedelta(days=d0.weekday())
    sunday = monday + dt.timedelta(days=6)
    v = await published(db)
    entries = list((await db.execute(select(TimetableEntry).options(
        selectinload(TimetableEntry.subject), selectinload(TimetableEntry.teacher), selectinload(TimetableEntry.room))
        .where(TimetableEntry.version_id == v.id, TimetableEntry.class_id == st.class_id)))) if v else []
    entries = [e for (e,) in entries]
    bells = {b.number: b for b in (await db.execute(select(BellSlot))).scalars()}
    lessons_ = {(lesson.date, lesson.slot): lesson for lesson in (await db.execute(select(Lesson).where(
        Lesson.class_id == st.class_id, Lesson.date >= monday, Lesson.date <= sunday))).scalars()}
    att = {a.lesson_id: a for a in (await db.execute(select(LessonAttendance).where(
        LessonAttendance.student_id == st.id, LessonAttendance.lesson_id.in_([x.id for x in lessons_.values()])))).scalars()}
    grades = defaultdict(list)
    for g in await j.grades_for(db, [st.id], None, monday, sunday):
        grades[g.date, g.subject_id].append({"value": g.value, "kind": g.kind, "comment": g.comment})
    days = []
    for i in range(7):
        day = monday + dt.timedelta(days=i)
        items = []
        for e in sorted((e for e in entries if e.day == day.isoweekday()), key=lambda e: e.slot):
            lesson = lessons_.get((day, e.slot))
            a = att.get(lesson.id) if lesson else None
            b = bells.get(e.slot)
            items.append({"slot": e.slot, "time": f"{b.start_time:%H:%M}–{b.end_time:%H:%M}" if b else None,
                          "subject": e.subject.name, "teacher": e.teacher.full_name, "room": e.room.name if e.room else None,
                          "topic": lesson.topic if lesson else None, "homework": lesson.homework if lesson else None,
                          "mark": a.mark if a else None, "late_minutes": a.late_minutes if a else None,
                          "grades": grades.get((day, e.subject_id), [])})
        if items or day.isoweekday() in settings.school_day_list:
            days.append({"date": day, "weekday": DAY_NAMES.get(day.isoweekday(), "Вс"), "lessons": items})
    cls = await db.get(SchoolClass, st.class_id)
    return {"student": {"id": st.id, "full_name": st.full_name, "class_name": cls.name}, "monday": monday, "days": days}


@router.get("/diary/grades")
async def diary_grades(db: DbSession, user: CurrentUser, student_id: int | None = None, school_year: str | None = None) -> dict[str, Any]:
    """Все оценки по предметам с комментариями, средние и итоговые (четверти, полугодия, год, аттестация)."""
    st = await _diary_student(db, user, student_id)
    school_year = school_year or await j.current_school_year(db)
    year = await j.period_bounds(db, school_year, PeriodCode.YEAR)
    subjects = {a.subject_id: a.subject.name for a in (await db.execute(select(TeachingAssignment).options(
        selectinload(TeachingAssignment.subject)).where(TeachingAssignment.class_id == st.class_id))).scalars()}
    grades = await j.grades_for(db, [st.id], None, *(year or (None, None)))
    finals = (await db.execute(select(PeriodGrade).where(PeriodGrade.student_id == st.id, PeriodGrade.school_year == school_year))).scalars()
    by_subject: dict[int, dict[str, Any]] = {sid: {"subject_id": sid, "subject": name, "grades": [], "periods": {}}
                                             for sid, name in subjects.items()}
    for g in grades:
        by_subject.setdefault(g.subject_id, {"subject_id": g.subject_id, "subject": str(g.subject_id), "grades": [], "periods": {}})
        by_subject[g.subject_id]["grades"].append({"date": g.date, "value": g.value, "kind": g.kind, "comment": g.comment})
    for p in finals:
        if p.subject_id in by_subject:
            by_subject[p.subject_id]["periods"][p.period.value] = {"value": p.value, "comment": p.comment}
    for row in by_subject.values():
        row["average"] = j.average([g["value"] for g in row["grades"]])
    return {"student": {"id": st.id, "full_name": st.full_name}, "school_year": school_year,
            "subjects": sorted(by_subject.values(), key=lambda r: r["subject"])}


@router.get("/diary/homework")
async def diary_homework(db: DbSession, user: CurrentUser, student_id: int | None = None,
                         days: Annotated[int, Query(ge=1, le=60)] = 14) -> list[dict[str, Any]]:
    st = await _diary_student(db, user, student_id)
    since = j.today() - dt.timedelta(days=days)
    rows = (await db.execute(select(Lesson, Subject).join(Subject, Subject.id == Lesson.subject_id).where(
        Lesson.class_id == st.class_id, Lesson.homework.is_not(None), Lesson.homework != "", Lesson.date >= since)
        .order_by(Lesson.date.desc(), Lesson.slot))).all()
    return [{"date": l_.date, "subject": sub.name, "homework": l_.homework, "due": l_.homework_due, "topic": l_.topic}
            for l_, sub in rows]

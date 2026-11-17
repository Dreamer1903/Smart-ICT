"""Учебная часть: справочники, нагрузка, пожелания учителей, расписание (помощник, правка, публикация, отчёт)."""

import datetime as dt
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import FAMILY, STAFF_ALL, CurrentUser, DbSession, require_roles
from app.core.config import settings
from app.core.events import commit_and_dispatch
from app.db.base import utcnow
from app.models import (
    AcademicPeriod,
    BellSlot,
    ClassRoom,
    Guardian,
    PeriodCode,
    ProposalStatus,
    SchoolClass,
    Student,
    Subject,
    TeacherPreference,
    TeachingAssignment,
    TimetableEntry,
    TimetableProposal,
    TimetableStatus,
    TimetableVersion,
    User,
    UserRole,
)
from app.services import timetable_db as tt
from app.services.enrollment import notify_users, users_with_roles
from app.services.timetable import DAY_NAMES

router = APIRouter(tags=["academic"])
R = UserRole
TT_MANAGERS = (R.ZAVUCH_ACADEMIC, R.ZAVUCH)  # + SuperAdmin автоматически
TT_OVERSIGHT = (*TT_MANAGERS, R.DIRECTOR, R.ZAVUCH_UPBRINGING)
Manager = Annotated[User, Depends(require_roles(*TT_MANAGERS))]
Oversight = Annotated[User, Depends(require_roles(*TT_OVERSIGHT))]
Staff = Annotated[User, Depends(require_roles(*STAFF_ALL))]


def _http(e: tt.TimetableError) -> HTTPException:
    return HTTPException(e.status_code, detail=str(e))


# ---------------------------------------------------------------- Справочники

class SubjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    short_name: str | None = None
    room_id: int | None = None


class SubjectPatch(BaseModel):
    name: str | None = None
    short_name: str | None = None
    room_id: int | None = None


class RoomIn(BaseModel):
    number: str = Field(min_length=1, max_length=16)
    name: str = Field(min_length=1, max_length=255)


class BellIn(BaseModel):
    number: int = Field(ge=1, le=12)
    start_time: dt.time
    end_time: dt.time


class PeriodIn(BaseModel):
    code: PeriodCode
    name: str
    start_date: dt.date
    end_date: dt.date


class AssignmentIn(BaseModel):
    class_id: int
    subject_id: int
    teacher_id: int
    hours_per_week: int = Field(ge=0, le=12)


class AssignmentPatch(BaseModel):
    teacher_id: int | None = None
    hours_per_week: int | None = Field(default=None, ge=0, le=12)


class ClassStaffPatch(BaseModel):
    homeroom_teacher_id: int | None = None
    curator_id: int | None = None


def _subject_out(s: Subject) -> dict[str, Any]:
    return {"id": s.id, "name": s.name, "short_name": s.short_name, "room_id": s.room_id,
            "room_name": s.room.name if s.room else None}


@router.get("/academic/subjects")
async def list_subjects(db: DbSession, _: CurrentUser) -> list[dict[str, Any]]:
    return [_subject_out(s) for s in (await db.execute(select(Subject).options(selectinload(Subject.room)).order_by(Subject.name))).scalars()]


@router.post("/academic/subjects", status_code=status.HTTP_201_CREATED)
async def create_subject(body: SubjectIn, db: DbSession, _: Manager) -> dict[str, Any]:
    s = Subject(**body.model_dump())
    db.add(s)
    await db.commit()
    return _subject_out(await _load_subject(db, s.id))


@router.patch("/academic/subjects/{subject_id}")
async def update_subject(subject_id: int, body: SubjectPatch, db: DbSession, _: Manager) -> dict[str, Any]:
    s = await _load_subject(db, subject_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    await db.commit()
    return _subject_out(await _load_subject(db, subject_id))


async def _load_subject(db: DbSession, sid: int) -> Subject:
    s = (await db.execute(select(Subject).options(selectinload(Subject.room)).where(Subject.id == sid)
                          .execution_options(populate_existing=True))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Предмет не найден")
    return s


@router.get("/academic/rooms")
async def list_rooms(db: DbSession, _: CurrentUser) -> list[dict[str, Any]]:
    return [{"id": r.id, "number": r.number, "name": r.name}
            for r in (await db.execute(select(ClassRoom).order_by(ClassRoom.number))).scalars()]


@router.post("/academic/rooms", status_code=status.HTTP_201_CREATED)
async def create_room(body: RoomIn, db: DbSession, _: Manager) -> dict[str, Any]:
    r = ClassRoom(**body.model_dump())
    db.add(r)
    await db.commit()
    return {"id": r.id, "number": r.number, "name": r.name}


@router.get("/academic/bells")
async def get_bells(db: DbSession, _: CurrentUser) -> dict[str, Any]:
    bells = (await db.execute(select(BellSlot).order_by(BellSlot.number))).scalars()
    return {"days": settings.school_day_list, "day_names": {d: DAY_NAMES[d] for d in settings.school_day_list},
            "slots": [{"number": b.number, "start_time": b.start_time.strftime("%H:%M"),
                       "end_time": b.end_time.strftime("%H:%M")} for b in bells]}


@router.put("/academic/bells")
async def set_bells(body: list[BellIn], db: DbSession, _: Manager) -> dict[str, Any]:
    for b in (await db.execute(select(BellSlot))).scalars():
        await db.delete(b)
    await db.flush()
    db.add_all(BellSlot(**b.model_dump()) for b in body)
    await db.commit()
    return await get_bells(db, _)


@router.get("/academic/periods")
async def get_periods(db: DbSession, _: CurrentUser, school_year: str | None = None) -> list[dict[str, Any]]:
    stmt = select(AcademicPeriod).order_by(AcademicPeriod.start_date, AcademicPeriod.code)
    if school_year:
        stmt = stmt.where(AcademicPeriod.school_year == school_year)
    return [{"id": p.id, "school_year": p.school_year, "code": p.code, "name": p.name,
             "start_date": p.start_date, "end_date": p.end_date} for p in (await db.execute(stmt)).scalars()]


@router.put("/academic/periods/{school_year}")
async def set_periods(school_year: str, body: list[PeriodIn], db: DbSession, _: Manager) -> list[dict[str, Any]]:
    existing = {p.code: p for p in (await db.execute(select(AcademicPeriod).where(AcademicPeriod.school_year == school_year))).scalars()}
    for p in body:
        if p.end_date < p.start_date:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"{p.name}: конец раньше начала")
        row = existing.get(p.code) or AcademicPeriod(school_year=school_year, code=p.code)
        row.name, row.start_date, row.end_date = p.name, p.start_date, p.end_date
        db.add(row)
    await db.commit()
    return await get_periods(db, _, school_year)


@router.get("/academic/teachers")
async def list_teachers(db: DbSession, _: Staff) -> list[dict[str, Any]]:
    """Все, кто может вести уроки: учителя и завучи/директор с нагрузкой."""
    with_load = {t for (t,) in (await db.execute(select(TeachingAssignment.teacher_id).distinct())).all()}
    users = (await db.execute(select(User).where(User.is_active.is_(True)).order_by(User.full_name))).scalars()
    return [{"id": u.id, "full_name": u.full_name, "role": u.role} for u in users
            if u.role is R.TEACHER or u.id in with_load or u.role in (R.ZAVUCH_ACADEMIC, R.ZAVUCH_UPBRINGING)]


async def _assignment_out(db: DbSession, a: TeachingAssignment) -> dict[str, Any]:
    return {"id": a.id, "class_id": a.class_id, "class_name": a.school_class.name, "subject_id": a.subject_id,
            "subject_name": a.subject.name, "teacher_id": a.teacher_id, "teacher_name": a.teacher.full_name,
            "hours_per_week": a.hours_per_week, "room_name": a.subject.room.name if a.subject.room else None}


def _assignment_query():  # noqa: ANN202
    return select(TeachingAssignment).options(
        selectinload(TeachingAssignment.school_class), selectinload(TeachingAssignment.teacher),
        selectinload(TeachingAssignment.subject).selectinload(Subject.room)).execution_options(populate_existing=True)


@router.get("/academic/assignments")
async def list_assignments(db: DbSession, _: Staff, class_id: int | None = None, teacher_id: int | None = None) -> list[dict[str, Any]]:
    stmt = _assignment_query()
    if class_id:
        stmt = stmt.where(TeachingAssignment.class_id == class_id)
    if teacher_id:
        stmt = stmt.where(TeachingAssignment.teacher_id == teacher_id)
    rows = [await _assignment_out(db, a) for a in (await db.execute(stmt)).scalars()]
    return sorted(rows, key=lambda r: (r["class_name"], r["subject_name"]))


@router.post("/academic/assignments", status_code=status.HTTP_201_CREATED)
async def create_assignment(body: AssignmentIn, db: DbSession, _: Manager) -> dict[str, Any]:
    if (await db.execute(select(TeachingAssignment.id).where(
            TeachingAssignment.class_id == body.class_id, TeachingAssignment.subject_id == body.subject_id))).first():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Этот предмет в классе уже назначен — измените существующую строку")
    a = TeachingAssignment(**body.model_dump())
    db.add(a)
    await db.commit()
    return await _assignment_out(db, (await db.execute(_assignment_query().where(TeachingAssignment.id == a.id))).scalar_one())


@router.patch("/academic/assignments/{assignment_id}")
async def update_assignment(assignment_id: int, body: AssignmentPatch, db: DbSession, _: Manager) -> dict[str, Any]:
    a = await db.get(TeachingAssignment, assignment_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Строка нагрузки не найдена")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    await db.commit()
    return await _assignment_out(db, (await db.execute(_assignment_query().where(TeachingAssignment.id == a.id))).scalar_one())


@router.delete("/academic/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(assignment_id: int, db: DbSession, _: Manager) -> None:
    a = await db.get(TeachingAssignment, assignment_id)
    if a:
        await db.delete(a)
        await db.commit()


@router.patch("/academic/classes/{class_id}")
async def update_class_staff(class_id: int, body: ClassStaffPatch, db: DbSession,
                             _: Annotated[User, Depends(require_roles(R.DIRECTOR, *TT_MANAGERS, R.ZAVUCH_UPBRINGING))]) -> dict[str, Any]:
    c = await db.get(SchoolClass, class_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Класс не найден")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    await db.commit()
    return {"id": c.id, "name": c.name, "homeroom_teacher_id": c.homeroom_teacher_id, "curator_id": c.curator_id}


# ---------------------------------------------------------------- Пожелания учителей

class PreferenceIn(BaseModel):
    cells: dict[str, str] = Field(default_factory=dict, examples=[{"2-1": "no", "1-1": "avoid"}])
    max_lessons_per_day: int | None = Field(default=None, ge=1, le=12)
    comment: str | None = None


def _pref_out(p: TeacherPreference | None, teacher: User) -> dict[str, Any]:
    return {"teacher_id": teacher.id, "teacher_name": teacher.full_name, "cells": p.cells if p else {},
            "max_lessons_per_day": p.max_lessons_per_day if p else None, "comment": p.comment if p else None,
            "updated_at": p.updated_at if p else None}


@router.get("/timetable/preferences/me")
async def my_preferences(db: DbSession, user: Staff) -> dict[str, Any]:
    return _pref_out(await db.get(TeacherPreference, user.id), user)


@router.put("/timetable/preferences/me")
async def set_my_preferences(body: PreferenceIn, db: DbSession, user: Staff) -> dict[str, Any]:
    days, sl = settings.school_day_list, await tt.slots(db)
    for key, val in body.cells.items():
        try:
            d, s = (int(v) for v in key.split("-"))
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Неверная клетка «{key}»") from None
        if d not in days or s not in sl or val not in ("no", "avoid"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Неверная клетка «{key}: {val}»")
    p = await db.get(TeacherPreference, user.id) or TeacherPreference(teacher_id=user.id)
    p.cells, p.max_lessons_per_day, p.comment = body.cells, body.max_lessons_per_day, body.comment
    db.add(p)
    notify_users(db, await users_with_roles(db, *TT_MANAGERS), "Учитель обновил пожелания к расписанию",
                 f"{user.full_name}: «не могу» — {sum(v == 'no' for v in body.cells.values())}, "
                 f"«нежелательно» — {sum(v == 'avoid' for v in body.cells.values())}", "/schedule")
    await commit_and_dispatch(db)
    return _pref_out(p, user)


@router.get("/timetable/preferences")
async def all_preferences(db: DbSession, _: Oversight) -> list[dict[str, Any]]:
    rows = (await db.execute(select(TeacherPreference, User).join(User, User.id == TeacherPreference.teacher_id)
                             .order_by(User.full_name))).all()
    return [_pref_out(p, u) for p, u in rows]


# ---------------------------------------------------------------- Варианты расписания

class GenerateIn(BaseModel):
    name: str = Field(default="Вариант", max_length=128)
    base_version_id: int | None = None  # взять закреплённые уроки из этой версии
    time_limit: float | None = Field(default=None, ge=5, le=300)


class EntryPatch(BaseModel):
    day: int | None = None
    slot: int | None = None
    locked: bool | None = None


def _entry_out(e: TimetableEntry) -> dict[str, Any]:
    return {"id": e.id, "class_id": e.class_id, "class_name": e.school_class.name, "subject_id": e.subject_id,
            "subject_name": e.subject.name, "subject_short": e.subject.short_name, "teacher_id": e.teacher_id,
            "teacher_name": e.teacher.full_name, "room_id": e.room_id, "room_name": e.room.name if e.room else None,
            "day": e.day, "slot": e.slot, "locked": e.locked}


def _entries_query():  # noqa: ANN202
    return select(TimetableEntry).options(
        selectinload(TimetableEntry.school_class), selectinload(TimetableEntry.subject),
        selectinload(TimetableEntry.teacher), selectinload(TimetableEntry.room)).order_by(TimetableEntry.day, TimetableEntry.slot)


def _version_out(v: TimetableVersion) -> dict[str, Any]:
    r = v.report or {}
    return {"id": v.id, "name": v.name, "status": v.status, "created_at": v.created_at, "published_at": v.published_at,
            "summary": {k: (len(r[k]) if isinstance(r.get(k), list) else r.get(k))
                        for k in ("lessons_placed", "lessons_planned", "conflicts", "wishes_violated", "class_gaps", "ok")}}


async def _version(db: DbSession, vid: int) -> TimetableVersion:
    v = await db.get(TimetableVersion, vid)
    if v is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Вариант расписания не найден")
    return v


@router.get("/timetable/versions")
async def list_versions(db: DbSession, _: Oversight) -> list[dict[str, Any]]:
    vs = (await db.execute(select(TimetableVersion).where(TimetableVersion.status != TimetableStatus.ARCHIVED)
                           .order_by(TimetableVersion.created_at.desc()))).scalars()
    return [_version_out(v) for v in vs]


@router.post("/timetable/versions/generate")
async def generate_version(body: GenerateIn, db: DbSession, user: Manager) -> dict[str, Any]:
    """Помощник составляет новый вариант. Если невозможно — 422 с объяснением причин."""
    try:
        v, problems, meta = await tt.generate(db, user, body.name, body.base_version_id, body.time_limit)
    except tt.TimetableError as e:
        raise _http(e) from None
    if v is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"message": "Расписание составить нельзя", "problems": problems, **meta})
    await db.commit()
    return {**_version_out(v), "solver": meta}


@router.get("/timetable/versions/{version_id}")
async def get_version(version_id: int, db: DbSession, _: Oversight) -> dict[str, Any]:
    v = await _version(db, version_id)
    entries = (await db.execute(_entries_query().where(TimetableEntry.version_id == v.id))).scalars()
    return {**_version_out(v), "report": v.report, "entries": [_entry_out(e) for e in entries]}


@router.post("/timetable/versions/{version_id}/copy")
async def copy_version(version_id: int, db: DbSession, user: Manager) -> dict[str, Any]:
    src = await _version(db, version_id)
    v = await tt.copy_version(db, src, f"{src.name} (копия)", user)
    await db.commit()
    return _version_out(v)


@router.post("/timetable/versions/{version_id}/analyze")
async def reanalyze(version_id: int, db: DbSession, _: Oversight) -> dict[str, Any]:
    v = await _version(db, version_id)
    v.report = {**(v.report or {}), **await tt.analyze_version(db, v.id)}
    await db.commit()
    return v.report


@router.post("/timetable/versions/{version_id}/publish")
async def publish_version(version_id: int, db: DbSession, user: Manager) -> dict[str, Any]:
    v = await _version(db, version_id)
    try:
        await tt.publish(db, v)
    except tt.TimetableError as e:
        raise _http(e) from None
    r = v.report or {}
    summary = (f"«{v.name}»: {r.get('lessons_placed')} уроков, конфликтов {len(r.get('conflicts', []))}, "
               f"нарушено пожеланий {len(r.get('wishes_violated', []))}, окон у классов {len(r.get('class_gaps', []))}")
    notify_users(db, await users_with_roles(db, R.DIRECTOR), "Опубликовано расписание — отчёт", summary, "/schedule/report")
    notify_users(db, await users_with_roles(db, R.TEACHER, R.ZAVUCH_UPBRINGING, R.ZAVUCH_ACADEMIC, R.ZAVUCH),
                 "Новое расписание", f"Действует расписание «{v.name}»", "/schedule", exclude=user)
    await commit_and_dispatch(db)
    return _version_out(v)


@router.delete("/timetable/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_version(version_id: int, db: DbSession, _: Manager) -> None:
    try:
        await tt.delete_version(db, await _version(db, version_id))
    except tt.TimetableError as e:
        raise _http(e) from None
    await db.commit()


@router.get("/timetable/entries/{entry_id}/check")
async def check_entry_move(entry_id: int, db: DbSession, _: Staff, day: int, slot: int) -> dict[str, Any]:
    e = await db.get(TimetableEntry, entry_id)
    if e is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Урок не найден")
    errors, warnings = await tt.check_move(db, e, day, slot)
    return {"ok": not errors, "errors": errors, "warnings": warnings}


@router.patch("/timetable/entries/{entry_id}")
async def move_entry(entry_id: int, body: EntryPatch, db: DbSession, user: Manager) -> dict[str, Any]:
    """Ручная правка завуча: перенос урока (с проверкой конфликтов) и закрепление."""
    e = (await db.execute(_entries_query().where(TimetableEntry.id == entry_id))).scalar_one_or_none()
    if e is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Урок не найден")
    v = await db.get(TimetableVersion, e.version_id)
    if v.status is TimetableStatus.ARCHIVED:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Архивный вариант не редактируется")
    warnings: list[str] = []
    if body.day is not None or body.slot is not None:
        day, slot = body.day or e.day, body.slot or e.slot
        errors, warnings = await tt.check_move(db, e, day, slot)
        if errors:
            raise HTTPException(status.HTTP_409_CONFLICT, detail={"message": "Перенос невозможен", "errors": errors})
        old = f"{DAY_NAMES.get(e.day)} {e.slot}-й"
        e.day, e.slot = day, slot
        if v.status is TimetableStatus.PUBLISHED:
            notify_users(db, [e.teacher], "Изменение в расписании",
                         f"{e.subject.name}, {e.school_class.name}: {old} → {DAY_NAMES.get(day)} {slot}-й урок", "/schedule", exclude=user)
    if body.locked is not None:
        e.locked = body.locked
    v.report = {**(v.report or {}), **await tt.analyze_version(db, v.id)}
    await commit_and_dispatch(db)
    return {**_entry_out(e), "warnings": warnings}


# ---------------------------------------------------------------- Просмотр расписания

@router.get("/timetable/view")
async def view_timetable(db: DbSession, _: Staff, class_id: int | None = None, teacher_id: int | None = None,
                         room_id: int | None = None, version_id: int | None = None) -> dict[str, Any]:
    v = await _version(db, version_id) if version_id else await tt.published(db)
    if v is None:
        return {"version": None, "entries": []}
    stmt = _entries_query().where(TimetableEntry.version_id == v.id)
    if class_id:
        stmt = stmt.where(TimetableEntry.class_id == class_id)
    if teacher_id:
        stmt = stmt.where(TimetableEntry.teacher_id == teacher_id)
    if room_id:
        stmt = stmt.where(TimetableEntry.room_id == room_id)
    return {"version": _version_out(v), "entries": [_entry_out(e) for e in (await db.execute(stmt)).scalars()]}


async def family_students(db: DbSession, user: User) -> list[Student]:
    """Ученики, которых видит пользователь-ученик (себя) или пользователь-родитель (своих детей)."""
    if user.role is R.STUDENT and user.student_id:
        s = await db.get(Student, user.student_id)
        return [s] if s else []
    if user.role is R.PARENT:
        ids = [sid for (sid,) in (await db.execute(select(Guardian.student_id).where(Guardian.user_id == user.id))).all()]
        return list((await db.execute(select(Student).where(Student.id.in_(ids)).order_by(Student.full_name))).scalars())
    return []


@router.get("/timetable/my")
async def my_timetable(db: DbSession, user: CurrentUser) -> dict[str, Any]:
    """Своё расписание: учитель — свои уроки (+ его класс как классного руководителя/куратора),
    ученик — свой класс, родитель — классы детей."""
    v = await tt.published(db)
    if v is None:
        return {"version": None, "views": []}
    views: list[dict[str, Any]] = []

    async def add(title: str, **flt: int) -> None:
        stmt = _entries_query().where(TimetableEntry.version_id == v.id)
        for k, val in flt.items():
            stmt = stmt.where(getattr(TimetableEntry, k) == val)
        views.append({"title": title, "entries": [_entry_out(e) for e in (await db.execute(stmt)).scalars()]})

    if user.role in FAMILY:
        for s in await family_students(db, user):
            cls = await db.get(SchoolClass, s.class_id)
            await add(f"{s.full_name}, {cls.name}" if user.role is R.PARENT else f"Мой класс {cls.name}", class_id=s.class_id)
    else:
        await add("Мои уроки", teacher_id=user.id)
        own = (await db.execute(select(SchoolClass).where(
            (SchoolClass.homeroom_teacher_id == user.id) | (SchoolClass.curator_id == user.id)))).scalars()
        for c in own:
            role = "классный руководитель" if c.homeroom_teacher_id == user.id else "куратор"
            await add(f"Класс {c.name} ({role})", class_id=c.id)
    return {"version": _version_out(v), "views": views}


# ---------------------------------------------------------------- Предложения учителей

class ProposalIn(BaseModel):
    entry_id: int
    to_day: int
    to_slot: int
    comment: str | None = None


class ResolveIn(BaseModel):
    accept: bool
    comment: str | None = None


async def _proposal_out(db: DbSession, p: TimetableProposal) -> dict[str, Any]:
    e = (await db.execute(_entries_query().where(TimetableEntry.id == p.entry_id))).scalar_one()
    errors, warnings = (await tt.check_move(db, e, p.to_day, p.to_slot)) if p.status is ProposalStatus.PENDING else ([], [])
    return {"id": p.id, "status": p.status, "entry": _entry_out(e), "to_day": p.to_day, "to_slot": p.to_slot,
            "comment": p.comment, "created_at": p.created_at, "resolution_comment": p.resolution_comment,
            "errors": errors, "warnings": warnings}


@router.post("/timetable/proposals", status_code=status.HTTP_201_CREATED)
async def propose(body: ProposalIn, db: DbSession, user: Staff) -> dict[str, Any]:
    """Учитель предлагает перенести свой урок."""
    e = await db.get(TimetableEntry, body.entry_id)
    if e is None or e.teacher_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Предложить перенос можно только своего урока")
    p = TimetableProposal(entry_id=e.id, teacher_id=user.id, to_day=body.to_day, to_slot=body.to_slot, comment=body.comment)
    db.add(p)
    await db.flush()
    notify_users(db, await users_with_roles(db, *TT_MANAGERS), "Учитель предлагает изменить расписание",
                 f"{user.full_name}: {DAY_NAMES.get(e.day)} {e.slot}-й → {DAY_NAMES.get(body.to_day)} {body.to_slot}-й урок",
                 "/schedule")
    await commit_and_dispatch(db)
    return await _proposal_out(db, p)


@router.get("/timetable/proposals")
async def list_proposals(db: DbSession, user: Staff, state: str = Query("PENDING", pattern="^(PENDING|ACCEPTED|REJECTED|ALL)$")) -> list[dict[str, Any]]:
    stmt = select(TimetableProposal).order_by(TimetableProposal.created_at.desc())
    if state != "ALL":
        stmt = stmt.where(TimetableProposal.status == ProposalStatus(state))
    if user.role not in (*TT_OVERSIGHT, R.SUPER_ADMIN):
        stmt = stmt.where(TimetableProposal.teacher_id == user.id)
    return [await _proposal_out(db, p) for p in (await db.execute(stmt)).scalars()]


@router.post("/timetable/proposals/{proposal_id}/resolve")
async def resolve_proposal(proposal_id: int, body: ResolveIn, db: DbSession, user: Manager) -> dict[str, Any]:
    p = await db.get(TimetableProposal, proposal_id)
    if p is None or p.status is not ProposalStatus.PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Предложение уже рассмотрено")
    e = (await db.execute(_entries_query().where(TimetableEntry.id == p.entry_id))).scalar_one()
    if body.accept:
        errors, _ = await tt.check_move(db, e, p.to_day, p.to_slot)
        if errors:
            raise HTTPException(status.HTTP_409_CONFLICT, detail={"message": "Перенос невозможен", "errors": errors})
        e.day, e.slot = p.to_day, p.to_slot
        v = await db.get(TimetableVersion, e.version_id)
        v.report = {**(v.report or {}), **await tt.analyze_version(db, v.id)}
    p.status = ProposalStatus.ACCEPTED if body.accept else ProposalStatus.REJECTED
    p.resolved_by_id, p.resolution_comment = user.id, body.comment
    teacher = await db.get(User, p.teacher_id)
    notify_users(db, [teacher], "Предложение по расписанию " + ("принято" if body.accept else "отклонено"),
                 body.comment or f"{e.subject.name}, {e.school_class.name}", "/schedule")
    await commit_and_dispatch(db)
    return await _proposal_out(db, p)

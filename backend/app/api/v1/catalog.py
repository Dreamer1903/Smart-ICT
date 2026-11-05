"""Каталог: ученики, классы, кабинеты, предметы, сотрудники (чтение)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import MANAGEMENT, STAFF_ALL, DbSession, require_roles
from app.models import ClassRoom, LocationStatus, SchoolClass, Student, Subject, User
from app.schemas.auth import UserOut
from app.schemas.catalog import ClassRoomOut, SchoolClassOut, StudentOut, SubjectOut

router = APIRouter(tags=["catalog"], dependencies=[Depends(require_roles(*STAFF_ALL))])


@router.get("/students", response_model=list[StudentOut])
async def list_students(
    db: DbSession,
    search: Annotated[str | None, Query(description="Поиск по ФИО или RFID")] = None,
    class_id: int | None = None,
    limit: Annotated[int, Query(le=500)] = 100,
) -> list[StudentOut]:
    stmt = (
        select(Student)
        .options(selectinload(Student.school_class), selectinload(Student.presence))
        .order_by(Student.full_name)
        .limit(limit)
    )
    if class_id is not None:
        stmt = stmt.where(Student.class_id == class_id)
    if search:
        # lower() в Python для кириллицы: SQLite LOWER() понимает только ASCII,
        # поэтому дополнительно ищем по варианту с заглавной первой буквой.
        term = search.strip()
        patterns = {f"%{term}%", f"%{term.lower()}%", f"%{term.capitalize()}%", f"%{term.title()}%"}
        stmt = stmt.where(
            or_(*[Student.full_name.like(p) for p in patterns], Student.rfid_card_id == term)
        )
    students = (await db.execute(stmt)).scalars().all()
    return [
        StudentOut(
            id=s.id,
            full_name=s.full_name,
            class_id=s.class_id,
            class_name=s.school_class.name,
            rfid_card_id=s.rfid_card_id,
            parent_phone=s.parent_phone,
            status=s.presence.current_location_status if s.presence else LocationStatus.UNKNOWN,
        )
        for s in students
    ]


@router.get("/classes", response_model=list[SchoolClassOut])
async def list_classes(db: DbSession) -> list[SchoolClassOut]:
    counts = (
        select(Student.class_id, func.count(Student.id).label("cnt")).group_by(Student.class_id).subquery()
    )
    rows = await db.execute(
        select(SchoolClass, func.coalesce(counts.c.cnt, 0))
        .outerjoin(counts, counts.c.class_id == SchoolClass.id)
        .order_by(SchoolClass.grade_level, SchoolClass.name)
    )
    return [
        SchoolClassOut.model_validate(c).model_copy(update={"student_count": cnt}) for c, cnt in rows.all()
    ]


@router.get("/classrooms", response_model=list[ClassRoomOut])
async def list_classrooms(db: DbSession) -> list[ClassRoom]:
    return list((await db.execute(select(ClassRoom).order_by(ClassRoom.number))).scalars())


@router.get("/subjects", response_model=list[SubjectOut])
async def list_subjects(db: DbSession) -> list[Subject]:
    return list((await db.execute(select(Subject).order_by(Subject.name))).scalars())


@router.get("/users", response_model=list[UserOut], dependencies=[Depends(require_roles(*MANAGEMENT))])
async def list_users(db: DbSession) -> list[User]:
    return list((await db.execute(select(User).order_by(User.role, User.full_name))).scalars())

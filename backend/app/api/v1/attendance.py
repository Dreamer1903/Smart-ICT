"""Перекличка учителя — источник статуса IN_CLASS (до появления модуля расписания)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession, require_roles
from app.core.events import commit_and_dispatch
from app.models import LocationStatus, SchoolClass, Student, StudentPresenceState, User, UserRole
from app.schemas.attendance import ClassCheckIn, ClassCheckOut
from app.services import presence

router = APIRouter(prefix="/attendance", tags=["attendance"])

Marker = Annotated[
    User,
    Depends(require_roles(UserRole.TEACHER, UserRole.ZAVUCH, UserRole.DIRECTOR, UserRole.DUTY_TEACHER)),
]


@router.post("/class-check", response_model=ClassCheckOut)
async def class_check(body: ClassCheckIn, db: DbSession, _: Marker) -> ClassCheckOut:
    if await db.get(SchoolClass, body.class_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Класс не найден")

    students = (await db.execute(select(Student).where(Student.class_id == body.class_id))).scalars().all()
    ids = {s.id for s in students}
    unknown = set(body.present_student_ids) - ids
    if unknown:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"Ученики не из этого класса: {sorted(unknown)}")

    present = set(body.present_student_ids)
    result = ClassCheckOut(marked_in_class=[], marked_missing=[], skipped_in_nurse=[])
    for s in students:
        state: StudentPresenceState = await presence.get_or_create_state(db, s.id)
        current = state.current_location_status
        if current is LocationStatus.IN_NURSE:
            result.skipped_in_nurse.append(s.id)
            continue
        if s.id in present:
            if current is not LocationStatus.IN_CLASS:
                note = "Отмечен на уроке" if state.last_gate_at else "Отмечен на уроке (нет прохода через СКУД)"
                await presence.set_status(db, s.id, LocationStatus.IN_CLASS, note=note, source="attendance")
            result.marked_in_class.append(s.id)
        elif current is LocationStatus.IN_CLASS:
            # был в классе, но на перекличке отсутствует — снова «в здании», запустится сверка
            await presence.set_status(
                db, s.id, LocationStatus.IN_BUILDING, note="Отсутствует на перекличке", source="attendance"
            )
            result.marked_missing.append(s.id)
    await commit_and_dispatch(db)
    return result

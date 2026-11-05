"""Digital Nurse: журнал медпункта с автообновлением Live-статуса."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import MANAGEMENT, DbSession, require_roles
from app.core.events import commit_and_dispatch
from app.db.base import utcnow
from app.models import LocationStatus, NurseOutcome, NurseVisit, Student, User, UserRole
from app.schemas.nurse import NurseVisitCreate, NurseVisitOut, NurseVisitUpdate
from app.services import presence

router = APIRouter(prefix="/nurse", tags=["nurse"])

NurseUser = Annotated[User, Depends(require_roles(UserRole.NURSE))]
NurseOrManagement = Annotated[User, Depends(require_roles(UserRole.NURSE, *MANAGEMENT))]


async def _load_visit(db: DbSession, visit_id: int) -> NurseVisit:
    visit = (
        await db.execute(
            select(NurseVisit)
            .where(NurseVisit.id == visit_id)
            .options(selectinload(NurseVisit.student).selectinload(Student.school_class),
                     selectinload(NurseVisit.student).selectinload(Student.presence))
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if visit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Визит не найден")
    return visit


def _to_out(visit: NurseVisit) -> NurseVisitOut:
    st = visit.student
    return NurseVisitOut(
        id=visit.id,
        student_id=visit.student_id,
        student_name=st.full_name,
        class_name=st.school_class.name,
        nurse_id=visit.nurse_id,
        start_time=visit.start_time,
        end_time=visit.end_time,
        reason=visit.reason,
        outcome=visit.outcome,
        notes=visit.notes,
        is_active=visit.is_active,
        student_status=st.presence.current_location_status if st.presence else LocationStatus.UNKNOWN,
    )


@router.get("/visits", response_model=list[NurseVisitOut])
async def list_visits(
    db: DbSession,
    _: NurseOrManagement,
    active: Annotated[bool | None, Query(description="true — только незакрытые визиты")] = None,
    limit: Annotated[int, Query(le=500)] = 100,
) -> list[NurseVisitOut]:
    stmt = (
        select(NurseVisit)
        .options(selectinload(NurseVisit.student).selectinload(Student.school_class),
                 selectinload(NurseVisit.student).selectinload(Student.presence))
        .order_by(NurseVisit.start_time.desc())
        .limit(limit)
    )
    if active is True:
        stmt = stmt.where(NurseVisit.end_time.is_(None))
    elif active is False:
        stmt = stmt.where(NurseVisit.end_time.is_not(None))
    return [_to_out(v) for v in (await db.execute(stmt)).scalars()]


@router.post("/visits", response_model=NurseVisitOut, status_code=status.HTTP_201_CREATED)
async def create_visit(body: NurseVisitCreate, db: DbSession, nurse: NurseUser) -> NurseVisitOut:
    """Зафиксировать приход ученика в медпункт («1 клик»). Статус → IN_NURSE."""
    if await db.get(Student, body.student_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ученик не найден")
    if await presence.get_active_visit(db, body.student_id) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="У ученика уже есть открытый визит в медпункт")

    visit = NurseVisit(
        student_id=body.student_id,
        nurse_id=nurse.id,
        start_time=body.start_time or utcnow(),
        reason=body.reason,
        notes=body.notes,
        outcome=body.outcome,
    )
    db.add(visit)
    await db.flush()
    await presence.apply_nurse_visit(db, visit)
    await commit_and_dispatch(db)
    return _to_out(await _load_visit(db, visit.id))


@router.patch("/visits/{visit_id}", response_model=NurseVisitOut)
async def update_visit(visit_id: int, body: NurseVisitUpdate, db: DbSession, _: NurseUser) -> NurseVisitOut:
    """Сменить исход визита: «Вернулся на урок» / «Домой». Статус ученика меняется автоматически."""
    visit = await _load_visit(db, visit_id)
    if not visit.is_active and body.outcome is not None and body.outcome != visit.outcome:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Визит уже закрыт")

    if body.reason is not None:
        visit.reason = body.reason
    if body.notes is not None:
        visit.notes = body.notes
    if body.outcome is not None and body.outcome != visit.outcome:
        visit.outcome = body.outcome
        if body.outcome is NurseOutcome.RESTING:
            visit.end_time = None
        await presence.apply_nurse_visit(db, visit)
    await commit_and_dispatch(db)
    return _to_out(await _load_visit(db, visit.id))

"""GateKeeper: приём вебхуков от турникетов СКУД."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from app.api.deps import GATE_OPERATORS, DbSession, gate_auth, require_roles
from app.core.events import commit_and_dispatch
from app.models import Student, TurnstileLog
from app.schemas.gate import GatePassIn, GatePassOut
from app.services import presence

router = APIRouter(prefix="/gate", tags=["gate"])


@router.post("/pass", response_model=GatePassOut, status_code=status.HTTP_201_CREATED)
async def gate_pass(body: GatePassIn, db: DbSession, _source: Annotated[str, Depends(gate_auth)]) -> GatePassOut:
    """Проход через турникет (IN/OUT).

    Авторизация: заголовок `X-Gate-Api-Key` (физический турникет) или Bearer JWT
    роли Director/Zavuch/DutyTeacher/SuperAdmin (симулятор в UI).
    """
    if body.student_id is not None:
        student = await db.get(Student, body.student_id)
    else:
        student = (
            await db.execute(select(Student).where(Student.rfid_card_id == body.rfid_card_id))
        ).scalar_one_or_none()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ученик / карта не найдены")

    log, state, applied = await presence.register_gate_pass(
        db, student.id, body.direction, body.timestamp, body.gate_id
    )
    await commit_and_dispatch(db)
    return GatePassOut(
        log_id=log.id,
        student_id=student.id,
        direction=log.direction,
        timestamp=log.timestamp,
        applied=applied,
        status=state.current_location_status,
        is_discrepancy=state.is_discrepancy,
    )


@router.get("/logs", dependencies=[Depends(require_roles(*GATE_OPERATORS))])
async def gate_logs(
    db: DbSession,
    student_id: int | None = None,
    limit: Annotated[int, Query(le=500)] = 50,
) -> list[dict[str, object]]:
    stmt = select(TurnstileLog).order_by(TurnstileLog.timestamp.desc()).limit(limit)
    if student_id is not None:
        stmt = stmt.where(TurnstileLog.student_id == student_id)
    return [
        {"id": l.id, "student_id": l.student_id, "timestamp": l.timestamp, "direction": l.direction, "gate_id": l.gate_id}
        for l in (await db.execute(stmt)).scalars()
    ]

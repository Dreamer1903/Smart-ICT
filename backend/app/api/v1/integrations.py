"""Входящие интеграции: вебхук оплаты из 1С."""

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.config import settings
from app.core.events import commit_and_dispatch
from app.integrations.onec import BalanceInfo
from app.models import Student
from app.schemas.access import OneCPaymentWebhook, PaymentCheckOut
from app.services import outbox
from app.services.access import deliver_command, on_payment_received
from app.services.payment import apply_balance, check_payment

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.post("/1c/payment-webhook", response_model=PaymentCheckOut)
async def onec_payment_webhook(
    body: OneCPaymentWebhook, db: DbSession, x_1c_secret: Annotated[str | None, Header()] = None
) -> PaymentCheckOut:
    """1С сообщает о поступлении оплаты / изменении баланса → доступ открывается автоматически."""
    if x_1c_secret != settings.onec_webhook_secret:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверный X-1C-Secret")
    student = (await db.execute(select(Student).where(Student.external_1c_id == body.account))).scalar_one_or_none()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Лицевой счёт {body.account} не привязан к ученику")

    if body.debt is not None:
        became_paid = await apply_balance(
            db, student, BalanceInfo(account=body.account, debt=body.debt, currency=body.currency, paid_until=body.paid_until)
        )
        has_debt, debt, source, error = body.debt > settings.payment_debt_threshold, body.debt, "1c_webhook", None
    else:
        pay, became_paid = await check_payment(db, student, force=True)
        has_debt, debt, source, error = pay.has_debt, pay.debt_amount, pay.source, pay.error

    reopened = await on_payment_received(db, student) if became_paid else None
    await commit_and_dispatch(db)
    if reopened:
        await deliver_command(db, reopened)
    outbox.kick()
    return PaymentCheckOut(student_id=student.id, has_debt=has_debt, debt_amount=debt, source=source, error=error,
                           reopened_event_id=reopened.event.id if reopened else None)


# ---------------------------------------------------------------- HikCentral Professional

from typing import Any  # noqa: E402

from fastapi import Depends, Query  # noqa: E402
from sqlalchemy import func  # noqa: E402

from app.api.deps import MANAGEMENT, require_roles  # noqa: E402
from app.integrations.hikcentral import HikCentralError  # noqa: E402
from app.models import AccessEvent, HikAccessState, IntegrationCursor  # noqa: E402
from app.schemas.access import HikStatus  # noqa: E402
from app.services import hik  # noqa: E402

hik_admin = [Depends(require_roles())]  # изменения конфигурации — только SuperAdmin


def _require_hik() -> None:
    if not settings.hik_enabled:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Интеграция с HikCentral выключена (HIK_ENABLED=false)")


@router.get("/hikcentral/status", response_model=HikStatus, dependencies=[Depends(require_roles(*MANAGEMENT))])
async def hik_status(db: DbSession) -> HikStatus:
    """Сводка: сколько учеников связано, кого нужно закрыть/открыть, какие коды событий приходят."""
    total = await db.scalar(select(func.count()).select_from(Student)) or 0
    linked = await db.scalar(select(func.count()).select_from(Student).where(Student.hik_person_id.is_not(None))) or 0
    states = (await db.execute(select(HikAccessState))).scalars().all()
    cursor = await db.get(IntegrationCursor, hik.EVENTS_CURSOR)
    types = (await db.execute(
        select(AccessEvent.external_event_type, func.count())
        .where(AccessEvent.external_event_type.is_not(None)).group_by(AccessEvent.external_event_type)
    )).all()
    return HikStatus(
        enabled=settings.hik_enabled, enforce=settings.hik_enforce, event_mode=settings.hik_event_mode,
        full_access_group_id=settings.hik_full_access_group_id, exit_only_group_id=settings.hik_exit_only_group_id,
        linked_students=linked, total_students=total,
        would_revoke=sum(1 for s in states if s.pending is False),
        would_grant=sum(1 for s in states if s.pending is True),
        queued=sum(1 for s in states if s.queued),
        last_event_cursor=cursor.value if cursor else None,
        seen_event_types={str(t): c for t, c in types},
    )


@router.post("/hikcentral/sync-persons", dependencies=hik_admin)
async def hik_sync_persons(db: DbSession) -> dict[str, Any]:
    """Связать людей HikCentral с учениками (по personCode = лицевой счёт 1С или по ФИО)."""
    _require_hik()
    try:
        report = await hik.sync_persons(db)
    except HikCentralError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(e)) from None
    await db.commit()
    return report.__dict__


@router.post("/hikcentral/sync-doors", dependencies=hik_admin)
async def hik_sync_doors(db: DbSession) -> dict[str, int]:
    _require_hik()
    try:
        created = await hik.sync_doors(db)
    except HikCentralError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(e)) from None
    await db.commit()
    return {"created": created}


@router.post("/hikcentral/reconcile", dependencies=hik_admin)
async def hik_reconcile(db: DbSession) -> dict[str, Any]:
    """Сверить права всех учеников. В режиме наблюдения только считает, кого нужно закрыть/открыть."""
    _require_hik()
    counts = await hik.reconcile_all(db)
    await db.commit()
    outbox.kick()
    return {"enforce": settings.hik_enforce, "result": counts}


@router.post("/hikcentral/poll", dependencies=hik_admin)
async def hik_poll(db: DbSession) -> dict[str, int]:
    _require_hik()
    try:
        counts = await hik.poll_events(db)
    except HikCentralError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(e)) from None
    await commit_and_dispatch(db)
    outbox.kick()
    return counts


@router.post("/hikcentral/events")
async def hik_events_webhook(payload: dict[str, Any], db: DbSession, token: str = Query(...)) -> dict[str, int]:
    """Приём событий по push-подписке HikCentral (адрес указывается как eventDest с ?token=...)."""
    if token != settings.hik_webhook_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверный token")
    _require_hik()
    params = payload.get("params") if isinstance(payload.get("params"), dict) else payload
    raw_events = params.get("events") or []
    counts: dict[str, int] = {}
    for raw in raw_events:
        ev = hik.normalize_event(raw) if isinstance(raw, dict) else None
        result = await hik.ingest_event(db, ev) if ev else "invalid"
        counts[result] = counts.get(result, 0) + 1
    await commit_and_dispatch(db)
    outbox.kick()
    return counts

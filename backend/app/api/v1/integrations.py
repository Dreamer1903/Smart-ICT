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

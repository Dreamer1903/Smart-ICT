"""Service Payment: финансовый статус ученика с кэшем и политикой отказа 1С."""

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.events import DomainEvent, enqueue_event
from app.db.base import utcnow
from app.integrations.health import health
from app.integrations.onec import BalanceInfo, PaymentProviderError
from app.integrations.registry import integrations
from app.models import PaymentStatusRecord, Student


@dataclass(slots=True)
class PaymentCheck:
    has_debt: bool | None  # None — статус неизвестен (1С недоступна и кэша нет)
    debt_amount: float | None
    source: str  # 1c | cache | stale_cache | none
    error: str | None = None


def _has_debt(debt: float) -> bool:
    return debt > settings.payment_debt_threshold


async def apply_balance(session: AsyncSession, student: Student, info: BalanceInfo) -> bool:
    """Сохранить ответ 1С. Возвращает True, если долг только что был погашен."""
    record = await session.get(PaymentStatusRecord, student.id)
    was_debtor = bool(record and record.has_debt)
    if record is None:
        record = PaymentStatusRecord(student_id=student.id)
        session.add(record)
    record.has_debt = _has_debt(info.debt)
    record.debt_amount = info.debt
    record.currency = info.currency
    record.paid_until = info.paid_until
    record.checked_at = utcnow()
    record.last_error = None
    record.last_error_at = None
    became_paid = was_debtor and not record.has_debt
    if was_debtor != record.has_debt:
        enqueue_event(session, DomainEvent(
            type="payment.changed",
            payload={"student_id": student.id, "has_debt": record.has_debt, "debt_amount": info.debt},
        ))
    await session.flush()
    return became_paid


async def check_payment(session: AsyncSession, student: Student, *, force: bool = False) -> tuple[PaymentCheck, bool]:
    """Проверить оплату. Возвращает (результат, became_paid)."""
    record = await session.get(PaymentStatusRecord, student.id)
    fresh_after = utcnow() - timedelta(seconds=settings.payment_cache_ttl_seconds)
    if not force and record is not None and record.last_error is None and record.checked_at >= fresh_after:
        return PaymentCheck(record.has_debt, record.debt_amount, "cache"), False

    if not student.external_1c_id:
        error = "У ученика не указан лицевой счёт 1С"
    else:
        try:
            info = await integrations.payment.fetch_balance(student.external_1c_id)
        except PaymentProviderError as e:
            error = str(e)
            health.error("1c", error)
        else:
            health.ok("1c")
            became_paid = await apply_balance(session, student, info)
            return PaymentCheck(_has_debt(info.debt), info.debt, "1c"), became_paid

    if record is not None:
        record.last_error = error[:255]
        record.last_error_at = utcnow()
        return PaymentCheck(record.has_debt, record.debt_amount, "stale_cache", error), False
    return PaymentCheck(None, None, "none", error), False

"""Фоновые задачи на APScheduler (в процессе API).

Для продакшна с несколькими воркерами эти же функции переносятся в Celery beat
(Redis-брокер) — бизнес-логика в app.services.presence от планировщика не зависит.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.core.events import commit_and_dispatch
from app.db.session import SessionLocal
from app.services import presence

logger = logging.getLogger(__name__)


async def discrepancy_job() -> None:
    async with SessionLocal() as session:
        flagged = await presence.recompute_discrepancies(session)
        await commit_and_dispatch(session)
        if flagged:
            logger.info("DISCREPANCY: помечено %s учеников", flagged)


async def daily_reset_job() -> None:
    async with SessionLocal() as session:
        await presence.reset_daily_presence(session)
        await commit_and_dispatch(session)
        logger.info("Ежедневный сброс Live-статусов выполнен")


async def payment_recheck_job() -> None:
    """Страховка к вебхуку 1С: опрос должников — при погашении долга доступ открывается сам."""
    from sqlalchemy import select

    from app.models import PaymentStatusRecord, Student
    from app.services import outbox
    from app.services.access import deliver_command, on_payment_received
    from app.services.payment import check_payment

    async with SessionLocal() as session:
        debtors = (await session.execute(
            select(Student).join(PaymentStatusRecord, PaymentStatusRecord.student_id == Student.id)
            .where(PaymentStatusRecord.has_debt.is_(True))
        )).scalars().all()
        reopened = []
        for student in debtors:
            _, became_paid = await check_payment(session, student, force=True)
            if became_paid:
                logger.info("Долг погашен: %s", student.full_name)
                if (r := await on_payment_received(session, student)) is not None:
                    reopened.append(r)
        await commit_and_dispatch(session)
        for r in reopened:
            await deliver_command(session, r)
        outbox.kick()


def build_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone=settings.school_timezone)
    scheduler.add_job(
        discrepancy_job, "interval", seconds=settings.discrepancy_check_interval_seconds,
        id="discrepancy", max_instances=1, coalesce=True,
    )
    scheduler.add_job(
        daily_reset_job, "cron", hour=settings.daily_reset_hour, minute=0,
        id="daily_reset", max_instances=1, coalesce=True,
    )
    scheduler.add_job(
        payment_recheck_job, "interval", seconds=settings.payment_recheck_interval_seconds,
        id="payment_recheck", max_instances=1, coalesce=True,
    )
    return scheduler

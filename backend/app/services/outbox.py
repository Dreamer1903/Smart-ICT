"""Transactional outbox + доставка: Robi и уведомления с экспоненциальными повторами."""

import asyncio
import logging
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.base import utcnow
from app.integrations.health import health
from app.integrations.registry import integrations
from app.models import OutboxMessage, OutboxStatus, Student

logger = logging.getLogger("schoolos.outbox")

_wakeup: asyncio.Event | None = None


def kick() -> None:
    """Разбудить воркер сразу после коммита (без ожидания очередного опроса)."""
    if _wakeup is not None:
        _wakeup.set()


def enqueue(session: AsyncSession, channel: str, payload: dict[str, Any]) -> None:
    session.add(OutboxMessage(channel=channel, payload=payload, status=OutboxStatus.PENDING, next_attempt_at=utcnow()))


# ---------------------------------------------------------------- Уведомления

def notify_parent(session: AsyncSession, student: Student, kind: str, text: str) -> None:
    """kind: entry | exit | deny | payment. Каналы и типы событий задаются в настройках."""
    channels = settings.notify_channel_set
    if "log" in channels:
        enqueue(session, "log", {"to": f"parent:{student.id}", "text": text})
    if "telegram" in channels and kind in settings.telegram_event_set and student.parent_telegram_chat_id:
        enqueue(session, "telegram", {"to": student.parent_telegram_chat_id, "text": text})
    if "sms" in channels and kind in settings.sms_event_set and student.parent_phone:
        enqueue(session, "sms", {"to": student.parent_phone, "text": text})


def notify_admin(session: AsyncSession, text: str) -> None:
    channels = settings.notify_channel_set
    if "log" in channels:
        enqueue(session, "log", {"to": "admin", "text": text})
    if "telegram" in channels and settings.telegram_admin_chat_id:
        enqueue(session, "telegram", {"to": settings.telegram_admin_chat_id, "text": text})


# ---------------------------------------------------------------- Доставка

async def _deliver(msg: OutboxMessage) -> None:
    p = msg.payload
    match msg.channel:
        case "robi":
            await integrations.robi.push_attendance(p)
        case "telegram":
            await integrations.telegram.send(p["to"], p["text"])
        case "sms":
            await integrations.sms.send(p["to"], p["text"])
        case "log":
            await integrations.log.send(p["to"], p["text"])
        case _:
            raise ValueError(f"Неизвестный канал {msg.channel}")


async def process_outbox(session: AsyncSession, limit: int = 50) -> int:
    """Отправить созревшие сообщения. Возвращает число успешно доставленных."""
    now = utcnow()
    msgs = (
        await session.execute(
            select(OutboxMessage)
            .where(OutboxMessage.status == OutboxStatus.PENDING, OutboxMessage.next_attempt_at <= now)
            .order_by(OutboxMessage.id)
            .limit(limit)
        )
    ).scalars().all()
    delivered = 0
    for msg in msgs:
        msg.attempts += 1
        try:
            await _deliver(msg)
        except Exception as e:  # noqa: BLE001 — любая ошибка канала → повтор
            msg.last_error = str(e)[:1000]
            if msg.channel != "log":
                health.error(msg.channel, str(e))
            if msg.attempts >= settings.outbox_max_attempts:
                msg.status = OutboxStatus.FAILED
            else:
                msg.next_attempt_at = now + timedelta(seconds=min(5 * 2 ** (msg.attempts - 1), 3600))
        else:
            if msg.channel != "log":
                health.ok(msg.channel)
            msg.status = OutboxStatus.SENT
            msg.sent_at = utcnow()
            delivered += 1
    await session.commit()
    return delivered


async def run_worker(session_factory) -> None:  # type: ignore[no-untyped-def]
    """Фоновый воркер outbox (запускается в lifespan приложения)."""
    global _wakeup
    _wakeup = asyncio.Event()
    while True:
        try:
            async with session_factory() as session:
                await process_outbox(session)
        except Exception:  # noqa: BLE001
            logger.exception("Ошибка обработки outbox")
        try:
            await asyncio.wait_for(_wakeup.wait(), timeout=settings.outbox_poll_seconds)
        except TimeoutError:
            pass
        _wakeup.clear()

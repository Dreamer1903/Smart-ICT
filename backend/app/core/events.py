"""Внутрипроцессная шина событий (Event-Driven ядро School OS).

Сервисы складывают доменные события в `session.info["pending_events"]`,
а `commit_and_dispatch()` публикует их ТОЛЬКО после успешного коммита —
подписчики (SSE-стрим дашборда) никогда не увидят откатившиеся изменения.

Для нескольких воркеров/инстансов шину можно заменить на Redis Pub/Sub,
сохранив тот же интерфейс publish/subscribe.
"""

import asyncio
import logging
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class DomainEvent:
    type: str  # например "presence.changed", "gate.pass", "nurse.visit"
    payload: dict[str, Any]
    occurred_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class EventBus:
    def __init__(self, queue_size: int = 256) -> None:
        self._subscribers: set[asyncio.Queue[DomainEvent]] = set()
        self._queue_size = queue_size

    def subscribe(self) -> asyncio.Queue[DomainEvent]:
        queue: asyncio.Queue[DomainEvent] = asyncio.Queue(maxsize=self._queue_size)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[DomainEvent]) -> None:
        self._subscribers.discard(queue)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    async def publish(self, event: DomainEvent) -> None:
        for queue in list(self._subscribers):
            if queue.full():  # медленный клиент — выбрасываем самое старое событие
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            queue.put_nowait(event)
        logger.debug("event published: %s", event.type)


event_bus = EventBus()


def enqueue_event(session: AsyncSession, event: DomainEvent) -> None:
    """Отложить публикацию события до коммита транзакции."""
    session.info.setdefault("pending_events", []).append(event)


async def commit_and_dispatch(session: AsyncSession) -> None:
    await session.commit()
    events: list[DomainEvent] = session.info.pop("pending_events", [])
    for event in events:
        await event_bus.publish(event)

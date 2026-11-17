"""Live Pulse: сводка для директора/завуча + SSE-стрим событий в реальном времени."""

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.api.deps import DbSession, require_roles, user_from_token
from app.core.events import commit_and_dispatch, event_bus
from app.models import UserRole
from app.schemas.dashboard import LivePulse
from app.services import presence
from app.services.dashboard import build_live_pulse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

VIEWERS = (UserRole.DIRECTOR, UserRole.ZAVUCH, UserRole.DUTY_TEACHER)
HEARTBEAT_SECONDS = 15


@router.get("/live-pulse", response_model=LivePulse, dependencies=[Depends(require_roles(*VIEWERS))])
async def live_pulse(db: DbSession) -> LivePulse:
    # Ленивая сверка: даже без планировщика DISCREPANCY актуален на момент запроса
    if await presence.recompute_discrepancies(db):
        await commit_and_dispatch(db)
    return await build_live_pulse(db)


@router.get("/stream", summary="Server-Sent Events: поток доменных событий")
async def stream(
    request: Request,
    db: DbSession,
    token: Annotated[str, Query(description="JWT (EventSource не умеет слать заголовки)")],
) -> StreamingResponse:
    user = await user_from_token(db, token)  # поток доступен всем сотрудникам (уведомления, приём, пульс)
    await db.close()  # соединение с БД стриму не нужно

    queue = event_bus.subscribe()

    async def generator() -> AsyncIterator[str]:
        try:
            yield "retry: 3000\nevent: hello\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                except TimeoutError:
                    yield ": heartbeat\n\n"
                    continue
                yield f"event: {event.type}\ndata: {json.dumps(event.to_dict(), ensure_ascii=False)}\n\n"
        finally:
            event_bus.unsubscribe(queue)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

"""Точка входа FastAPI: `uvicorn app.main:app --reload` (из папки backend/)."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.events import event_bus
from app.db.session import engine
from app.services.scheduler import build_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    scheduler = build_scheduler() if settings.scheduler_enabled else None
    if scheduler:
        scheduler.start()
    yield
    if scheduler:
        scheduler.shutdown(wait=False)
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="School OS — операционный мониторинг школы: СКУД, медпункт, Live Pulse.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["system"])
async def health() -> dict[str, object]:
    return {"status": "ok", "app": settings.app_name, "sse_subscribers": event_bus.subscriber_count}

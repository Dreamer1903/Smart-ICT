"""Async engine и фабрика сессий."""

from collections.abc import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=settings.sql_echo, pool_pre_ping=True)

if settings.is_sqlite:

    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record) -> None:  # type: ignore[no-untyped-def]
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


SessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI-зависимость: одна сессия на запрос."""
    async with SessionLocal() as session:
        yield session


async def recreate_schema(drop: bool = True) -> None:
    """Пересоздать все таблицы (seed, тесты, чистая загрузка). Для SQLite на время удаления
    отключаются проверки внешних ключей — между таблицами есть циклические ссылки."""
    import app.models  # noqa: F401 — регистрация моделей
    from app.db.base import Base

    async with engine.begin() as conn:
        if drop:
            if settings.is_sqlite:
                await conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
            await conn.run_sync(Base.metadata.drop_all)
            if settings.is_sqlite:
                await conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_stamp_head)


def _stamp_head(sync_conn) -> None:  # type: ignore[no-untyped-def]
    """Пометить свежесозданную схему последней версией миграций — чтобы будущие обновления
    (upgrade_db.py / alembic upgrade) применяли только новые изменения."""
    from pathlib import Path

    from alembic.config import Config
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory

    root = Path(__file__).resolve().parents[2]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    head = ScriptDirectory.from_config(cfg).get_current_head()
    MigrationContext.configure(sync_conn).stamp(ScriptDirectory.from_config(cfg), head)

"""Тестовое окружение: отдельная БД (SQLite-файл по умолчанию, либо TEST_DATABASE_URL),
планировщик выключен, перед каждым тестом схема пересоздаётся и заполняется seed-данными."""

import os
import tempfile
from collections.abc import AsyncIterator
from pathlib import Path

_tmp = Path(tempfile.mkdtemp()) / "test.db"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", f"sqlite+aiosqlite:///{_tmp}")
os.environ["SCHEDULER_ENABLED"] = "false"

import httpx  # noqa: E402
import pytest  # noqa: E402

import app.models  # noqa: E402,F401
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from seed import DEFAULT_PASSWORD, seed  # noqa: E402


@pytest.fixture(autouse=True)
async def fresh_db() -> AsyncIterator[None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session:
        await seed(session)
    yield


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as c:
        yield c


@pytest.fixture
def login(client: httpx.AsyncClient):  # type: ignore[no-untyped-def]
    async def _login(email: str) -> dict[str, str]:
        r = await client.post("/auth/login", json={"email": email, "password": DEFAULT_PASSWORD})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    return _login

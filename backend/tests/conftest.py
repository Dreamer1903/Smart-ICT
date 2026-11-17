"""Тестовое окружение: отдельная БД (SQLite-файл по умолчанию, либо TEST_DATABASE_URL),
планировщик выключен, перед каждым тестом схема пересоздаётся и заполняется seed-данными."""

import os
import tempfile
from collections.abc import AsyncIterator
from pathlib import Path

_tmp = Path(tempfile.mkdtemp()) / "test.db"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", f"sqlite+aiosqlite:///{_tmp}")
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["BCRYPT_ROUNDS"] = "4"

import httpx  # noqa: E402
import pytest  # noqa: E402

import app.models  # noqa: E402,F401
from app.db.session import SessionLocal, engine, recreate_schema  # noqa: E402
from app.main import app  # noqa: E402
from seed import DEFAULT_PASSWORD, seed  # noqa: E402


@pytest.fixture(autouse=True)
async def fresh_db() -> AsyncIterator[None]:
    await recreate_schema()
    async with SessionLocal() as session:
        await seed(session, with_timetable=False)  # расписание — отдельной фикстурой (решатель тратит секунды)
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


@pytest.fixture
async def timetable() -> None:
    """Составить и опубликовать расписание помощником (для тестов журнала и расписания)."""
    from sqlalchemy import select

    from app.models import User, UserRole
    from app.services import timetable_db

    async with SessionLocal() as session:
        admin = (await session.execute(select(User).where(User.role == UserRole.SUPER_ADMIN))).scalar_one()
        version, problems, _ = await timetable_db.generate(session, admin, "Тестовое расписание", None, 10)
        assert version is not None, problems
        await timetable_db.publish(session, version)
        await session.commit()

"""Интеграционные тесты контура доступа: контроллер → SchoolOS → 1С → решение → контроллер,
outbox → Telegram, вебхук 1С, политики недоступности 1С, TCP-протокол.

Внешние системы — реальное HTTP-приложение simulators.app через ASGITransport."""

import asyncio
import json
from collections.abc import Iterator
from datetime import timedelta

import httpx
import pytest
from sqlalchemy import select, update

from app.core.config import settings
from app.db.base import utcnow
from app.db.session import SessionLocal
from app.integrations.controllers import ControllerCommander
from app.integrations.health import health
from app.integrations.notify import TelegramNotifier
from app.integrations.onec import OneCHttpProvider
from app.integrations.registry import integrations
from app.models import OutboxMessage, OutboxStatus, PaymentStatusRecord, Student
from app.services.outbox import process_outbox
from simulators import app as sim

KEY = {"X-Gate-Api-Key": "dev-gate-key"}
SECRET = {"X-1C-Secret": "dev-1c-secret"}


class SimTransport(httpx.ASGITransport):
    """ASGI-транспорт к симулятору, понимающий абсолютные URL вида http://localhost:8010/..."""

    def __init__(self) -> None:
        super().__init__(app=sim.app)


@pytest.fixture(autouse=True)
def external_world(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    sim.ledger.reset()
    sim.controller_commands.clear()
    sim.messages.clear()
    health.states.clear()
    t = SimTransport()
    monkeypatch.setattr(integrations, "payment", OneCHttpProvider("http://sim/1c", transport=t))
    monkeypatch.setattr(integrations, "telegram", TelegramNotifier("TEST", "http://sim/telegram", transport=t))
    monkeypatch.setattr(integrations, "commander", ControllerCommander(transport=t))
    yield


async def _expire_payment_cache() -> None:
    async with SessionLocal() as s:
        await s.execute(update(PaymentStatusRecord).values(checked_at=utcnow() - timedelta(hours=1)))
        await s.commit()


async def _event(client, value: str, direction: str = "IN", device: str = "main-entrance-1", **kw) -> httpx.Response:
    return await client.post("/access/events", headers=KEY, json={
        "device_code": device, "direction": direction, "credential_kind": kw.get("kind", "RFID"), "credential_value": value,
    })


async def test_debtor_denied_good_student_granted_via_1c(client, login):
    await _expire_payment_cache()  # заставляем идти в 1С
    r = await _event(client, "RFID-0003")  # должник
    d = r.json()
    assert r.status_code == 200 and d["command"] == "DENY" and d["reason"] == "DEBT"
    assert "Обратитесь в администрацию" in d["display_text"] and "1200000" not in d["display_text"]

    r = await _event(client, "QR-0009", kind="QR")  # не пришедший утром Латипов, вход по QR
    d = r.json()
    assert d["command"] == "OPEN" and d["reason"] == "OK" and d["student_name"] == "Латипов Шахзод"
    assert d["class_name"] == '9"А"' and d["latency_ms"] is not None

    director = await login("director@school.uz")
    journal = (await client.get("/access/events", params={"limit": 2}, headers=director)).json()
    assert journal[0]["payment_source"] == "1c" and journal[1]["reason_label"] == "Задолженность по оплате"
    pulse = (await client.get("/dashboard/live-pulse", headers=director)).json()
    row = next(x for x in pulse["students"] if x["full_name"] == "Ганиев Рустам")
    assert row["status"] == "UNKNOWN" and "задолженность" in row["reason"]
    assert next(x for x in pulse["students"] if x["full_name"] == "Латипов Шахзод")["status"] == "IN_BUILDING"
    assert {s["name"]: s["healthy"] for s in (await client.get("/access/summary", headers=director)).json()["integrations"]}["1c"]


async def test_unknown_card_device_and_auth(client):
    assert (await _event(client, "NOPE")).json()["reason"] == "UNKNOWN_CREDENTIAL"
    assert (await _event(client, "RFID-0001", device="ghost")).status_code == 404
    bad = await client.post("/access/events", headers={"X-Gate-Api-Key": "x"},
                            json={"device_code": "main-entrance-1", "direction": "IN", "credential_value": "RFID-0001"})
    assert bad.status_code == 401


async def test_exit_always_allowed_even_for_debtor(client):
    d = (await _event(client, "RFID-0003", direction="OUT")).json()
    assert d["command"] == "OPEN" and d["reason"] == "EXIT_ALWAYS_ALLOWED"


async def test_onec_down_policies(client, monkeypatch):
    await _expire_payment_cache()
    sim.ledger.down = True
    # policy=cache: должник по кэшу — отказ, остальные — пропуск по последнему статусу
    assert (await _event(client, "RFID-0003")).json()["reason"] == "DEBT"
    assert (await _event(client, "RFID-0009")).json()["reason"] == "PAYMENT_CACHED"
    # нет кэша вовсе → пропуск по политике
    async with SessionLocal() as s:
        await s.execute(PaymentStatusRecord.__table__.delete().where(PaymentStatusRecord.student_id == 10))
        await s.commit()
    assert (await _event(client, "RFID-0010")).json()["reason"] == "PAYMENT_UNAVAILABLE_ALLOWED"
    # policy=deny → отказ
    monkeypatch.setattr(settings, "payment_unavailable_policy", "deny")
    d = (await _event(client, "RFID-0010", direction="IN")).json()
    assert d["command"] == "DENY" and d["reason"] == "PAYMENT_UNAVAILABLE_DENIED"
    assert health.states["1c"].healthy is False


async def test_payment_webhook_reopens_turnstile(client, login):
    # отказ на турникете 2 (adapter=HTTP — команда уходит на контроллер)
    assert (await _event(client, "RFID-0014", device="main-entrance-2")).json()["command"] == "DENY"
    assert sim.controller_commands[-1]["command"] == "DENY"

    sim.ledger.debts["LS-0014"] = 0.0  # родитель оплатил в кассе
    bad = await client.post("/integrations/1c/payment-webhook", json={"account": "LS-0014", "debt": 0})
    assert bad.status_code == 401
    r = await client.post("/integrations/1c/payment-webhook", headers=SECRET, json={"account": "LS-0014"})
    body = r.json()
    assert r.status_code == 200 and body["has_debt"] is False and body["reopened_event_id"]

    # турникет получил OPEN, ученик в здании, родителю ушло уведомление об оплате
    assert sim.controller_commands[-1]["command"] == "OPEN"
    assert sim.controller_commands[-1]["display_text"] == "Оплата получена, проходите"
    director = await login("director@school.uz")
    pulse = (await client.get("/dashboard/live-pulse", headers=director)).json()
    assert next(x for x in pulse["students"] if x["full_name"] == "Рахимова Нилуфар")["status"] == "IN_BUILDING"
    assert all(d["external_1c_id"] != "LS-0014" for d in (await client.get("/access/debtors", headers=director)).json())
    async with SessionLocal() as s:
        texts = [m.payload["text"] for m in (await s.execute(
            select(OutboxMessage).where(OutboxMessage.channel == "log"))).scalars()]
    assert any("Оплата за Рахимова Нилуфар получена" in t for t in texts)


async def test_override_lets_debtor_in(client, login):
    zavuch = await login("zavuch@school.uz")
    nurse = await login("nurse@school.uz")
    body = {"student_id": 3, "reason": "Обещание оплаты до пятницы", "hours": 2}
    assert (await client.post("/access/overrides", json=body, headers=nurse)).status_code == 403
    o = await client.post("/access/overrides", json=body, headers=zavuch)
    assert o.status_code == 201
    assert (await _event(client, "RFID-0003")).json()["reason"] == "OVERRIDE"
    debtors = (await client.get("/access/debtors", headers=zavuch)).json()
    assert next(d for d in debtors if d["student_id"] == 3)["override_id"] == o.json()["id"]
    await client.delete(f"/access/overrides/{o.json()['id']}", headers=zavuch)
    assert (await _event(client, "RFID-0003")).json()["reason"] == "DEBT"


async def test_outbox_delivers_telegram_with_retry(client, monkeypatch):
    monkeypatch.setattr(settings, "notify_channels", "log,telegram")
    await _event(client, "RFID-0009")
    async with SessionLocal() as s:
        await process_outbox(s, limit=500)
    assert any(m["channel"] == "telegram" and m["chat_id"] == "100000009" and "пришёл(ла) в школу" in m["text"]
               for m in sim.messages)

    # Telegram недоступен → сообщение остаётся PENDING с отложенной повторной попыткой
    monkeypatch.setattr(integrations, "telegram", TelegramNotifier("TEST", "http://127.0.0.1:1"))
    await _event(client, "RFID-0010")
    async with SessionLocal() as s:
        await process_outbox(s)
        msg = (await s.execute(select(OutboxMessage).where(OutboxMessage.channel == "telegram")
                               .order_by(OutboxMessage.id.desc()).limit(1))).scalar_one()
        assert msg.status is OutboxStatus.PENDING and msg.attempts == 1 and msg.next_attempt_at > utcnow()
    assert health.states["telegram"].healthy is False


async def test_recheck_job_detects_payment(client):
    from app.services.scheduler import payment_recheck_job

    sim.ledger.debts["LS-0019"] = 0.0  # оплата без вебхука
    await payment_recheck_job()
    async with SessionLocal() as s:
        st = (await s.execute(select(Student).where(Student.external_1c_id == "LS-0019"))).scalar_one()
        assert (await s.get(PaymentStatusRecord, st.id)).has_debt is False


async def test_tcp_protocol(monkeypatch):
    from app.integrations.tcp_listener import start_tcp_listener

    monkeypatch.setattr(settings, "tcp_listener_port", 0)
    monkeypatch.setattr(settings, "tcp_listener_host", "127.0.0.1")
    server = await start_tcp_listener()
    port = server.sockets[0].getsockname()[1]
    reader, writer = await asyncio.open_connection("127.0.0.1", port)

    async def call(msg: dict) -> dict:
        writer.write((json.dumps(msg) + "\n").encode())
        await writer.drain()
        return json.loads(await reader.readline())

    assert (await call({"type": "hello", "device_code": "main-entrance-1", "key": "dev-gate-key"}))["type"] == "hello_ok"
    assert (await call({"direction": "IN", "credential_value": "RFID-0009"}))["command"] == "OPEN"
    assert (await call({"direction": "IN", "credential_value": "RFID-0019"}))["command"] == "DENY"
    assert (await call({"direction": "SIDEWAYS"}))["type"] == "error"
    writer.close()
    server.close()

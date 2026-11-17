"""HikCentral Professional: связывание людей, управление уровнями доступа, приём событий.
Эмулятор HikCentral (simulators.app) проверяет подпись AK/SK и сам решает на «терминале»."""

from collections.abc import Iterator

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.integrations.health import health
from app.integrations.hikcentral import HikCentralClient
from app.integrations.onec import OneCHttpProvider
from app.integrations.registry import integrations
from app.models import AccessEvent, HikAccessState, OutboxMessage, Student
from app.services.outbox import process_outbox
from simulators import app as sim
from tests.test_access import SECRET, SimTransport

FULL, EXIT = sim.FULL_GROUP, sim.EXIT_GROUP


@pytest.fixture(autouse=True)
def hik_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    sim.hik_state.reset()
    sim.ledger.reset()
    health.states.clear()
    t = SimTransport()
    monkeypatch.setattr(integrations, "hik", HikCentralClient("http://sim/hik", "test-ak", "test-sk", transport=t))
    monkeypatch.setattr(integrations, "payment", OneCHttpProvider("http://sim/1c", transport=t))
    for k, v in {"hik_enabled": True, "hik_enforce": False, "hik_full_access_group_id": FULL,
                 "hik_exit_only_group_id": EXIT, "hik_granted_event_types": "196893",
                 "hik_denied_event_types": "197151"}.items():
        monkeypatch.setattr(settings, k, v)
    yield


async def _admin(login):
    return await login("admin@school.uz")


async def _link(client, login) -> dict:
    r = await client.post("/integrations/hikcentral/sync-persons", headers=await _admin(login))
    assert r.status_code == 200, r.text
    return r.json()


async def _deliver() -> None:
    async with SessionLocal() as s:
        await process_outbox(s, limit=500)


async def _poll(client, login) -> dict:
    r = await client.post("/integrations/hikcentral/poll", headers=await _admin(login))
    assert r.status_code == 200, r.text
    return r.json()


async def terminal(person_id: str | None, door: str = "1", direction: str = "IN") -> bool:
    """Человек у терминала эмулятора HikCentral; возвращает решение терминала."""
    import httpx

    async with httpx.AsyncClient(transport=SimTransport(), base_url="http://sim") as c:
        r = await c.post("/hik/admin/pass", json={"person_id": person_id, "door": door, "direction": direction})
        return r.json()["granted"]


def _pid(i: int) -> str:
    return str(1000 + i)


async def test_sync_persons_and_doors(client, login):
    rep = await _link(client, login)
    assert rep["matched"] == 20 and rep["hik_total"] == 21
    assert sorted(rep["unmatched_students"]) == ["Ахмедова Сабина", "Юлдашев Самандар"]  # ещё на приёме
    assert rep["unmatched_hik"] == ["9001: Охранник Иванов"]
    assert (await _link(client, login))["already_linked"] == 20
    r = await client.post("/integrations/hikcentral/sync-doors", headers=await _admin(login))
    assert r.json() == {"created": 4}
    nurse = await login("nurse@school.uz")
    assert (await client.post("/integrations/hikcentral/sync-persons", headers=nurse)).status_code == 403


async def test_observe_mode_changes_nothing(client, login):
    await _link(client, login)
    r = await client.post("/integrations/hikcentral/reconcile", headers=await _admin(login))
    assert r.json() == {"enforce": False, "result": {"would_revoke": 3, "in_sync": 17, "not_linked": 2}}
    await _deliver()
    assert _pid(3) in sim.hik_state.groups[FULL]  # в HikCentral ничего не поменялось
    st = (await client.get("/integrations/hikcentral/status", headers=await login("director@school.uz"))).json()
    assert st["linked_students"] == 20 and st["would_revoke"] == 3 and st["queued"] == 0


async def test_enforce_debt_payment_cycle(client, login, monkeypatch):
    monkeypatch.setattr(settings, "hik_enforce", True)
    await _link(client, login)
    assert (await client.post("/integrations/hikcentral/reconcile", headers=await _admin(login))).json()["result"] == {
        "revoke": 3, "in_sync": 17, "not_linked": 2}
    await _deliver()
    # Должник: убран из «Вход и выход», добавлен в «Только выход»
    assert _pid(14) not in sim.hik_state.groups[FULL] and _pid(14) in sim.hik_state.groups[EXIT]
    assert _pid(9) in sim.hik_state.groups[FULL]

    async def deny_msgs() -> int:
        async with SessionLocal() as s:
            msgs = (await s.execute(select(OutboxMessage).where(OutboxMessage.channel == "log"))).scalars()
            return sum(1 for m in msgs if "не выполнен" in m.payload["text"] and "Рахимова" in m.payload["text"])

    before = await deny_msgs()
    # Терминал не пускает должника на вход (дважды), но выпускает
    for _ in range(2):
        assert await terminal(_pid(14)) is False
    assert await terminal(_pid(14), door="2", direction="OUT") is True
    counts = await _poll(client, login)
    assert counts == {"denied": 2, "granted": 1}
    assert await _poll(client, login) == {"duplicate": 3}  # перекрытие окна не создаёт дублей

    async with SessionLocal() as s:
        events = (await s.execute(select(AccessEvent).where(AccessEvent.external_id.is_not(None))
                                  .order_by(AccessEvent.id))).scalars().all()
        assert [e.reason.value for e in events] == ["DEBT", "DEBT", "TERMINAL_GRANTED"]
        assert events[0].external_event_type == 197151
    assert await deny_msgs() - before == 1  # родителю — одно уведомление на серию отказов

    # Оплата в 1С → вебхук → право на вход возвращается в HikCentral
    sim.ledger.debts["LS-0014"] = 0.0
    r = await client.post("/integrations/1c/payment-webhook", headers=SECRET, json={"account": "LS-0014", "debt": 0})
    assert r.json()["has_debt"] is False
    await _deliver()
    assert _pid(14) in sim.hik_state.groups[FULL] and _pid(14) not in sim.hik_state.groups[EXIT]
    assert await terminal(_pid(14)) is True
    assert await _poll(client, login) == {"duplicate": 3, "granted": 1}
    pulse = (await client.get("/dashboard/live-pulse", headers=await login("director@school.uz"))).json()
    assert next(x for x in pulse["students"] if x["full_name"] == "Рахимова Нилуфар")["status"] == "IN_BUILDING"
    async with SessionLocal() as s:
        state = await s.get(HikAccessState, (await s.execute(
            select(Student.id).where(Student.external_1c_id == "LS-0014"))).scalar_one())
        assert state.full_access is True and state.pending is None and state.synced_at


async def test_override_restores_access(client, login, monkeypatch):
    monkeypatch.setattr(settings, "hik_enforce", True)
    await _link(client, login)
    await client.post("/integrations/hikcentral/reconcile", headers=await _admin(login))
    await _deliver()
    assert _pid(3) not in sim.hik_state.groups[FULL]
    zavuch = await login("zavuch@school.uz")
    o = await client.post("/access/overrides", json={"student_id": 3, "reason": "Обещание оплаты", "hours": 2}, headers=zavuch)
    await _deliver()
    assert _pid(3) in sim.hik_state.groups[FULL]
    await client.delete(f"/access/overrides/{o.json()['id']}", headers=zavuch)
    await _deliver()
    assert _pid(3) not in sim.hik_state.groups[FULL]


async def test_push_webhook_unknown_and_staff(client, login):
    await _link(client, login)
    payload = {"method": "OnEventNotify", "params": {"ability": "event_acs", "events": [
        {"eventId": "W1", "eventType": 196893, "happenTime": "2026-11-09T08:01:00+05:00", "srcIndex": "1",
         "data": {"personId": _pid(9), "inAndOutType": 1}},
        {"eventId": "W2", "eventType": 197151, "happenTime": "2026-11-09T08:02:00+05:00", "srcIndex": "1", "data": {}},
        {"eventId": "W3", "eventType": 196893, "happenTime": "2026-11-09T08:03:00+05:00", "srcIndex": "1",
         "data": {"personId": "9001"}},
        {"eventId": "W4", "eventType": 131329, "happenTime": "2026-11-09T08:04:00+05:00", "srcIndex": "1"},
    ]}}
    assert (await client.post("/integrations/hikcentral/events", params={"token": "bad"}, json=payload)).status_code == 401
    r = await client.post("/integrations/hikcentral/events", params={"token": "dev-hik-token"}, json=payload)
    assert r.json() == {"granted": 1, "denied": 1, "not_student": 1, "ignored": 1}
    r = await client.post("/integrations/hikcentral/events", params={"token": "dev-hik-token"}, json=payload)
    assert r.json() == {"duplicate": 2, "not_student": 1, "ignored": 1}
    async with SessionLocal() as s:
        texts = [m.payload["text"] for m in (await s.execute(select(OutboxMessage).where(OutboxMessage.channel == "log"))).scalars()]
    assert not any("Неизвестный идентификатор" in t and "hik-1" in t for t in texts)  # незнакомые лица не спамят


async def test_bad_signature_reported(client, login, monkeypatch):
    monkeypatch.setattr(integrations, "hik", HikCentralClient("http://sim/hik", "test-ak", "WRONG", transport=SimTransport()))
    r = await client.post("/integrations/hikcentral/sync-persons", headers=await _admin(login))
    assert r.status_code == 502 and "401" in r.json()["detail"]
    assert health.states["hikcentral"].healthy is False


async def test_disabled_by_default(client, login, monkeypatch):
    monkeypatch.setattr(settings, "hik_enabled", False)
    assert (await client.post("/integrations/hikcentral/reconcile", headers=await _admin(login))).status_code == 409

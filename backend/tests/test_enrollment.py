"""Приём ученика: менеджер → директор (уведомление) → кассир → классный руководитель (пансионат)
→ доступ в HikCentral → «Учится». Плюс карточка, история, отчёт посещаемости."""

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.core.config import settings
from app.core.events import commit_and_dispatch
from app.db.session import SessionLocal
from app.integrations.hikcentral import HikCentralClient
from app.integrations.registry import integrations
from app.models import LocationStatus, StudentPresenceState
from app.services.presence import reset_daily_presence
from simulators import app as sim
from tests.test_access import SimTransport

NEW_STUDENT = {
    "full_name": "Каримов Алишер", "class_id": 1, "birth_date": "2011-05-20",
    "guardians": [{"full_name": "Каримова Нигора", "relation": "мать", "phone": "+998901234567", "is_primary": True}],
}


async def _titles(client, headers, about: str | None = None) -> list[str]:
    items = (await client.get("/notifications", headers=headers)).json()["items"]
    return [n["title"] for n in items if about is None or about in (n["body"] or "")]


async def _register(client, login) -> dict:
    r = await client.post("/enrollments", json=NEW_STUDENT, headers=await login("manager@school.uz"))
    assert r.status_code == 201, r.text
    return r.json()


async def test_full_enrollment_flow(client, login):
    manager, director, cashier = [await login(u) for u in ("manager@school.uz", "director@school.uz", "cashier@school.uz")]
    teacher, teacher2, admin = await login("teacher@school.uz"), await login("teacher2@school.uz"), await login("admin@school.uz")

    assert (await client.post("/enrollments", json=NEW_STUDENT, headers=await login("nurse@school.uz"))).status_code == 403
    e = await _register(client, login)
    assert e["student"]["status"] == "ENROLLING" and e["done_steps"] == 1 and e["total_steps"] == 4
    assert [s["status"] for s in e["steps"]] == ["DONE", "PENDING", "PENDING", "PENDING"]
    assert e["steps"][2]["assignee_name"] == "Абдугафоров Мансур Рустамович"  # классный руководитель 9"А"

    # Каждый узнал о своём этапе
    assert "Поступил новый ученик" in await _titles(client, director)
    assert "Оформить оплату нового ученика" in await _titles(client, cashier)
    assert "В ваш класс поступил ученик" in await _titles(client, teacher, "Каримов Алишер")
    assert "В ваш класс поступил ученик" not in await _titles(client, teacher2, "Каримов Алишер")
    assert "Новая заявка на приём" in await _titles(client, await login("parents@school.uz"))

    # Директор может заменить классного руководителя, но это не «его задача»
    assert not any(x["id"] == e["id"] for x in (await client.get("/enrollments", params={"mine": True}, headers=director)).json())
    # «Мои задачи»: у кассира — оплата, у классного руководителя — приём в класс
    mine = (await client.get("/enrollments", params={"mine": True}, headers=cashier)).json()
    assert any(x["id"] == e["id"] for x in mine)
    assert not any(x["id"] == e["id"] for x in (await client.get("/enrollments", params={"mine": True}, headers=teacher2)).json())

    base = f"/enrollments/{e['id']}/steps"
    # Права: чужой классный руководитель и кассир не могут принять в класс
    assert (await client.post(f"{base}/CLASS_ACCEPTANCE/complete", json={"data": {"is_boarder": True}}, headers=teacher2)).status_code == 403
    assert (await client.post(f"{base}/CLASS_ACCEPTANCE/complete", json={"data": {"is_boarder": True}}, headers=cashier)).status_code == 403
    # Кассир: лицевой счёт уже занят → 409, затем новый
    r = await client.post(f"{base}/PAYMENT_SETUP/complete", json={"data": {"external_1c_id": "LS-0001"}}, headers=cashier)
    assert r.status_code == 409
    r = await client.post(f"{base}/PAYMENT_SETUP/complete",
                          json={"data": {"external_1c_id": "LS-0030", "contract_number": "Д-030"}}, headers=cashier)
    assert r.status_code == 200 and r.json()["done_steps"] == 2
    # Классный руководитель: без отметки пансионата нельзя
    assert (await client.post(f"{base}/CLASS_ACCEPTANCE/complete", json={"data": {}}, headers=teacher)).status_code == 400
    r = await client.post(f"{base}/CLASS_ACCEPTANCE/complete",
                          json={"data": {"is_boarder": True, "boarding_room": "П-201"}}, headers=teacher)
    assert r.status_code == 200

    # Пока не закрыт доступ — ученик не учится и не считается в «Пульсе»
    pulse = (await client.get("/dashboard/live-pulse", headers=director)).json()
    assert pulse["counters"]["total_students"] == 20
    r = await client.post(f"{base}/ACCESS_SETUP/complete", json={"data": {}}, headers=admin)
    done = r.json()
    assert done["status"] == "COMPLETED" and done["student"]["status"] == "ACTIVE"
    assert (await client.get("/dashboard/live-pulse", headers=director)).json()["counters"]["total_students"] == 21
    for h in (director, manager, teacher):
        assert "Ученик зачислен" in await _titles(client, h)

    # Карточка: этапы, история «кто что сделал», пансионат, оплата видна директору, но не медсестре
    sid = e["student"]["id"]
    card = (await client.get(f"/students/{sid}/card", headers=director)).json()
    assert card["is_boarder"] is True and card["boarding_room"] == "П-201" and card["external_1c_id"] == "LS-0030"
    assert card["guardians"][0]["full_name"] == "Каримова Нигора" and card["admission_date"]
    texts = [t["text"] for t in card["timeline"]]
    assert texts[0].startswith("Приём завершён") and any("Ли Анастасия Олеговна" in t for t in texts)
    assert any("пансионате (комната П-201)" in t for t in texts)
    assert len(card["history"]) == 1  # поступил сегодня — дни до поступления не показываются
    assert card["presence_status"] == "IN_BOARDING"  # пансионер сразу «в пансионате», а не «не пришёл»
    nurse_card = (await client.get(f"/students/{sid}/card", headers=await login("nurse@school.uz"))).json()
    assert nurse_card["payment"] is None and nurse_card["external_1c_id"] is None


async def test_access_step_closes_automatically_from_hikcentral(client, login, monkeypatch):
    for k, v in {"hik_enabled": True, "hik_full_access_group_id": "1", "hik_exit_only_group_id": "2"}.items():
        monkeypatch.setattr(settings, k, v)
    monkeypatch.setattr(integrations, "hik", HikCentralClient("http://sim/hik", "test-ak", "test-sk", transport=SimTransport()))
    sim.hik_state.reset()
    e = await _register(client, login)
    base = f"/enrollments/{e['id']}/steps"
    await client.post(f"{base}/PAYMENT_SETUP/complete", json={"data": {"external_1c_id": "LS-0031"}}, headers=await login("cashier@school.uz"))
    await client.post(f"{base}/CLASS_ACCEPTANCE/complete", json={"data": {"is_boarder": False}}, headers=await login("teacher@school.uz"))
    # Администратор добавил человека в HikCentral с personCode = лицевой счёт
    sim.hik_state.persons.append({"personId": "1031", "personCode": "LS-0031", "personName": "Каримов Алишер"})
    await client.post("/integrations/hikcentral/sync-persons", headers=await login("admin@school.uz"))
    enr = (await client.get("/enrollments", params={"state": "completed"}, headers=await login("director@school.uz"))).json()
    done = next(x for x in enr if x["id"] == e["id"])
    assert done["steps"][3]["data"] == {"hik_person_id": "1031", "auto": True}


async def test_profile_edits_and_permissions(client, login):
    teacher, zavuch = await login("teacher@school.uz"), await login("zavuch@school.uz")
    # Классный руководитель 9"А" может отметить пансионат своему ученику, но не перевести его
    assert (await client.patch("/students/1", json={"is_boarder": True, "boarding_room": "П-7"}, headers=teacher)).status_code == 200
    assert (await client.patch("/students/1", json={"class_id": 2}, headers=teacher)).status_code == 403
    assert (await client.patch("/students/11", json={"is_boarder": True}, headers=teacher)).status_code == 403  # чужой класс
    card = (await client.patch("/students/1", json={"class_id": 2}, headers=zavuch)).json()
    assert card["class_name"] == '9"Б"' and any('Переведён из 9"А" в 9"Б"' in t["text"] for t in card["timeline"])
    assert "В ваш класс переведён ученик" in await _titles(client, await login("teacher2@school.uz"))


async def test_attendance_report(client, login, monkeypatch):
    director = await login("director@school.uz")
    r = (await client.get("/reports/attendance", headers=director)).json()
    s = r["summary"]
    assert s["total"] == 20 and s["came"] == 15 and s["boarders"] == 3
    assert s["absent"] == 4  # Латипов не пришёл, 3 должника получили отказ; пансионерка Миронова — не «отсутствует»
    row = next(x for x in r["rows"] if x["full_name"] == "Павлов Артём")
    assert row["first_in"] and row["last_out"] and row["passes"] == 2
    assert next(x for x in r["rows"] if x["full_name"] == "Ганиев Рустам")["denied"] == 1
    monkeypatch.setattr(settings, "school_start_time", "23:59")
    assert (await client.get("/reports/attendance", headers=director)).json()["summary"]["late"] == 0
    local_now = datetime.now(ZoneInfo(settings.school_timezone))
    if local_now.hour >= 1:  # все утренние проходы были ≥ 40 минут назад, но в этот же день
        monkeypatch.setattr(settings, "school_start_time", "00:00")
        late = (await client.get("/reports/attendance", headers=director)).json()["summary"]["late"]
        assert late >= 1
    assert (await client.get("/reports/attendance", headers=await login("cashier@school.uz"))).status_code == 403


async def test_daily_reset_keeps_boarders_in_boarding(client):
    async with SessionLocal() as s:
        await reset_daily_presence(s)
        await commit_and_dispatch(s)
        states = {st.student_id: st.current_location_status for st in (await s.execute(select(StudentPresenceState))).scalars()}
    assert states[10] is LocationStatus.IN_BOARDING and states[16] is LocationStatus.IN_BOARDING
    assert states[1] is LocationStatus.UNKNOWN


async def test_notifications_read(client, login):
    director = await login("director@school.uz")
    n = (await client.get("/notifications", headers=director)).json()
    assert n["unread"] >= 2  # 2 новых ученика из seed
    await client.post(f"/notifications/{n['items'][0]['id']}/read", headers=director)
    assert (await client.get("/notifications", headers=director)).json()["unread"] == n["unread"] - 1
    await client.post("/notifications/read-all", headers=director)
    assert (await client.get("/notifications", headers=director)).json()["unread"] == 0

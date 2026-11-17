from datetime import timedelta

import httpx

from app.db.base import utcnow
from app.db.session import SessionLocal
from app.services.presence import recompute_discrepancies

GATE_KEY = {"X-Gate-Api-Key": "dev-gate-key"}


async def _student(client: httpx.AsyncClient, headers: dict[str, str], name: str) -> dict:
    r = await client.get("/students", params={"search": name}, headers=headers)
    assert r.status_code == 200 and r.json(), r.text
    return r.json()[0]


async def _pulse(client: httpx.AsyncClient, headers: dict[str, str]) -> dict:
    r = await client.get("/dashboard/live-pulse", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


async def test_login_and_me(client, login):
    bad = await client.post("/auth/login", json={"email": "nurse@school.uz", "password": "nope"})
    assert bad.status_code == 401
    h = await login("nurse@school.uz")
    me = await client.get("/auth/me", headers=h)
    assert me.json()["role"] == "Nurse"
    assert (await client.get("/auth/me")).status_code == 401


async def test_oauth2_form_login(client):
    r = await client.post("/auth/token", data={"username": "director@school.uz", "password": "school123"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "Director"


async def test_live_pulse_from_seed(client, login):
    c = (await _pulse(client, await login("director@school.uz")))["counters"]
    assert c == {
        "total_students": 20, "in_building": 15, "in_class": 12, "in_nurse": 1, "in_boarding": 1,
        "not_reached_class": 1, "discrepancies": 1, "left_school": 1,
        "not_arrived": 4,  # 1 не пришёл + 3 должника (пансионерка Миронова — в пансионате)
    }


async def test_rbac(client, login):
    nurse, director = await login("nurse@school.uz"), await login("director@school.uz")
    assert (await client.get("/dashboard/live-pulse", headers=nurse)).status_code == 403
    assert (await client.post("/nurse/visits", json={"student_id": 1, "reason": "x"}, headers=director)).status_code == 403
    assert (await client.get("/dashboard/live-pulse", headers=await login("admin@school.uz"))).status_code == 200


async def test_gate_pass_and_discrepancy(client, login):
    director = await login("director@school.uz")
    st = await _student(client, director, "Латипов")  # не пришёл сегодня
    assert st["status"] == "UNKNOWN"

    assert (await client.post("/gate/pass", json={"student_id": st["id"], "direction": "IN"},
                              headers={"X-Gate-Api-Key": "wrong"})).status_code == 401
    r = await client.post("/gate/pass", json={"rfid_card_id": st["rfid_card_id"], "direction": "IN"}, headers=GATE_KEY)
    assert r.status_code == 201 and r.json()["status"] == "IN_BUILDING" and r.json()["applied"]

    # Пока не истёк grace-период — флага нет; через 11 минут — DISCREPANCY
    async with SessionLocal() as s:
        assert await recompute_discrepancies(s) == 0
        assert await recompute_discrepancies(s, utcnow() + timedelta(minutes=11)) == 1
        await s.commit()
    row = next(x for x in (await _pulse(client, director))["students"] if x["student_id"] == st["id"])
    assert row["is_discrepancy"] and row["status"] == "IN_BUILDING"


async def test_gate_out_of_order_event_not_applied(client, login):
    director = await login("director@school.uz")
    st = await _student(client, director, "Павлов")  # ушёл 5 минут назад
    old = (utcnow() - timedelta(hours=2)).isoformat()
    r = await client.post("/gate/pass", json={"student_id": st["id"], "direction": "IN", "timestamp": old}, headers=GATE_KEY)
    assert r.status_code == 201 and r.json()["applied"] is False and r.json()["status"] == "LEFT_SCHOOL"


async def test_gate_simulator_requires_operator_role(client, login):
    body = {"student_id": 1, "direction": "IN"}
    assert (await client.post("/gate/pass", json=body, headers=await login("teacher@school.uz"))).status_code == 403
    assert (await client.post("/gate/pass", json=body, headers=await login("duty@school.uz"))).status_code == 201


async def test_nurse_flow_updates_live_status(client, login):
    nurse, director = await login("nurse@school.uz"), await login("director@school.uz")
    st = await _student(client, nurse, "Алиев")
    assert st["status"] == "IN_CLASS"

    r = await client.post("/nurse/visits", json={"student_id": st["id"], "reason": "Ушиб"}, headers=nurse)
    assert r.status_code == 201 and r.json()["student_status"] == "IN_NURSE"
    visit_id = r.json()["id"]
    dup = await client.post("/nurse/visits", json={"student_id": st["id"], "reason": "Ещё"}, headers=nurse)
    assert dup.status_code == 409
    assert (await _pulse(client, director))["counters"]["in_nurse"] == 2

    r = await client.patch(f"/nurse/visits/{visit_id}", json={"outcome": "SENT_HOME"}, headers=nurse)
    assert r.json()["student_status"] == "LEFT_SCHOOL" and r.json()["end_time"] and not r.json()["is_active"]
    active = await client.get("/nurse/visits", params={"active": True}, headers=nurse)
    assert all(v["id"] != visit_id for v in active.json())


async def test_gate_out_closes_active_visit(client, login):
    nurse = await login("nurse@school.uz")
    visit = (await client.get("/nurse/visits", params={"active": True}, headers=nurse)).json()[0]
    r = await client.post("/gate/pass", json={"student_id": visit["student_id"], "direction": "OUT"}, headers=GATE_KEY)
    assert r.json()["status"] == "LEFT_SCHOOL"
    assert (await client.get("/nurse/visits", params={"active": True}, headers=nurse)).json() == []


async def test_attendance_class_check(client, login):
    teacher = await login("teacher@school.uz")
    st = await _student(client, teacher, "Козлова")  # «потерялась» в здании
    r = await client.post("/attendance/class-check",
                          json={"class_id": st["class_id"], "present_student_ids": [st["id"]]}, headers=teacher)
    body = r.json()
    assert r.status_code == 200 and st["id"] in body["marked_in_class"]
    # остальные 6 пропущенных турникетом учеников 9"А" (должник Ганиев не прошёл) отсутствуют на перекличке → IN_BUILDING,
    # а т.к. прошли турникет >10 минут назад — сразу DISCREPANCY
    assert len(body["marked_missing"]) == 6
    pulse = await _pulse(client, await login("zavuch@school.uz"))
    row = next(x for x in pulse["students"] if x["student_id"] == st["id"])
    assert row["status"] == "IN_CLASS" and not row["is_discrepancy"]
    assert pulse["counters"]["discrepancies"] == 6

    foreign = await client.post("/attendance/class-check",
                                json={"class_id": st["class_id"], "present_student_ids": [999]}, headers=teacher)
    assert foreign.status_code == 422

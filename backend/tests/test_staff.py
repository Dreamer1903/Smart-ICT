"""Сотрудники: загрузка из Excel (лист «Сотрудники»), роли по отделам, логины и временные пароли,
повторная загрузка, роль «не назначена», управление учётными записями."""

import json
from io import BytesIO

import openpyxl

ROWS = [
    [601, "Абдурахмонов Меродж", "Abdurahmonov Meroj", "Администрация"],
    [602, "Каримова Нигора", "Karimova Nigora", "Учителя"],
    [603, "Каримова Нигора", "Karimova Nigora", "Учителя"],  # полная тёзка — другой логин
    [604, "Юлдашев О'ктам", "Yuldashev O'ktam", "Учителя"],
    [605, "Повар Анна", "Povar Anna", "Столовая персонал"],
    [606, "Охранник Иван", "Ohrannik Ivan", "Технический персонал"],
    [607, "Ли Мария", "Li Mariya", "Менеджер"],
]


def make_xlsx(rows) -> bytes:
    wb = openpyxl.Workbook()
    wb.active.title = "Ученики"
    wb.active.append(["ID", "ФИО (рус.)", "ФИО (лат.)", "Класс"])
    ws = wb.create_sheet("Сотрудники")
    ws.append(["ID", "ФИО (рус.)", "ФИО (лат.)", "Отдел"])
    for r in rows:
        ws.append(r)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _post(client, h, data, dry_run, **form):
    return client.post("/staff/import", params={"dry_run": dry_run}, headers=h, data={"domain": "oxford.uz", **form},
                       files={"file": ("сотрудники.xlsx", data, "application/octet-stream")})


async def test_import_staff_flow(client, login):
    h = await login("director@school.uz")
    data = make_xlsx(ROWS)
    pre = (await _post(client, h, data, True)).json()
    assert pre["rows"] == 7 and pre["created"] == 5 and pre["skipped"] == 2 and pre["accounts"] == []
    assert pre["departments"]["Учителя"] == {"count": 3, "role": "Teacher"}
    assert pre["departments"]["Столовая персонал"]["role"] == "SKIP"
    assert (await client.get("/staff", params={"q": "oxford.uz"}, headers=h)).json() == []  # предпросмотр ничего не записал

    # Технический персонал — тоже создать (как «роль не назначена»)
    rep = (await _post(client, h, data, False, mapping=json.dumps({"Технический персонал": "Staff"}))).json()
    assert rep["created"] == 6 and rep["skipped"] == 1
    acc = {a["email"]: a for a in rep["accounts"]}
    assert {"karimova.nigora@oxford.uz", "karimova.nigora2@oxford.uz", "yuldashev.oktam@oxford.uz",
            "abdurahmonov.meroj@oxford.uz", "li.mariya@oxford.uz", "ohrannik.ivan@oxford.uz"} == set(acc)
    assert acc["karimova.nigora@oxford.uz"]["role"] == "Teacher" and acc["abdurahmonov.meroj@oxford.uz"]["role"] == "Staff"

    # Учитель входит с временным паролем и попадает в журнал; «роль не назначена» — без доступа к разделам
    t = await client.post("/auth/login", json={"email": "yuldashev.oktam@oxford.uz", "password": acc["yuldashev.oktam@oxford.uz"]["password"]})
    assert t.status_code == 200 and t.json()["user"]["role"] == "Teacher"
    s = await client.post("/auth/login", json={"email": "abdurahmonov.meroj@oxford.uz", "password": acc["abdurahmonov.meroj@oxford.uz"]["password"]})
    sh = {"Authorization": f"Bearer {s.json()['access_token']}"}
    assert (await client.get("/students", headers=sh)).status_code == 403
    assert (await client.get("/dashboard/live-pulse", headers=sh)).status_code == 403

    # Директор назначает роль и ставит личный Gmail для входа через Google
    sid = s.json()["user"]["id"]
    r = await client.patch(f"/staff/{sid}", json={"role": "ZavuchAcademic", "email": "meroj.a@gmail.com"}, headers=h)
    assert r.status_code == 200 and r.json()["role"] == "ZavuchAcademic" and r.json()["email"] == "meroj.a@gmail.com"
    assert (await client.patch(f"/staff/{sid}", json={"email": "director@school.uz"}, headers=h)).status_code == 409

    # Повторная загрузка: без дублей, назначенная роль и почта не перезаписываются, ФИО обновляется
    rows2 = [list(x) for x in ROWS]
    rows2[0][1] = "Абдурахмонов Меродж Олимович"
    rep2 = (await _post(client, h, make_xlsx(rows2), False, mapping=json.dumps({"Технический персонал": "Staff"}))).json()
    assert (rep2["created"], rep2["updated"], rep2["unchanged"]) == (0, 1, 5) and rep2["accounts"] == []
    me = next(u for u in (await client.get("/staff", params={"q": "Меродж"}, headers=h)).json())
    assert me["role"] == "ZavuchAcademic" and me["email"] == "meroj.a@gmail.com" and me["full_name"].endswith("Олимович")

    # Сброс пароля
    new = (await client.post(f"/staff/{sid}/reset-password", headers=h)).json()["temporary_password"]
    assert (await client.post("/auth/login", json={"email": "meroj.a@gmail.com", "password": new})).status_code == 200


async def test_staff_rights_and_validation(client, login):
    h = await login("director@school.uz")
    assert (await _post(client, await login("zavuch@school.uz"), make_xlsx(ROWS), True)).status_code == 403
    assert (await _post(client, h, make_xlsx(ROWS), True, domain="без домена")).status_code == 400
    assert (await _post(client, h, b"not excel", True)).status_code == 400
    me = (await client.get("/auth/me", headers=h)).json()
    assert (await client.patch(f"/staff/{me['id']}", json={"is_active": False}, headers=h)).status_code == 400
    admin = next(u for u in (await client.get("/staff", params={"role": "SuperAdmin"}, headers=h)).json())
    assert (await client.patch(f"/staff/{admin['id']}", json={"full_name": "Взлом"}, headers=h)).status_code == 403
    r = await client.post("/staff", json={"email": "new.teacher@gmail.com", "full_name": "Новый Учитель", "role": "Teacher"}, headers=h)
    assert r.status_code == 201 and r.json()["temporary_password"]
    assert (await client.post("/staff", json={"email": "x@gmail.com", "full_name": "Хакер", "role": "SuperAdmin"}, headers=h)).status_code == 403


def test_login_transliteration():
    from app.services.staff_import import login_from_latin

    assert login_from_latin("Abdurahmonov Meroj") == "abdurahmonov.meroj"
    assert login_from_latin("Юлдашев Ўткир") == "yuldashev.otkir"  # кириллица в столбце «лат.»
    assert login_from_latin("Qodirov G'ayrat") == "qodirov.gayrat"

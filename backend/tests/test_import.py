"""Импорт учеников из Excel (формат выгрузки HikCentral)."""

from io import BytesIO

import openpyxl

from app.services.importer import grade_of


def make_xlsx(rows: list[list[object]], extra_sheet: bool = True) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Ученики"
    ws.append(["ID", "ФИО (рус.)", "ФИО (лат.)", "Класс"])
    for r in rows:
        ws.append(r)
    if extra_sheet:  # лист сотрудников не должен попасть в учеников
        wb.create_sheet("Сотрудники").append(["ID", "ФИО (рус.)", "ФИО (лат.)", "Отдел"])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


ROWS = [
    [501, "Иванов Пётр", "Ivanov Pyotr", "1A"],
    [502, "Иванов Пётр", "Ivanov Pyotr", "2B"],  # полный тёзка — другой ID, другой ученик
    [503, "Каримова Лола", "Karimova Lola", "Pre-School"],
    [None, None, None, None],
    [504, "", "", "1A"],  # пустое ФИО
    [501, "Дубль Дублев", "", "1A"],  # повтор ID
    [505, "Мадина", "Madina", "10D"],  # одно слово
]


def _post(client, headers, data: bytes, dry_run: bool):
    return client.post("/students/import", params={"dry_run": dry_run}, headers=headers,
                       files={"file": ("ученики.xlsx", data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})


async def test_import_preview_apply_and_reimport(client, login):
    h = await login("parents@school.uz")
    data = make_xlsx(ROWS)

    preview = (await _post(client, h, data, dry_run=True)).json()
    assert preview["rows"] == 4 and preview["created"] == 4 and preview["dry_run"] is True
    assert preview["classes_created"] == ["Pre-School", "1A", "2B", "10D"]
    assert len(preview["warnings"]) == 3  # пустое ФИО, повтор ID, одно слово
    students = (await client.get("/students", params={"search": "Иванов"}, headers=h)).json()
    assert students == []  # предпросмотр ничего не записал

    applied = (await _post(client, h, data, dry_run=False)).json()
    assert applied["created"] == 4
    ivanovs = (await client.get("/students", params={"search": "Иванов"}, headers=h)).json()
    assert sorted(s["class_name"] for s in ivanovs) == ["1A", "2B"]  # тёзки — два разных ученика
    assert all(s["student_status"] == "ACTIVE" for s in ivanovs)

    # Повторная загрузка: перевод в другой класс и исправленное ФИО, без дублей
    moved = make_xlsx([[501, "Иванов Пётр", "Ivanov Pyotr", "2B"], [502, "Иванов Пётр", "Ivanov Pyotr", "2B"],
                       [503, "Каримова Лола", "Karimova Lola", "Pre-School"], [505, "Мадина Юсупова", "Madina", "10D"]])
    r = (await _post(client, h, moved, dry_run=False)).json()
    assert (r["created"], r["updated"], r["moved"], r["unchanged"]) == (0, 2, 1, 2)
    timelines = []
    for st in (await client.get("/students", params={"search": "Иванов"}, headers=h)).json():
        card = (await client.get(f"/students/{st['id']}/card", headers=h)).json()
        assert card["class_name"] == "2B"
        timelines += [t["text"] for t in card["timeline"]]
    assert "Переведён из 1A в 2B (импорт из Excel)" in timelines


async def test_import_errors_and_permissions(client, login):
    assert (await _post(client, await login("cashier@school.uz"), make_xlsx(ROWS), True)).status_code == 403
    h = await login("director@school.uz")
    bad = await _post(client, h, b"not an excel file", True)
    assert bad.status_code == 400 and "Excel" in bad.json()["detail"]
    wb = openpyxl.Workbook()
    wb.active.append(["Имя", "Возраст"])
    buf = BytesIO()
    wb.save(buf)
    r = await _post(client, h, buf.getvalue(), True)
    assert r.status_code == 400 and "ID" in r.json()["detail"]


def test_grade_of():
    assert [grade_of(x) for x in ("Pre-School", "1A", "10D", "11C")] == [0, 1, 10, 11]

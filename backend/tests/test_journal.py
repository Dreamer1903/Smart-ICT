"""Электронный журнал и дневник: уроки по расписанию, посещаемость с уведомлениями (кл. руководителю,
куратору, завучу по воспитательной части, родителям), оценки с комментариями, итоговые, ДЗ, дневник."""

import datetime as dt

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import OutboxMessage
from app.services.journal import today


async def _ids(client, h):
    subjects = {s["name"]: s["id"] for s in (await client.get("/academic/subjects", headers=h)).json()}
    classes = {c["name"]: c["id"] for c in (await client.get("/classes", headers=h)).json()}
    return subjects, classes


async def _scheduled_date(client, h, class_id, subject_id) -> tuple[dt.date, int]:
    """Ближайшая (от понедельника 16.11.2026) дата, когда по расписанию идёт этот урок."""
    view = (await client.get("/timetable/view", params={"class_id": class_id}, headers=h)).json()["entries"]
    e = next(x for x in view if x["subject_id"] == subject_id)
    return dt.date(2026, 11, 16) + dt.timedelta(days=e["day"] - 1), e["slot"]


async def _parent_texts() -> list[str]:
    async with SessionLocal() as s:
        return [m.payload["text"] for m in (await s.execute(select(OutboxMessage).where(OutboxMessage.channel == "log"))).scalars()
                if str(m.payload.get("to", "")).startswith("parent:")]


async def _titles(client, h) -> list[str]:
    return [f"{n['title']} | {n['body']}" for n in (await client.get("/notifications", headers=h)).json()["items"]]


async def test_lesson_attendance_notifications(client, login, timetable):
    t = await login("teacher@school.uz")  # информатика во всех классах, кл. руководитель 9"А"
    subjects, classes = await _ids(client, t)
    inf, a9 = subjects["Информатика"], classes['9"А"']
    mine = (await client.get("/journal/my-classes", headers=t)).json()
    assert {r["subject_name"] for r in mine if r["can_write"]} == {"Информатика"}
    assert any(r["class_id"] == a9 and not r["can_write"] for r in mine)  # свой класс — только просмотр других предметов

    day, slot = await _scheduled_date(client, t, a9, inf)
    lessons = (await client.get("/journal/lessons", params={"class_id": a9, "subject_id": inf,
               "date_from": "2026-11-16", "date_to": "2026-11-22"}, headers=t)).json()
    assert {(x["date"], x["slot"]) for x in lessons} >= {(day.isoformat(), slot)}

    # Чужой предмет открыть нельзя, урок не по расписанию — тоже
    assert (await client.get("/journal/lesson", params={"class_id": a9, "subject_id": subjects["Математика"],
            "date": day.isoformat(), "slot": slot}, headers=t)).status_code == 403
    lesson = (await client.get("/journal/lesson", params={"class_id": a9, "subject_id": inf, "date": day.isoformat(),
              "slot": slot}, headers=t)).json()
    lid, students = lesson["lesson"]["id"], lesson["students"]
    assert len(students) == 10

    marks = [{"student_id": students[0]["id"], "mark": "ABSENT"},
             {"student_id": students[1]["id"], "mark": "LATE", "late_minutes": 10}] + \
            [{"student_id": s["id"], "mark": "PRESENT"} for s in students[2:]]
    r = await client.put(f"/journal/lessons/{lid}/attendance", json=marks, headers=t)
    assert r.json() == {"saved": 10, "notified": 2}
    # Повторное сохранение — без повторных уведомлений
    assert (await client.put(f"/journal/lessons/{lid}/attendance", json=marks, headers=t)).json()["notified"] == 0

    texts = await _parent_texts()
    assert any(students[0]["full_name"] in x and "отсутствовал" in x for x in texts)
    assert any(students[1]["full_name"] in x and "опоздал(а) на 10 мин" in x for x in texts)
    for who in ("upbringing@school.uz", "history@school.uz"):  # завуч по воспитательной части и куратор 9"А"
        notes = await _titles(client, await login(who))
        assert any("Посещаемость: 9\"А\", Информатика" in n and students[0]["full_name"] in n for n in notes)

    rep = (await client.get("/journal/attendance-report", params={"date_from": day.isoformat()},
                            headers=await login("upbringing@school.uz"))).json()
    assert {x["mark"] for x in rep} == {"ABSENT", "LATE"}


async def test_absent_in_class_but_in_building_flags_discrepancy(client, login, timetable):
    h = await login("academic@school.uz")
    subjects, classes = await _ids(client, h)
    a9 = classes['9"А"']
    busy = {e["slot"] for e in (await client.get("/timetable/view", params={"class_id": a9}, headers=h)).json()["entries"]
            if e["day"] == today().isoweekday()}
    slot = next(s for s in range(1, 8) if s not in busy)
    lesson = (await client.get("/journal/lesson", params={"class_id": a9, "subject_id": subjects["Информатика"],
              "date": today().isoformat(), "slot": slot}, headers=h)).json()
    aliev = next(s for s in lesson["students"] if s["full_name"] == "Алиев Тимур")  # прошёл турникет утром
    await client.put(f"/journal/lessons/{lesson['lesson']['id']}/attendance",
                     json=[{"student_id": aliev["id"], "mark": "ABSENT"}], headers=h)
    pulse = (await client.get("/dashboard/live-pulse", headers=await login("director@school.uz"))).json()
    row = next(x for x in pulse["students"] if x["student_id"] == aliev["id"])
    assert row["is_discrepancy"] and "отсутствует на уроке" in row["reason"]


async def test_grades_period_grades_homework_and_diary(client, login, timetable):
    t = await login("teacher@school.uz")
    subjects, classes = await _ids(client, t)
    inf, a9 = subjects["Информатика"], classes['9"А"']
    day, slot = await _scheduled_date(client, t, a9, inf)
    lesson = (await client.get("/journal/lesson", params={"class_id": a9, "subject_id": inf, "date": day.isoformat(),
              "slot": slot}, headers=t)).json()
    aliev = next(s for s in lesson["students"] if s["full_name"] == "Алиев Тимур")
    lid = lesson["lesson"]["id"]

    base = {"student_id": aliev["id"], "subject_id": inf, "class_id": a9, "date": day.isoformat(), "lesson_id": lid}
    assert (await client.post("/journal/grades", json={**base, "value": 6}, headers=t)).status_code == 400
    assert (await client.post("/journal/grades", json={**base, "value": 5}, headers=await login("math@school.uz"))).status_code == 403
    g1 = (await client.post("/journal/grades", json={**base, "value": 5, "kind": "TEST",
                                                     "comment": "Отлично решил задачи на циклы"}, headers=t)).json()
    await client.post("/journal/grades", json={**base, "value": 4}, headers=t)
    await client.patch(f"/journal/grades/{g1['id']}", json={"comment": "Отлично! Циклы и условия"}, headers=t)

    r = await client.patch(f"/journal/lessons/{lid}", json={"topic": "Циклы for", "homework": "§12, задачи 1–5"}, headers=t)
    assert r.json()["homework"] == "§12, задачи 1–5"

    book = (await client.get("/journal/gradebook", params={"class_id": a9, "subject_id": inf, "period": "Q2"}, headers=t)).json()
    row = next(x for x in book["rows"] if x["student_id"] == aliev["id"])
    assert row["average"] == 4.5 and row["suggested"] == 5 and book["can_write"]
    for period, value in (("Q2", 5), ("H1", 5), ("FINAL", 4)):
        r = await client.put("/journal/period-grades", json={"class_id": a9, "subject_id": inf, "period": period,
                             "grades": [{"student_id": aliev["id"], "value": value, "comment": "Итог"}]}, headers=t)
        assert r.json() == {"saved": 1}

    # Дневник ученика и родителя
    for who in ("student@school.uz", "parent@school.uz"):
        h = await login(who)
        week = (await client.get("/diary/week", params={"date": day.isoformat()}, headers=h)).json()
        lessons_today = next(d for d in week["days"] if d["date"] == day.isoformat())["lessons"]
        inf_lesson = next(x for x in lessons_today if x["subject"] == "Информатика")
        assert inf_lesson["homework"] == "§12, задачи 1–5" and inf_lesson["topic"] == "Циклы for"
        assert {g["value"] for g in inf_lesson["grades"]} == {5, 4} and inf_lesson["time"]
        grades = (await client.get("/diary/grades", headers=h)).json()
        inf_row = next(x for x in grades["subjects"] if x["subject"] == "Информатика")
        assert inf_row["average"] == 4.5 and inf_row["periods"]["Q2"]["value"] == 5 and inf_row["periods"]["FINAL"]["value"] == 4
        assert any(g["comment"] == "Отлично! Циклы и условия" for g in inf_row["grades"])
        hw = (await client.get("/diary/homework", params={"days": 60}, headers=h)).json()
        assert hw and hw[0]["homework"] == "§12, задачи 1–5"

    # Ученик не видит чужой дневник
    other = next(s for s in lesson["students"] if s["full_name"] != "Алиев Тимур")
    assert (await client.get("/diary/week", params={"student_id": other["id"]},
                             headers=await login("student@school.uz"))).status_code == 403
    # Классный руководитель видит дневник своего ученика
    assert (await client.get("/diary/grades", params={"student_id": aliev["id"]}, headers=t)).status_code == 200

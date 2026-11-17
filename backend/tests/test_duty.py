"""Дежурства: график по расписанию (мало уроков, нет урока во время смены, «не могу», справедливость),
уведомления, отметка по QR, контроль «не приступил / пропустил», замена, права."""

import datetime as dt
from collections import Counter, defaultdict
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import DutyAssignment, DutyShift, DutyStatus, User
from app.services import duty

WEEK = {"date_from": "2026-11-16", "date_to": "2026-11-20"}


def local(y, m, d, hh, mm) -> dt.datetime:
    return dt.datetime(y, m, d, hh, mm, tzinfo=ZoneInfo(settings.school_timezone))


async def test_generate_roster_follows_timetable(client, login, timetable):
    h = await login("upbringing@school.uz")
    rep = (await client.post("/duty/generate", json=WEEK, headers=h)).json()
    assert rep["assigned"] >= 20, rep  # 5 смен × 5 дней = 25 мест
    roster = (await client.get("/duty/roster", params=WEEK, headers=h)).json()
    view = (await client.get("/timetable/view", headers=h)).json()["entries"]
    bells = {b["number"]: (b["start_time"], b["end_time"]) for b in (await client.get("/academic/bells", headers=h)).json()["slots"]}
    lessons = defaultdict(list)
    for e in view:
        lessons[e["teacher_id"], e["day"]].append(e["slot"])
    per_day = Counter()
    for a in roster:
        wd = dt.date.fromisoformat(a["date"]).isoweekday()
        slots = lessons[a["teacher_id"], wd]
        assert slots, f"{a['teacher_name']} дежурит в день без уроков"
        for s in slots:  # во время смены нет урока
            b1, b2 = bells[s]
            assert not (a["start_time"] < b2 and b1 < a["end_time"]), f"урок во время смены: {a}"
        assert not (a["teacher_name"].startswith("Хамидова") and wd in (2, 4)), "совместитель в свой выходной"
        assert a["lessons_that_day"] == len(slots)
        per_day[a["date"], a["teacher_id"]] += 1
    assert max(per_day.values()) == 1  # не больше одного дежурства в день
    counts = Counter(a["teacher_id"] for a in roster)
    assert max(counts.values()) - min(counts.values()) <= 3  # распределено поровну
    # Каждый дежурный получил свой график на неделю
    async with SessionLocal() as s:
        emails = {u.id: u.email for u in (await s.execute(select(User))).scalars()}
    for tid in counts:
        notes = (await client.get("/notifications", headers=await login(emails[tid]))).json()["items"]
        assert any(n["title"] == "Ваши дежурства 16.11–20.11" for n in notes), emails[tid]


async def _make_assignment(teacher_email: str, day: dt.date, post_name: str = "2 этаж") -> int:
    async with SessionLocal() as s:
        t = (await s.execute(select(User).where(User.email == teacher_email))).scalar_one()
        sh = (await s.execute(select(DutyShift).options(selectinload(DutyShift.post)))).scalars().all()
        shift = next(x for x in sh if x.post.name == post_name)
        a = DutyAssignment(date=day, shift_id=shift.id, teacher_id=t.id)
        s.add(a)
        await s.commit()
        return a.id


async def test_qr_checkin_on_time_late_wrong_post(client, login):
    day = dt.date(2026, 11, 17)
    aid = await _make_assignment("teacher@school.uz", day)  # 2 этаж, 10:10–10:25
    posts = {p["name"]: p for p in (await client.get("/duty/posts", headers=await login("upbringing@school.uz"))).json()}
    assert all(p["qr_token"] for p in posts.values())
    teacher_posts = (await client.get("/duty/posts", headers=await login("teacher@school.uz"))).json()
    assert all(p["qr_token"] is None for p in teacher_posts)  # учителю токены QR не показываем

    async with SessionLocal() as s:
        t = (await s.execute(select(User).where(User.email == "teacher@school.uz"))).scalar_one()
        # чужой пост
        try:
            await duty.checkin(s, t, posts["Столовая"]["qr_token"], local(2026, 11, 17, 10, 12))
            raise AssertionError("должна быть ошибка")
        except duty.DutyError as e:
            assert "другом посту" in str(e)
        # слишком рано
        try:
            await duty.checkin(s, t, posts["2 этаж"]["qr_token"], local(2026, 11, 17, 9, 0))
            raise AssertionError("должна быть ошибка")
        except duty.DutyError as e:
            assert "10:10–10:25" in str(e)
        # опоздание 8 минут
        a = await duty.checkin(s, t, posts["2 этаж"]["qr_token"], local(2026, 11, 17, 10, 18))
        assert a.id == aid and a.status is DutyStatus.STARTED and a.late_minutes == 8
        await s.commit()

    # Через API: неверный и «нет дежурства»
    h = await login("math@school.uz")
    assert (await client.post("/duty/checkin", json={"token": "bad"}, headers=h)).status_code == 404
    r = await client.post("/duty/checkin", json={"token": posts["2 этаж"]["qr_token"]}, headers=h)
    assert r.status_code == 404 and "нет дежурства" in r.json()["detail"]
    assert (await client.post("/duty/checkin", json={"token": "x"}, headers=await login("student@school.uz"))).status_code == 403

    # Замена QR: старый код перестаёт работать
    up = await login("upbringing@school.uz")
    new = (await client.post(f"/duty/posts/{posts['2 этаж']['id']}/rotate-qr", headers=up)).json()["qr_token"]
    assert new != posts["2 этаж"]["qr_token"]
    r = await client.post("/duty/checkin", json={"token": posts["2 этаж"]["qr_token"]}, headers=h)
    assert r.status_code == 404 and "недействителен" in r.json()["detail"]


async def test_morning_notification_reminder_and_missed(client, login):
    day = dt.date(2026, 11, 18)
    aid = await _make_assignment("math@school.uz", day)  # 10:10–10:25
    async with SessionLocal() as s:
        assert await duty.notify_today(s, local(2026, 11, 18, 6, 30)) == 0  # до 07:00 не шлём
        assert await duty.notify_today(s, local(2026, 11, 18, 7, 0)) == 1
        assert await duty.notify_today(s, local(2026, 11, 18, 7, 5)) == 0  # один раз
        assert await duty.watch(s, local(2026, 11, 18, 10, 15)) == {"reminded": 0, "missed": 0}
        assert await duty.watch(s, local(2026, 11, 18, 10, 21)) == {"reminded": 1, "missed": 0}
        assert await duty.watch(s, local(2026, 11, 18, 10, 30)) == {"reminded": 0, "missed": 1}
        await s.commit()
        assert (await s.get(DutyAssignment, aid)).status is DutyStatus.MISSED
    math = [n["title"] for n in (await client.get("/notifications", headers=await login("math@school.uz"))).json()["items"]]
    assert "Сегодня у вас дежурство" in math and "Вы не отметились на дежурстве" in math
    up = (await client.get("/notifications", headers=await login("upbringing@school.uz"))).json()["items"]
    assert any(n["title"] == "Дежурный не приступил" and "Рахимов" in n["body"] for n in up)
    rep = (await client.get("/duty/report", params={"date_from": "2026-11-18", "date_to": "2026-11-18"},
                            headers=await login("director@school.uz"))).json()
    assert rep["totals"]["missed"] == 1 and rep["missed"][0]["teacher_name"].startswith("Рахимов")


async def test_replace_teacher_and_rights(client, login):
    day = dt.date(2026, 11, 19)
    aid = await _make_assignment("math@school.uz", day)
    await _make_assignment("history@school.uz", day, "3 этаж")
    up = await login("upbringing@school.uz")
    async with SessionLocal() as s:
        ids = {u.email: u.id for u in (await s.execute(select(User))).scalars()}
    assert (await client.patch(f"/duty/assignments/{aid}", json={"teacher_id": ids["history@school.uz"]}, headers=up)).status_code == 409
    r = await client.patch(f"/duty/assignments/{aid}", json={"teacher_id": ids["english@school.uz"]}, headers=up)
    assert r.status_code == 200 and r.json()["manual"] and r.json()["teacher_name"].startswith("Тураева")
    eng = [n["title"] for n in (await client.get("/notifications", headers=await login("english@school.uz"))).json()["items"]]
    assert "Вам назначено дежурство" in eng
    t = await login("teacher@school.uz")
    assert (await client.post("/duty/generate", json=WEEK, headers=t)).status_code == 403
    assert (await client.patch(f"/duty/assignments/{aid}", json={"teacher_id": ids["teacher@school.uz"]}, headers=t)).status_code == 403
    my = (await client.get("/duty/my", params={"days": 60}, headers=await login("english@school.uz"))).json()
    assert any(a["id"] == aid for a in my) or dt.date.today() > day + dt.timedelta(days=7)

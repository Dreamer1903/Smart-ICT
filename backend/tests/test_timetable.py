"""Расписание: помощник, жёсткие правила (кабинеты, совместитель), пожелания, ручная правка,
публикация с отчётом директору, предложения учителей, права."""

from collections import defaultdict


async def _subject_ids(client, h) -> dict[str, int]:
    return {s["name"]: s["id"] for s in (await client.get("/academic/subjects", headers=h)).json()}


async def _generate(client, h, **body) -> dict:
    r = await client.post("/timetable/versions/generate", json={"name": "Тест", "time_limit": 10, **body}, headers=h)
    assert r.status_code == 200, r.text
    return (await client.get(f"/timetable/versions/{r.json()['id']}", headers=h)).json()


async def test_generate_respects_rooms_and_teacher_wishes(client, login):
    h = await login("academic@school.uz")
    v = await _generate(client, h)
    rep, entries = v["report"], v["entries"]
    assert v["status"] == "DRAFT" and rep["ok"] and rep["conflicts"] == []
    assert rep["lessons_placed"] == rep["lessons_planned"] == 125
    assert rep["wishes_violated"] == [] and rep["class_gaps"] == []
    # Спецкабинеты: биология, информатика, физика — никогда параллельно
    for subj in ("Биология", "Информатика", "Физика"):
        cells = [(e["day"], e["slot"]) for e in entries if e["subject_name"] == subj]
        assert len(cells) == len(set(cells)), f"{subj} стоит параллельно"
    # Совместитель-биолог не во вторник и четверг; математику не ставят первым уроком
    assert not [e for e in entries if e["subject_name"] == "Биология" and e["day"] in (2, 4)]
    assert not [e for e in entries if e["subject_name"] == "Математика" and e["slot"] == 1]
    # У учителя и класса нет двух уроков одновременно
    for key in ("teacher_id", "class_id"):
        cnt = defaultdict(int)
        for e in entries:
            cnt[e[key], e["day"], e["slot"]] += 1
        assert max(cnt.values()) == 1


async def test_impossible_timetable_is_explained(client, login):
    bio = await login("biology@school.uz")
    # Биолог «не может» почти всю неделю: 10 ч нагрузки не помещаются
    cells = {f"{d}-{s}": "no" for d in range(1, 6) for s in range(1, 8) if not (d == 1 and s <= 3)}
    assert (await client.put("/timetable/preferences/me", json={"cells": cells}, headers=bio)).status_code == 200
    r = await client.post("/timetable/versions/generate", json={"time_limit": 5}, headers=await login("academic@school.uz"))
    assert r.status_code == 422
    assert any("Хамидова" in p and "свободных" in p for p in r.json()["detail"]["problems"])


async def test_manual_edit_lock_publish_and_views(client, login):
    h, director = await login("academic@school.uz"), await login("director@school.uz")
    v = await _generate(client, h)
    e1 = v["entries"][0]
    clash = next(e for e in v["entries"] if e["class_id"] == e1["class_id"] and (e["day"], e["slot"]) != (e1["day"], e1["slot"]))
    r = await client.patch(f"/timetable/entries/{e1['id']}", json={"day": clash["day"], "slot": clash["slot"]}, headers=h)
    assert r.status_code == 409 and "У класса" in r.json()["detail"]["errors"][0]
    r = await client.patch(f"/timetable/entries/{e1['id']}", json={"locked": True}, headers=h)
    assert r.json()["locked"] is True
    # Новый вариант с закреплённым уроком на прежнем месте
    v2 = await _generate(client, h, base_version_id=v["id"])
    kept = [e for e in v2["entries"] if e["class_id"] == e1["class_id"] and e["subject_id"] == e1["subject_id"]
            and (e["day"], e["slot"]) == (e1["day"], e1["slot"])]
    assert kept and kept[0]["locked"]

    assert (await client.post(f"/timetable/versions/{v2['id']}/publish", headers=await login("teacher@school.uz"))).status_code == 403
    r = await client.post(f"/timetable/versions/{v2['id']}/publish", headers=h)
    assert r.json()["status"] == "PUBLISHED"
    notes = (await client.get("/notifications", headers=director)).json()["items"]
    assert any(n["title"] == "Опубликовано расписание — отчёт" and "конфликтов 0" in n["body"] for n in notes)
    assert (await client.get(f"/timetable/versions/{v2['id']}", headers=director)).json()["report"]["ok"]

    # Своё расписание: учитель информатики, куратор, ученик, родитель
    teacher = (await client.get("/timetable/my", headers=await login("teacher@school.uz"))).json()["views"]
    assert teacher[0]["title"] == "Мои уроки" and all(e["subject_name"] == "Информатика" for e in teacher[0]["entries"])
    assert any("классный руководитель" in x["title"] for x in teacher)
    curator = (await client.get("/timetable/my", headers=await login("history@school.uz"))).json()["views"]
    assert any("куратор" in x["title"] for x in curator)
    st = (await client.get("/timetable/my", headers=await login("student@school.uz"))).json()["views"]
    assert len(st) == 1 and len(st[0]["entries"]) == 25 and st[0]["title"] == 'Мой класс 9"А"'
    par = (await client.get("/timetable/my", headers=await login("parent@school.uz"))).json()["views"]
    assert par[0]["title"].startswith("Алиев Тимур")


async def test_teacher_proposal_flow(client, login, timetable):
    t, h = await login("teacher@school.uz"), await login("academic@school.uz")
    mine = (await client.get("/timetable/my", headers=t)).json()["views"][0]["entries"]
    e = mine[0]
    busy = {(x["day"], x["slot"]) for x in mine}
    free = next((d, s) for d in range(1, 6) for s in range(1, 8) if (d, s) not in busy)
    p = await client.post("/timetable/proposals", json={"entry_id": e["id"], "to_day": free[0], "to_slot": free[1],
                                                        "comment": "Удобнее"}, headers=t)
    assert p.status_code == 201
    other = (await client.get("/timetable/my", headers=await login("math@school.uz"))).json()["views"][0]["entries"][0]
    assert (await client.post("/timetable/proposals", json={"entry_id": other["id"], "to_day": 1, "to_slot": 2},
                              headers=t)).status_code == 403  # чужой урок
    pending = (await client.get("/timetable/proposals", headers=h)).json()
    assert len(pending) == 1
    r = await client.post(f"/timetable/proposals/{p.json()['id']}/resolve", json={"accept": not pending[0]["errors"]}, headers=h)
    assert r.status_code == 200
    titles = [n["title"] for n in (await client.get("/notifications", headers=t)).json()["items"]]
    assert any(x.startswith("Предложение по расписанию") for x in titles)


async def test_access_rights(client, login):
    student = await login("student@school.uz")
    assert (await client.get("/academic/assignments", headers=student)).status_code == 403
    assert (await client.get("/students", headers=student)).status_code == 403  # каталог учеников — только сотрудникам
    assert (await client.get("/dashboard/live-pulse", headers=student)).status_code == 403
    assert (await client.post("/timetable/versions/generate", json={}, headers=await login("teacher@school.uz"))).status_code == 403
    r = await client.put("/timetable/preferences/me", json={"cells": {"9-1": "no"}}, headers=await login("teacher@school.uz"))
    assert r.status_code == 400

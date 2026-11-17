"""Библиотека материалов: загрузка, черновик/публикация, видимость для учителей и учеников, скачивание."""

import os
import tempfile

import pytest

from app.core.config import settings


@pytest.fixture(autouse=True)
def tmp_library(monkeypatch):
    monkeypatch.setattr(settings, "library_dir", tempfile.mkdtemp())


def _upload(client, h, title="Циклы в Python", kind="PRESENTATION", visibility="PRIVATE", name="циклы.pptx", data=b"PPTX-DATA"):
    return client.post("/library/materials", headers=h, data={"title": title, "kind": kind, "visibility": visibility,
                       "grade_level": "9", "description": "Презентация к уроку 12"},
                       files={"file": (name, data, "application/vnd.openxmlformats-officedocument.presentationml.presentation")})


async def test_upload_publish_visibility_download(client, login):
    t, other, student = await login("teacher@school.uz"), await login("math@school.uz"), await login("student@school.uz")
    r = await _upload(client, t)
    assert r.status_code == 201
    m = r.json()
    assert m["visibility"] == "PRIVATE" and m["kind_label"] == "Презентация" and m["size_bytes"] == 9

    # Черновик видит только автор
    assert (await client.get("/library/materials", headers=other)).json() == []
    assert (await client.get(f"/library/materials/{m['id']}/download", headers=other)).status_code == 404
    assert (await client.patch(f"/library/materials/{m['id']}", json={"visibility": "ALL"}, headers=other)).status_code == 404

    # Публикация для учителей: видит коллега, но не ученик
    pub = (await client.patch(f"/library/materials/{m['id']}", json={"visibility": "TEACHERS"}, headers=t)).json()
    assert pub["published_at"]
    assert [x["title"] for x in (await client.get("/library/materials", headers=other)).json()] == ["Циклы в Python"]
    assert (await client.get("/library/materials", headers=student)).json() == []
    assert (await client.patch(f"/library/materials/{m['id']}", json={"title": "x"}, headers=other)).status_code == 403

    # Для всех: ученик видит и скачивает
    await client.patch(f"/library/materials/{m['id']}", json={"visibility": "ALL"}, headers=t)
    d = await client.get(f"/library/materials/{m['id']}/download", headers=student)
    assert d.status_code == 200 and d.content == b"PPTX-DATA" and "attachment" in d.headers["content-disposition"]
    assert (await client.get("/library/materials", params={"q": "ЦИКЛЫ"}, headers=student)).json()[0]["downloads"] == 1

    # Ученик не может загружать; удаляет только автор
    assert (await _upload(client, student)).status_code == 403
    assert (await client.delete(f"/library/materials/{m['id']}", headers=other)).status_code == 403
    assert (await client.delete(f"/library/materials/{m['id']}", headers=t)).status_code == 204
    assert os.listdir(settings.library_dir) == []


async def test_upload_validation(client, login):
    t = await login("teacher@school.uz")
    assert (await _upload(client, t, name="virus.exe")).status_code == 400
    assert (await _upload(client, t, data=b"")).status_code == 400
    r = await _upload(client, t, title="Карточки: дроби", kind="CARDS", name="дроби.pdf", visibility="ALL")
    assert r.status_code == 201 and r.json()["published_at"]
    kinds = (await client.get("/library/materials", params={"kind": "CARDS"}, headers=await login("parent@school.uz"))).json()
    assert [k["title"] for k in kinds] == ["Карточки: дроби"]

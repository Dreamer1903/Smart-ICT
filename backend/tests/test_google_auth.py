"""Вход через Google: проверка подписи/аудитории/почты, только существующие пользователи, привязка аккаунта."""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core import google
from app.core.config import settings

CLIENT_ID = "test-client.apps.googleusercontent.com"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def google_env(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", CLIENT_ID)
    monkeypatch.setattr(settings, "google_allowed_domains", "")
    monkeypatch.setattr(google, "_signing_key", lambda token: KEY.public_key())  # вместо ключей Google


def token(email="director@school.uz", sub="g-1", key=KEY, **over) -> str:
    now = int(time.time())
    claims = {"iss": "https://accounts.google.com", "aud": CLIENT_ID, "sub": sub, "email": email,
              "email_verified": True, "iat": now, "exp": now + 600, **over}
    return jwt.encode(claims, key, algorithm="RS256")


async def test_config_exposes_client_id(client):
    assert (await client.get("/auth/config")).json()["google_client_id"] == CLIENT_ID


async def test_google_login_existing_user_and_binding(client):
    r = await client.post("/auth/google", json={"credential": token(email="Director@School.uz")})
    assert r.status_code == 200 and r.json()["user"]["role"] == "Director"
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
    assert me.json()["email"] == "director@school.uz"
    # Аккаунт привязан: другой Google-аккаунт с той же почтой не войдёт
    r = await client.post("/auth/google", json={"credential": token(sub="g-2")})
    assert r.status_code == 403 and "другому Google" in r.json()["detail"]


async def test_google_login_rejections(client, monkeypatch):
    r = await client.post("/auth/google", json={"credential": token(email="stranger@gmail.com")})
    assert r.status_code == 403 and "не найден" in r.json()["detail"]
    assert (await client.post("/auth/google", json={"credential": token(key=OTHER_KEY)})).status_code == 401  # чужая подпись
    assert (await client.post("/auth/google", json={"credential": token(aud="someone-else")})).status_code == 401
    assert (await client.post("/auth/google", json={"credential": token(exp=int(time.time()) - 10)})).status_code == 401
    r = await client.post("/auth/google", json={"credential": token(email_verified=False)})
    assert r.status_code == 401 and "не подтверждена" in r.json()["detail"]
    monkeypatch.setattr(settings, "google_allowed_domains", "oxford.uz")
    r = await client.post("/auth/google", json={"credential": token()})
    assert r.status_code == 401 and "oxford.uz" in r.json()["detail"]
    monkeypatch.setattr(settings, "google_client_id", "")
    assert (await client.post("/auth/google", json={"credential": token()})).status_code == 401

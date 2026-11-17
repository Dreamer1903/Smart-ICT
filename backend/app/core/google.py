"""Проверка Google ID token (Google Identity Services, кнопка «Войти через Google»).

Токен подписан ключами Google (RS256). Проверяем подпись, аудиторию (наш Client ID), издателя,
срок, подтверждённость почты и, если задано, домен школы.
"""

import asyncio
from typing import Any

import jwt
from jwt import PyJWKClient

from app.core.config import settings

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"]

_jwks: PyJWKClient | None = None


class GoogleAuthError(Exception):
    pass


def _signing_key(token: str) -> Any:
    """Публичный ключ Google для подписи токена (ключи кэшируются на час)."""
    global _jwks
    if _jwks is None:
        _jwks = PyJWKClient(GOOGLE_CERTS_URL, cache_keys=True, lifespan=3600)
    return _jwks.get_signing_key_from_jwt(token).key


def _allowed_domains() -> set[str]:
    return {d.strip().lower().lstrip("@") for d in settings.google_allowed_domains.split(",") if d.strip()}


def verify_sync(token: str) -> dict[str, Any]:
    if not settings.google_client_id:
        raise GoogleAuthError("Вход через Google не настроен")
    try:
        claims = jwt.decode(token, _signing_key(token), algorithms=["RS256"], audience=settings.google_client_id,
                            issuer=GOOGLE_ISSUERS, options={"require": ["exp", "iat", "sub", "email"]})
    except jwt.PyJWTError as e:
        raise GoogleAuthError(f"Недействительный Google-токен: {type(e).__name__}") from None
    except Exception as e:  # noqa: BLE001 — нет связи с Google и т.п.
        raise GoogleAuthError(f"Не удалось проверить вход через Google: {type(e).__name__}") from None
    if not claims.get("email_verified"):
        raise GoogleAuthError("Почта Google-аккаунта не подтверждена")
    domains = _allowed_domains()
    email = str(claims["email"]).lower()
    if domains and email.rsplit("@", 1)[-1] not in domains and str(claims.get("hd", "")).lower() not in domains:
        raise GoogleAuthError(f"Разрешён вход только с почтой: {', '.join(sorted(domains))}")
    return claims


async def verify(token: str) -> dict[str, Any]:
    return await asyncio.to_thread(verify_sync, token)  # загрузка ключей Google — блокирующий запрос

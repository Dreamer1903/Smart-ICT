"""Клиент OpenAPI HikCentral Professional (шлюз Artemis).

Подпись запроса (AK/SK):
    stringToSign = METHOD\\n Accept\\n Content-Type\\n
                   x-ca-key:{AK}\\n x-ca-nonce:{uuid}\\n x-ca-timestamp:{ms}\\n
                   {path}
    X-Ca-Signature = base64(HMAC-SHA256(SK, stringToSign))
Ответ: {"code": "0", "msg": "Success", "data": {...}}; code != "0" — ошибка.

Пути и формат тел вынесены в настройки: перед боевым запуском их нужно сверить с
документацией OpenAPI именно для HikCentral Professional 3.0 (раздел Access Control).
"""

import base64
import hashlib
import hmac
import time
import uuid
from collections.abc import AsyncIterator
from typing import Any

import httpx

ACCEPT = "application/json"
CONTENT_TYPE = "application/json;charset=UTF-8"
SIGNED_HEADERS = ("x-ca-key", "x-ca-nonce", "x-ca-timestamp")


class HikCentralError(Exception):
    pass


def string_to_sign(method: str, path: str, headers: dict[str, str]) -> str:
    lines = [method.upper(), ACCEPT, CONTENT_TYPE]
    lines += [f"{h}:{headers[h]}" for h in sorted(SIGNED_HEADERS)]
    return "\n".join(lines) + "\n" + path


def sign(secret: str, method: str, path: str, headers: dict[str, str]) -> str:
    digest = hmac.new(secret.encode(), string_to_sign(method, path, headers).encode(), hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


class HikCentralClient:
    def __init__(self, base_url: str, app_key: str, app_secret: str, *, verify_tls: bool = False,
                 timeout: float = 10.0, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._key = app_key
        self._secret = app_secret
        self._client = httpx.AsyncClient(base_url=base_url.rstrip("/"), verify=verify_tls,
                                         timeout=timeout, transport=transport)

    async def call(self, path: str, body: dict[str, Any]) -> Any:
        if not self._key or not self._secret:
            raise HikCentralError("Не заданы HIK_APP_KEY / HIK_APP_SECRET")
        signed = {"x-ca-key": self._key, "x-ca-nonce": str(uuid.uuid4()), "x-ca-timestamp": str(int(time.time() * 1000))}
        headers = {
            "Accept": ACCEPT,
            "Content-Type": CONTENT_TYPE,
            **{k.title(): v for k, v in signed.items()},
            "X-Ca-Signature-Headers": ",".join(SIGNED_HEADERS),
            "X-Ca-Signature": sign(self._secret, "POST", path, signed),
        }
        try:
            r = await self._client.post(path, json=body, headers=headers)
        except httpx.HTTPError as e:
            raise HikCentralError(f"HikCentral недоступна: {type(e).__name__}") from e
        if r.status_code != 200:
            raise HikCentralError(f"HikCentral вернула HTTP {r.status_code}")
        try:
            payload = r.json()
        except ValueError as e:
            raise HikCentralError("Некорректный ответ HikCentral") from e
        if str(payload.get("code")) != "0":
            raise HikCentralError(f"HikCentral: код {payload.get('code')} — {payload.get('msg')}")
        return payload.get("data")

    async def paged(self, path: str, body: dict[str, Any], page_size: int = 200) -> AsyncIterator[dict[str, Any]]:
        """Перебор всех страниц списка ({pageNo, pageSize} → data.list / data.total)."""
        page = 1
        while True:
            data = await self.call(path, {**body, "pageNo": page, "pageSize": page_size}) or {}
            items = data.get("list") or []
            for item in items:
                yield item
            total = int(data.get("total") or 0)
            if not items or page * page_size >= total:
                return
            page += 1

    async def aclose(self) -> None:
        await self._client.aclose()

"""Service Payment → 1С.

Контракт HTTP-сервиса 1С (публикуется в 1С как HTTP-сервис, напр. /hs/schoolos/v1):

    GET {ONEC_BASE_URL}/students/{account}/balance        (Basic Auth)
    200 {"account": "LS-0001", "debt": 150000.0, "currency": "UZS", "paid_until": "2026-12-01"}
    404 — лицевой счёт не найден

Решение «есть долг / нет долга» принимает SchoolOS (порог PAYMENT_DEBT_THRESHOLD),
а не 1С — так политику можно менять без доработки конфигурации 1С.
"""

from datetime import date
from typing import Protocol

import httpx
from pydantic import BaseModel, ValidationError


class BalanceInfo(BaseModel):
    account: str
    debt: float
    currency: str = "UZS"
    paid_until: date | None = None


class PaymentProviderError(Exception):
    pass


class PaymentProvider(Protocol):
    async def fetch_balance(self, account: str) -> BalanceInfo: ...


class OneCHttpProvider:
    def __init__(
        self,
        base_url: str,
        username: str = "",
        password: str = "",
        timeout: float = 1.5,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        auth = httpx.BasicAuth(username, password) if username else None
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"), auth=auth, timeout=timeout, transport=transport
        )

    async def fetch_balance(self, account: str) -> BalanceInfo:
        try:
            r = await self._client.get(f"/students/{account}/balance")
        except httpx.HTTPError as e:
            raise PaymentProviderError(f"1С недоступна: {type(e).__name__}") from e
        if r.status_code == 404:
            raise PaymentProviderError(f"Лицевой счёт {account} не найден в 1С")
        if r.status_code != 200:
            raise PaymentProviderError(f"1С вернула HTTP {r.status_code}")
        try:
            return BalanceInfo.model_validate(r.json())
        except (ValidationError, ValueError) as e:
            raise PaymentProviderError("Некорректный ответ 1С") from e

    async def aclose(self) -> None:
        await self._client.aclose()

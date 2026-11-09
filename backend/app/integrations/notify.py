"""Service Notification: каналы доставки уведомлений родителям и администрации."""

import logging

import httpx

logger = logging.getLogger("schoolos.notify")


class NotifyError(Exception):
    pass


class TelegramNotifier:
    def __init__(self, token: str, api_base: str = "https://api.telegram.org", timeout: float = 5.0,
                 transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._token = token
        self._client = httpx.AsyncClient(base_url=api_base.rstrip("/"), timeout=timeout, transport=transport)

    async def send(self, chat_id: str, text: str) -> None:
        if not self._token:
            raise NotifyError("TELEGRAM_BOT_TOKEN не задан")
        try:
            r = await self._client.post(f"/bot{self._token}/sendMessage", json={"chat_id": chat_id, "text": text})
        except httpx.HTTPError as e:
            raise NotifyError(f"Telegram недоступен: {type(e).__name__}") from e
        if r.status_code != 200:
            raise NotifyError(f"Telegram вернул HTTP {r.status_code}")


class SmsNotifier:
    """Универсальный HTTP SMS-шлюз: POST {url} {"phone": ..., "text": ...}, Bearer-токен.
    Для конкретного провайдера (Eskiz, PlayMobile и т.п.) достаточно заменить этот класс."""

    def __init__(self, url: str, token: str = "", timeout: float = 5.0,
                 transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._url = url
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        self._client = httpx.AsyncClient(headers=headers, timeout=timeout, transport=transport)

    async def send(self, phone: str, text: str) -> None:
        if not self._url:
            raise NotifyError("SMS_GATEWAY_URL не задан")
        try:
            r = await self._client.post(self._url, json={"phone": phone, "text": text})
        except httpx.HTTPError as e:
            raise NotifyError(f"SMS-шлюз недоступен: {type(e).__name__}") from e
        if r.status_code not in (200, 201, 202):
            raise NotifyError(f"SMS-шлюз вернул HTTP {r.status_code}")


class LogNotifier:
    """Канал для разработки: пишет уведомление в лог."""

    sent: list[tuple[str, str]] = []

    async def send(self, recipient: str, text: str) -> None:
        LogNotifier.sent.append((recipient, text))
        logger.info("NOTIFY → %s: %s", recipient, text)

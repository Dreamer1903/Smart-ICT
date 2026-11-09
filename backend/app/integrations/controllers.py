"""Service Access Control: доставка команд OPEN/DENY контроллерам доступа.

SchoolOS не управляет турникетом напрямую — только контроллером:
    Турникет → Контроллер → SchoolOS → (1С) → решение → Контроллер → Турникет

Поддерживаемые способы доставки решения (AccessDevice.adapter):
  * RESPONSE  — решение в ответе на HTTP-запрос контроллера (минимальная задержка);
  * HTTP      — POST команды на command_url контроллера;
  * WEBSOCKET — постоянное WS-соединение контроллера с SchoolOS;
  * TCP       — постоянное TCP-соединение (JSON lines).
SDK производителя, OSDP, Wiegand и чтение БД контроллера подключаются отдельным
шлюзом-адаптером, который транслирует события в REST/WS/TCP-протокол SchoolOS.
"""

import logging
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from app.models import AccessDevice, DeviceAdapter

logger = logging.getLogger("schoolos.controllers")

Sender = Callable[[dict[str, Any]], Awaitable[None]]


class ConnectionHub:
    """Реестр постоянных соединений контроллеров (WebSocket/TCP): device_code → send()."""

    def __init__(self) -> None:
        self._senders: dict[str, Sender] = {}

    def register(self, device_code: str, sender: Sender) -> None:
        self._senders[device_code] = sender

    def unregister(self, device_code: str, sender: Sender | None = None) -> None:
        if sender is None or self._senders.get(device_code) is sender:
            self._senders.pop(device_code, None)

    def is_connected(self, device_code: str) -> bool:
        return device_code in self._senders

    async def send(self, device_code: str, message: dict[str, Any]) -> bool:
        sender = self._senders.get(device_code)
        if sender is None:
            return False
        await sender(message)
        return True


hub = ConnectionHub()


class ControllerCommander:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None, timeout: float = 2.0) -> None:
        self._client = httpx.AsyncClient(timeout=timeout, transport=transport)

    async def send(self, device: AccessDevice, command: dict[str, Any]) -> str:
        """Отправить команду. Возвращает статус доставки для журнала."""
        match device.adapter:
            case DeviceAdapter.RESPONSE:
                return "in_response"
            case DeviceAdapter.HTTP:
                if not device.command_url:
                    return "no_command_url"
                try:
                    r = await self._client.post(device.command_url, json=command)
                    return "sent" if r.status_code < 300 else f"http_{r.status_code}"
                except httpx.HTTPError as e:
                    logger.warning("Контроллер %s недоступен: %s", device.code, e)
                    return "failed"
            case DeviceAdapter.WEBSOCKET | DeviceAdapter.TCP:
                try:
                    return "sent" if await hub.send(device.code, command) else "not_connected"
                except Exception as e:  # noqa: BLE001 — соединение могло оборваться
                    logger.warning("Ошибка отправки на %s: %s", device.code, e)
                    hub.unregister(device.code)
                    return "failed"

    async def aclose(self) -> None:
        await self._client.aclose()

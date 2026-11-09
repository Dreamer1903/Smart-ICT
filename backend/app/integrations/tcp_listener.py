"""TCP/IP-приёмник событий контроллеров (JSON lines, UTF-8).

Протокол:
  → {"type":"hello","device_code":"gate-2","key":"<GATE_API_KEY>"}
  ← {"type":"hello_ok"}
  → {"direction":"IN","credential_kind":"RFID","credential_value":"RFID-0001"}
  ← {"type":"command","command":"OPEN",...}
Команды по инициативе SchoolOS (напр. открытие после оплаты) приходят в то же соединение.
"""

import asyncio
import json
import logging

from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import settings
from app.integrations.controllers import hub

logger = logging.getLogger("schoolos.tcp")


async def _handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    from app.api.v1.access import process_controller_event
    from app.schemas.access import AccessEventIn

    lock = asyncio.Lock()

    async def send(msg: dict) -> None:  # type: ignore[type-arg]
        async with lock:
            writer.write((json.dumps(msg, ensure_ascii=False, default=str) + "\n").encode())
            await writer.drain()

    device_code: str | None = None
    try:
        hello = json.loads((await asyncio.wait_for(reader.readline(), timeout=10)) or b"{}")
        if hello.get("type") != "hello" or hello.get("key") != settings.gate_api_key or not hello.get("device_code"):
            await send({"type": "error", "detail": "unauthorized"})
            return
        device_code = str(hello["device_code"])
        hub.register(device_code, send)
        await send({"type": "hello_ok"})
        while line := await reader.readline():
            try:
                body = AccessEventIn.model_validate({**json.loads(line), "device_code": device_code})
                result, _ = await process_controller_event(body)
                if result.device.adapter.value != "TCP":
                    await send(result.command)
            except (ValidationError, ValueError) as e:
                await send({"type": "error", "detail": str(e)[:500]})
            except HTTPException as e:
                await send({"type": "error", "detail": e.detail})
    except (TimeoutError, ConnectionError, json.JSONDecodeError) as e:
        logger.info("TCP-соединение закрыто: %s", e)
    finally:
        if device_code:
            hub.unregister(device_code, send)
        writer.close()


async def start_tcp_listener() -> asyncio.base_events.Server:
    server = await asyncio.start_server(_handle, settings.tcp_listener_host, settings.tcp_listener_port)
    logger.info("TCP-приёмник контроллеров слушает %s:%s", settings.tcp_listener_host, settings.tcp_listener_port)
    return server

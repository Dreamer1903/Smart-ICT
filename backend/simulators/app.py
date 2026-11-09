"""Симулятор внешних систем для локальной разработки и демо:

    uvicorn simulators.app:app --port 8010

  /1c/...         — HTTP-сервис 1С (баланс по лицевому счёту) + «касса» для внесения оплаты
  /robi/...       — приём посещаемости Robi
  /controller/... — приём команд OPEN/DENY (для устройств с adapter=HTTP)
  /sms/send       — SMS-шлюз, /telegram/bot{token}/sendMessage — Telegram Bot API
"""

import os
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, FastAPI, HTTPException
from pydantic import BaseModel

from simulators.ledger import SEED_DEBTS, account_for

SCHOOLOS_WEBHOOK_URL = os.getenv("SCHOOLOS_WEBHOOK_URL", "http://localhost:8000/api/v1/integrations/1c/payment-webhook")
ONEC_WEBHOOK_SECRET = os.getenv("ONEC_WEBHOOK_SECRET", "dev-1c-secret")


class Ledger:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.debts: dict[str, float] = {account_for(i): 0.0 for i in range(1, 21)}
        for i, debt in SEED_DEBTS.items():
            self.debts[account_for(i)] = debt
        self.down = False  # имитация недоступности 1С

    def balance(self, account: str) -> dict[str, Any]:
        debt = self.debts[account]
        paid_until = None if debt > 0 else (date.today().replace(day=1) + timedelta(days=40)).replace(day=1)
        return {"account": account, "debt": debt, "currency": "UZS", "paid_until": paid_until}


ledger = Ledger()
robi_events: list[dict[str, Any]] = []
controller_commands: list[dict[str, Any]] = []
messages: list[dict[str, Any]] = []

onec = APIRouter(prefix="/1c", tags=["1С"])


@onec.get("/students/{account}/balance")
async def balance(account: str) -> dict[str, Any]:
    if ledger.down:
        raise HTTPException(503, "1С на обслуживании")
    if account not in ledger.debts:
        raise HTTPException(404, "Лицевой счёт не найден")
    return ledger.balance(account)


class PayIn(BaseModel):
    account: str
    amount: float | None = None  # None — погасить весь долг
    notify_schoolos: bool = True


@onec.post("/admin/pay")
async def pay(body: PayIn) -> dict[str, Any]:
    """«Касса»: внести оплату и (как настоящая 1С) отправить вебхук в SchoolOS."""
    if body.account not in ledger.debts:
        raise HTTPException(404, "Лицевой счёт не найден")
    amount = ledger.debts[body.account] if body.amount is None else body.amount
    ledger.debts[body.account] = max(0.0, ledger.debts[body.account] - amount)
    result: dict[str, Any] = {**ledger.balance(body.account), "paid": amount}
    if body.notify_schoolos:
        payload = {**ledger.balance(body.account)}
        payload["paid_until"] = payload["paid_until"].isoformat() if payload["paid_until"] else None
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.post(SCHOOLOS_WEBHOOK_URL, json=payload, headers={"X-1C-Secret": ONEC_WEBHOOK_SECRET})
            result["webhook_status"] = r.status_code
            result["webhook_response"] = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
        except httpx.HTTPError as e:
            result["webhook_status"] = f"error: {type(e).__name__}"
    return result


@onec.post("/admin/charge")
async def charge(body: PayIn) -> dict[str, Any]:
    ledger.debts[body.account] = ledger.debts.get(body.account, 0.0) + (body.amount or 0.0)
    return ledger.balance(body.account)


@onec.get("/admin/ledger")
async def get_ledger() -> dict[str, Any]:
    return {"down": ledger.down, "accounts": [ledger.balance(a) for a in sorted(ledger.debts)]}


@onec.post("/admin/availability")
async def availability(up: bool) -> dict[str, bool]:
    ledger.down = not up
    return {"down": ledger.down}


@onec.post("/admin/reset")
async def reset() -> dict[str, str]:
    ledger.reset()
    robi_events.clear()
    controller_commands.clear()
    messages.clear()
    return {"status": "ok"}


robi = APIRouter(prefix="/robi", tags=["Robi"])


@robi.post("/attendance/events", status_code=201)
async def robi_event(payload: dict[str, Any]) -> dict[str, str]:
    if any(e["event_id"] == payload.get("event_id") for e in robi_events):
        raise HTTPException(409, "duplicate")
    robi_events.append({**payload, "received_at": datetime.now(UTC).isoformat()})
    return {"status": "accepted"}


@robi.get("/attendance/events")
async def robi_list() -> list[dict[str, Any]]:
    return robi_events


controller = APIRouter(prefix="/controller", tags=["Контроллер"])


@controller.post("/{device}/commands")
async def controller_command(device: str, payload: dict[str, Any]) -> dict[str, str]:
    controller_commands.append({"device": device, **payload})
    return {"status": "executed"}


@controller.get("/commands")
async def controller_list() -> list[dict[str, Any]]:
    return controller_commands


notify = APIRouter(tags=["Уведомления"])


@notify.post("/sms/send")
async def sms(payload: dict[str, Any]) -> dict[str, str]:
    messages.append({"channel": "sms", **payload})
    return {"status": "queued"}


@notify.post("/telegram/bot{token}/sendMessage")
async def telegram(token: str, payload: dict[str, Any]) -> dict[str, Any]:
    messages.append({"channel": "telegram", **payload})
    return {"ok": True}


@notify.get("/messages")
async def list_messages() -> list[dict[str, Any]]:
    return messages


app = FastAPI(title="SchoolOS — симулятор внешних систем")
for r in (onec, robi, controller, notify):
    app.include_router(r)

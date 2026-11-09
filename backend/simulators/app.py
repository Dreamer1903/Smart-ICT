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
    hik_state.reset()
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


# ---------------------------------------------------------------- HikCentral Professional (эмулятор OpenAPI)
import base64  # noqa: E402
import hashlib  # noqa: E402
import hmac  # noqa: E402

from fastapi import Request  # noqa: E402

from simulators.ledger import STUDENTS_9A, STUDENTS_9B  # noqa: E402

HIK_AK = os.getenv("SIM_HIK_AK", "test-ak")
HIK_SK = os.getenv("SIM_HIK_SK", "test-sk")
HIK_GRANTED, HIK_DENIED = 196893, 197151  # коды эмулятора; в реальной системе — см. HIK_*_EVENT_TYPES
FULL_GROUP, EXIT_GROUP = "1", "2"


class HikState:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        names = STUDENTS_9A + STUDENTS_9B
        self.persons = [
            {"personId": str(1000 + i), "personCode": account_for(i), "personName": n} for i, n in enumerate(names, 1)
        ] + [{"personId": "9001", "personCode": "EMP-1", "personName": "Охранник Иванов"}]
        # сейчас школа пускает всех: все в уровне «Вход и выход»
        self.groups: dict[str, set[str]] = {FULL_GROUP: {p["personId"] for p in self.persons}, EXIT_GROUP: set()}
        self.doors = [{"doorIndexCode": str(i), "doorName": n} for i, n in enumerate(
            ["Турникет 1 — вход", "Турникет 1 — выход", "Турникет 2 — вход", "Турникет 2 — выход"], 1)]
        self.events: list[dict[str, Any]] = []
        self.calls: list[str] = []


hik_state = HikState()
hik = APIRouter(prefix="/hik", tags=["HikCentral"])


def _hik_check(request: Request) -> None:
    h = request.headers
    signed = (h.get("x-ca-signature-headers") or "").split(",")
    lines = ["POST", h.get("accept", ""), h.get("content-type", "")]
    lines += [f"{name}:{h.get(name, '')}" for name in sorted(signed)]
    to_sign = "\n".join(lines) + "\n" + request.url.path.removeprefix("/hik")
    expected = base64.b64encode(hmac.new(HIK_SK.encode(), to_sign.encode(), hashlib.sha256).digest()).decode()
    if h.get("x-ca-key") != HIK_AK or h.get("x-ca-signature") != expected:
        raise HTTPException(401, "signature mismatch")
    hik_state.calls.append(request.url.path)


def _page(items: list[dict[str, Any]], body: dict[str, Any]) -> dict[str, Any]:
    no, size = int(body.get("pageNo", 1)), int(body.get("pageSize", 20))
    return {"code": "0", "msg": "Success", "data": {"total": len(items), "pageNo": no, "pageSize": size,
                                                   "list": items[(no - 1) * size: no * size]}}


@hik.post("/artemis/api/resource/v1/person/personList")
async def hik_persons(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _hik_check(request)
    return _page(hik_state.persons, body)


@hik.post("/artemis/api/resource/v1/acsDoor/acsDoorList")
async def hik_doors(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _hik_check(request)
    return _page(hik_state.doors, body)


@hik.post("/artemis/api/acs/v1/privilege/group/single/{op}")
async def hik_group_op(op: str, request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _hik_check(request)
    group = hik_state.groups.setdefault(str(body["privilegeGroupId"]), set())
    for item in body.get("list", []):
        (group.add if op == "addPersons" else group.discard)(str(item["id"]))
    return {"code": "0", "msg": "Success", "data": None}


@hik.post("/artemis/api/acs/v1/door/events")
async def hik_events(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _hik_check(request)
    start, end = datetime.fromisoformat(body["startTime"]), datetime.fromisoformat(body["endTime"])
    items = [e for e in hik_state.events if start <= datetime.fromisoformat(e["eventTime"]) <= end]
    return _page(items, body)


class HikPassIn(BaseModel):
    person_id: str | None = None  # None — незнакомое лицо
    door: str = "1"
    direction: str = "IN"


@hik.post("/admin/pass")
async def hik_pass(body: HikPassIn) -> dict[str, Any]:
    """Человек подошёл к терминалу: терминал решает по уровням доступа, как настоящий."""
    in_full = body.person_id in hik_state.groups[FULL_GROUP]
    in_exit = body.person_id in hik_state.groups.get(EXIT_GROUP, set())
    granted = body.person_id is not None and (in_full or (body.direction == "OUT" and in_exit))
    event = {
        "eventId": f"E{len(hik_state.events) + 1:06d}",
        "eventType": HIK_GRANTED if granted else HIK_DENIED,
        "eventTime": datetime.now(UTC).isoformat(timespec="seconds"),
        "personId": body.person_id or "",
        "doorIndexCode": body.door,
        "inAndOutType": 1 if body.direction == "IN" else 0,
    }
    hik_state.events.append(event)
    return {"granted": granted, "event": event}


@hik.get("/admin/state")
async def hik_admin_state() -> dict[str, Any]:
    return {"groups": {k: sorted(v) for k, v in hik_state.groups.items()}, "events": len(hik_state.events)}


app.include_router(hik)

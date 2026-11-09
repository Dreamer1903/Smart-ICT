"""Service Attendance → Robi: передача фактов прохода для учёта посещаемости.

    POST {ROBI_BASE_URL}/attendance/events   (Authorization: Bearer <ROBI_API_TOKEN>)
    {"event_id": "schoolos-123", "robi_student_id": "R-0001", "student_external_id": "LS-0001",
     "direction": "IN", "timestamp": "...", "device": "main-entrance-1"}

event_id — ключ идемпотентности: повторная доставка из outbox не создаёт дублей.
"""

from typing import Any

import httpx


class RobiError(Exception):
    pass


class RobiClient:
    def __init__(self, base_url: str, token: str = "", timeout: float = 5.0,
                 transport: httpx.AsyncBaseTransport | None = None) -> None:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        self._client = httpx.AsyncClient(base_url=base_url.rstrip("/"), headers=headers,
                                         timeout=timeout, transport=transport)

    async def push_attendance(self, payload: dict[str, Any]) -> None:
        try:
            r = await self._client.post("/attendance/events", json=payload)
        except httpx.HTTPError as e:
            raise RobiError(f"Robi недоступна: {type(e).__name__}") from e
        if r.status_code not in (200, 201, 202, 409):  # 409 — уже получено (идемпотентность)
            raise RobiError(f"Robi вернула HTTP {r.status_code}")

    async def aclose(self) -> None:
        await self._client.aclose()

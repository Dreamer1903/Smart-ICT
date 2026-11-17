"""Состояние внешних интеграций (in-memory): последний успех/ошибка по каждой системе."""

from dataclasses import dataclass, field
from datetime import datetime

from app.db.base import utcnow


@dataclass
class IntegrationState:
    name: str
    last_ok_at: datetime | None = None
    last_error_at: datetime | None = None
    last_error: str | None = None
    calls: int = 0
    errors: int = 0

    @property
    def healthy(self) -> bool | None:
        if self.last_ok_at is None and self.last_error_at is None:
            return None  # ещё не было обращений
        if self.last_error_at is None:
            return True
        return self.last_ok_at is not None and self.last_ok_at > self.last_error_at


@dataclass
class HealthRegistry:
    states: dict[str, IntegrationState] = field(default_factory=dict)

    def _get(self, name: str) -> IntegrationState:
        return self.states.setdefault(name, IntegrationState(name))

    def ok(self, name: str) -> None:
        s = self._get(name)
        s.calls += 1
        s.last_ok_at = utcnow()

    def error(self, name: str, message: str) -> None:
        s = self._get(name)
        s.calls += 1
        s.errors += 1
        s.last_error_at = utcnow()
        s.last_error = message[:255]

    def snapshot(self) -> list[IntegrationState]:
        for name in ("1c", "hikcentral", "telegram", "sms"):
            self._get(name)
        return sorted(self.states.values(), key=lambda s: s.name)


health = HealthRegistry()

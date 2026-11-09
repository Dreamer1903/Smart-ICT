"""Конфигурация приложения (читается из переменных окружения / backend/.env)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]  # .../backend


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "School OS"
    environment: str = "dev"
    api_v1_prefix: str = "/api/v1"

    # SQLite для dev, PostgreSQL (postgresql+asyncpg://...) для prod
    database_url: str = f"sqlite+aiosqlite:///{BASE_DIR / 'school_os.db'}"
    sql_echo: bool = False

    jwt_secret_key: str = "dev-only-insecure-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    gate_api_key: str = "dev-gate-key"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    scheduler_enabled: bool = True
    discrepancy_check_interval_seconds: int = 60
    discrepancy_grace_minutes: int = 10
    school_timezone: str = "Asia/Tashkent"
    daily_reset_hour: int = 4

    # ---------------- Контроль доступа
    access_always_allow_exit: bool = True  # выход НИКОГДА не блокируется (пожарная безопасность)
    reopen_after_payment_window_minutes: int = 5  # открыть турникет, если оплата пришла сразу после отказа

    # ---------------- 1С (Service Payment)
    onec_base_url: str = "http://localhost:8010/1c"  # HTTP-сервис 1С, напр. https://1c.school.uz/base/hs/schoolos/v1
    onec_username: str = ""
    onec_password: str = ""
    onec_timeout_seconds: float = 1.5  # 1С на критическом пути турникета — таймаут короткий
    onec_webhook_secret: str = "dev-1c-secret"  # заголовок X-1C-Secret во входящем вебхуке об оплате
    payment_cache_ttl_seconds: int = 300
    payment_debt_threshold: float = 0.0  # долг больше порога → отказ
    payment_unavailable_policy: str = "cache"  # cache | allow | deny — что делать, если 1С не отвечает
    payment_recheck_interval_seconds: int = 300  # опрос 1С по должникам (страховка к вебхуку)

    # ---------------- Robi (Service Attendance)
    robi_enabled: bool = True
    robi_base_url: str = "http://localhost:8010/robi"
    robi_api_token: str = ""

    # ---------------- Уведомления (Service Notification)
    notify_channels: str = "log"  # log,telegram,sms
    notify_telegram_events: str = "entry,exit,deny,payment"
    notify_sms_events: str = "deny,payment"  # SMS платные — по умолчанию только важное
    telegram_bot_token: str = ""
    telegram_api_base: str = "https://api.telegram.org"
    telegram_admin_chat_id: str = ""
    sms_gateway_url: str = ""
    sms_gateway_token: str = ""

    # ---------------- Outbox и протоколы контроллеров
    outbox_poll_seconds: float = 5.0
    outbox_max_attempts: int = 10
    tcp_listener_enabled: bool = False
    tcp_listener_host: str = "0.0.0.0"
    tcp_listener_port: int = 9100

    @staticmethod
    def _csv(value: str) -> set[str]:
        return {v.strip().lower() for v in value.split(",") if v.strip()}

    @property
    def notify_channel_set(self) -> set[str]:
        return self._csv(self.notify_channels)

    @property
    def telegram_event_set(self) -> set[str]:
        return self._csv(self.notify_telegram_events)

    @property
    def sms_event_set(self) -> set[str]:
        return self._csv(self.notify_sms_events)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

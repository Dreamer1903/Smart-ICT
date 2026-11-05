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

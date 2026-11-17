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
    bcrypt_rounds: int = 12  # в тестах снижается для скорости

    gate_api_key: str = "dev-gate-key"

    # Вход через Google (Google Identity Services). Пусто — кнопка «Войти через Google» скрыта.
    google_client_id: str = ""  # OAuth Client ID типа «Веб-приложение» из Google Cloud Console
    google_allowed_domains: str = ""  # напр. «oxford.uz» — пускать только почту школы; пусто — любой Google-аккаунт

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    scheduler_enabled: bool = True
    discrepancy_check_interval_seconds: int = 60
    discrepancy_grace_minutes: int = 10
    school_timezone: str = "Asia/Tashkent"
    daily_reset_hour: int = 4
    school_start_time: str = "08:30"
    school_days: str = "1,2,3,4,5"  # учебные дни недели (1 = пн … 6 = сб)
    timetable_time_limit_seconds: float = 60.0  # 25 классов ≈ 60 с
    library_dir: str = str(BASE_DIR / "storage" / "library")
    library_max_mb: int = 50
    grade_max: int = 5  # шкала оценок 1…grade_max

    # ---------------- Дежурства
    duty_notify_hour: int = 7  # во сколько (местное время) присылать «сегодня у вас дежурство»
    duty_checkin_early_minutes: int = 20  # отметиться по QR можно за N минут до начала смены
    duty_grace_minutes: int = 5  # отметка позже начала + N минут — «опоздал»
    duty_remind_after_minutes: int = 10  # через N минут без отметки — уведомление завучу
    duty_require_lesson_day: bool = True  # дежурит только в дни, когда у учителя есть уроки (он в школе)  # пришёл позже — «опоздал» в отчёте посещаемости

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


    # ---------------- Уведомления (Service Notification)
    notify_channels: str = "log"  # log,telegram,sms
    notify_telegram_events: str = "entry,exit,deny,payment,absence,late,homework"
    notify_sms_events: str = "deny,payment,absence"  # SMS платные — по умолчанию только важное
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

    # ---------------- HikCentral Professional (OpenAPI / Artemis)
    hik_enabled: bool = False
    hik_base_url: str = "https://127.0.0.1"  # адрес OpenAPI-шлюза HikCentral
    hik_app_key: str = ""  # AK партнёра OpenAPI
    hik_app_secret: str = ""  # SK — секрет, хранить только в .env / секретах окружения
    hik_verify_tls: bool = False  # у HikCentral обычно самоподписанный сертификат
    hik_timeout_seconds: float = 10.0
    hik_enforce: bool = False  # False — режим наблюдения: SchoolOS НЕ меняет права в HikCentral
    hik_full_access_group_id: str = ""  # уровень доступа «Вход и выход»
    hik_exit_only_group_id: str = ""  # уровень доступа «Только выход» (рекомендуется)
    hik_match_by: str = "personCode"  # personCode — код = лицевой счёт 1С; name — по ФИО
    hik_event_mode: str = "poll"  # poll | webhook | both
    hik_poll_seconds: int = 10
    hik_webhook_token: str = "dev-hik-token"
    hik_granted_event_types: str = ""  # коды событий «проход разрешён»; пусто — по наличию personId
    hik_denied_event_types: str = ""  # коды событий «отказ»
    # Пути OpenAPI — сверить с документацией OpenAPI для HikCentral Professional 3.0
    hik_path_person_list: str = "/artemis/api/resource/v1/person/personList"
    hik_path_door_list: str = "/artemis/api/resource/v1/acsDoor/acsDoorList"
    hik_path_group_list: str = "/artemis/api/acs/v1/privilege/group"
    hik_path_group_add: str = "/artemis/api/acs/v1/privilege/group/single/addPersons"
    hik_path_group_delete: str = "/artemis/api/acs/v1/privilege/group/single/deletePersons"
    hik_path_door_events: str = "/artemis/api/acs/v1/door/events"

    @staticmethod
    def _int_csv(value: str) -> set[int]:
        return {int(v) for v in value.split(",") if v.strip().isdigit()}

    @property
    def hik_granted_types(self) -> set[int]:
        return self._int_csv(self.hik_granted_event_types)

    @property
    def hik_denied_types(self) -> set[int]:
        return self._int_csv(self.hik_denied_event_types)

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
    def school_day_list(self) -> list[int]:
        return sorted({int(d) for d in self.school_days.split(",") if d.strip().isdigit()})

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

"""Единая точка получения клиентов интеграций. Тесты подменяют их через set_*()."""

from app.core.config import settings
from app.integrations.controllers import ControllerCommander
from app.integrations.hikcentral import HikCentralClient
from app.integrations.notify import LogNotifier, SmsNotifier, TelegramNotifier
from app.integrations.onec import OneCHttpProvider, PaymentProvider
from app.integrations.robi import RobiClient


class Integrations:
    def __init__(self) -> None:
        self.payment: PaymentProvider = OneCHttpProvider(
            settings.onec_base_url, settings.onec_username, settings.onec_password, settings.onec_timeout_seconds
        )
        self.robi = RobiClient(settings.robi_base_url, settings.robi_api_token)
        self.telegram = TelegramNotifier(settings.telegram_bot_token, settings.telegram_api_base)
        self.sms = SmsNotifier(settings.sms_gateway_url, settings.sms_gateway_token)
        self.log = LogNotifier()
        self.commander = ControllerCommander()
        self.hik = HikCentralClient(
            settings.hik_base_url, settings.hik_app_key, settings.hik_app_secret,
            verify_tls=settings.hik_verify_tls, timeout=settings.hik_timeout_seconds,
        )


integrations = Integrations()

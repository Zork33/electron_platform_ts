import hashlib
from functools import lru_cache

from toolkit.abc.adapter import Adapter
from toolkit.adapter.abc.telegram_bot.adapter import TelegramBot as TelegramBotAdapter
from toolkit.adapter.abc.telegram_bot.config import ConnectionConfig

from .application_manager import ApplicationManager
from .handler_manager import HandlerManager
from .sender import Sender


class TelegramBotPtb(Adapter, TelegramBotAdapter):
    _code = "telegram_bot_ptb"
    _title = "Telegram bot by PTB"

    Sender = Sender
    HandlerManager = HandlerManager
    ApplicationManager = ApplicationManager

    def __init__(self, config: ConnectionConfig):
        self._config = config

        self._application_manager = self.ApplicationManager(token=config.token)
        self._application_manager.build_application()

        self._handler_manager = self.HandlerManager(
            application=self._application_manager.application
        )

        self._sender = self.Sender(
            application_manager=self._application_manager
        )

    @property
    def username(self) -> str | None:
        return self._config.username

    @property
    def token(self) -> str:
        return self._config.token

    async def start(self) -> None:
        await self._application_manager.start()

    async def stop(self) -> None:
        await self._application_manager.stop()

    @property
    def sender(self) -> Sender:
        return self._sender

    @property
    def handler_manager(self) -> HandlerManager:
        return self._handler_manager

    @property
    def application_manager(self) -> ApplicationManager:
        return self._application_manager

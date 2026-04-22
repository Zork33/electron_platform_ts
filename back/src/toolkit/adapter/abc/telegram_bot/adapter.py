from abc import abstractmethod

from toolkit.abc.abstract_adapter import AbstractAdapter

from .application_manager import ApplicationManager
from .config import ConnectionConfig
from .handler_manager import HandlerManager
from .sender import Sender


class TelegramBot(AbstractAdapter):
    _code = "telegram_bot"
    _title = "Telegram bot"

    Sender = Sender
    HandlerManager = HandlerManager
    ApplicationManager = ApplicationManager

    @abstractmethod
    def __init__(self, config: ConnectionConfig):
        pass

    @property
    @abstractmethod
    def username(self) -> str | None:
        pass

    @property
    @abstractmethod
    def token(self) -> str:
        pass

    @property
    @abstractmethod
    def sender(self) -> Sender:
        pass

    @property
    @abstractmethod
    def handler_manager(self) -> HandlerManager:
        pass

    @property
    @abstractmethod
    def application_manager(self) -> ApplicationManager:
        pass

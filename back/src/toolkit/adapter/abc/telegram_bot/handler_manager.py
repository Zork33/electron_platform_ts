from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable

from toolkit.abc.messenger.models import Message


class HandlerManager(ABC):
    @abstractmethod
    def __init__(self, application: object):
        pass

    @abstractmethod
    def add_command_handler(
        self,
        command: str,
        handler: Callable[[Message], Awaitable[None]],
    ) -> object:
        pass

    @abstractmethod
    def add_message_handler(
        self,
        handler: Callable[[Message], Awaitable[None]],
    ) -> object:
        pass

    @abstractmethod
    def remove_handler(self, handler: object) -> None:
        pass

    @property
    @abstractmethod
    def application(self) -> object:
        pass

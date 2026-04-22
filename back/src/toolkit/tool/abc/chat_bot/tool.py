from abc import abstractmethod
from collections.abc import Awaitable, Callable

from toolkit.abc.abstract_tool import AbstractTool
from toolkit.abc.messenger.models import Message


class ChatBot(AbstractTool):
    _code = "chat_bot"
    _title = "Chat bot"

    @property
    @abstractmethod
    def title(self) -> str:
        pass

    @property
    @abstractmethod
    def username(self) -> str | None:
        pass

    @abstractmethod
    async def send(self, message: Message) -> Message:
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

    @abstractmethod
    async def health_check(self) -> bool:
        pass

    @abstractmethod
    async def start(self) -> None:
        pass

    @abstractmethod
    async def stop(self) -> None:
        pass

    @abstractmethod
    async def shutdown(self) -> None:
        pass

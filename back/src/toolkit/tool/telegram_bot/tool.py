from collections.abc import Awaitable, Callable

from toolkit.abc.messenger.models import Message
from toolkit.abc.tool import Tool
from toolkit.adapter.abc.telegram_bot.adapter import TelegramBot as TelegramBotAdapter
from toolkit.tool.abc.chat_bot.tool import ChatBot


class TelegramBot(Tool, ChatBot):
    _code = "telegram_bot"
    _title = "Telegram bot"

    def __init__(self, adapter: TelegramBotAdapter, title: str):
        self._adapter = adapter
        self._title_label = title
        self._username = adapter.username

    async def send(self, message: Message) -> Message:
        return await self._adapter.sender.send(message)

    def add_command_handler(
        self,
        command: str,
        handler: Callable[[Message], Awaitable[None]],
    ) -> object:
        return self._adapter.handler_manager.add_command_handler(command, handler)

    def add_message_handler(
        self,
        handler: Callable[[Message], Awaitable[None]],
    ) -> object:
        return self._adapter.handler_manager.add_message_handler(handler)

    def remove_handler(self, handler: object) -> None:
        self._adapter.handler_manager.remove_handler(handler)

    @property
    def adapter(self) -> TelegramBotAdapter:
        return self._adapter

    @property
    def title(self) -> str:
        return self._title_label

    @property
    def username(self) -> str | None:
        return self._username

    async def health_check(self) -> bool:
        return await self._adapter.application_manager.health_check()

    async def start(self) -> None:
        await self._adapter.application_manager.start()

    async def stop(self) -> None:
        await self._adapter.application_manager.stop()

    async def shutdown(self) -> None:
        await self._adapter.application_manager.shutdown()

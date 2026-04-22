from collections.abc import Awaitable, Callable

from telegram.ext import CommandHandler, MessageHandler, filters

from toolkit.abc.messenger.models import Message
from toolkit.adapter.abc.telegram_bot.handler_manager import HandlerManager as AbstractHandlerManager

from .converter import ptb_message_to_message


class HandlerManager(AbstractHandlerManager):
    def __init__(self, application: object):
        self._application = application

    def add_command_handler(
        self,
        command: str,
        handler: Callable[[Message], Awaitable[None]],
    ) -> object:
        async def wrapper(update, context):
            await handler(ptb_message_to_message(update.message))

        ptb_handler = CommandHandler(command, wrapper)
        self._application.add_handler(ptb_handler)
        return ptb_handler

    def add_message_handler(
        self,
        handler: Callable[[Message], Awaitable[None]],
    ) -> object:
        async def wrapper(update, context):
            await handler(ptb_message_to_message(update.message))

        ptb_handler = MessageHandler(filters.TEXT & ~filters.COMMAND, wrapper)
        self._application.add_handler(ptb_handler)
        return ptb_handler

    def remove_handler(self, handler: object) -> None:
        self._application.remove_handler(handler)

    @property
    def application(self) -> object:
        return self._application

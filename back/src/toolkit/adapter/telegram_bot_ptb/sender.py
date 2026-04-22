from toolkit.abc.messenger.models import (
    DocumentContent,
    ImageContent,
    Message,
    MessengerType,
    TextContent,
    VideoContent,
    VoiceContent,
)
from toolkit.adapter.abc.telegram_bot.application_manager import ApplicationManager
from toolkit.adapter.abc.telegram_bot.sender import Sender as AbstractSender

from .converter import build_reply_markup, build_reply_parameters


def _fill_sent(message: Message, ptb_message: object) -> Message:
    message.message_id = ptb_message.message_id
    message.datetime = ptb_message.date
    message.messenger_type = MessengerType.TELEGRAM
    return message


class Sender(AbstractSender):
    def __init__(self, application_manager: ApplicationManager):
        self._application_manager = application_manager
        self._bot = self._application_manager.application.bot

    async def send_text(self, message: Message) -> Message:
        content: TextContent = message.content
        ptb_message = await self._bot.send_message(
            chat_id=message.chat_id,
            text=content.text,
            parse_mode=message.parse_mode,
            reply_parameters=build_reply_parameters(message.reply_to_message_id),
            reply_markup=build_reply_markup(message.inline_keyboard),
        )
        return _fill_sent(message, ptb_message)

    async def send_photo(self, message: Message) -> Message:
        content: ImageContent = message.content
        ptb_message = await self._bot.send_photo(
            chat_id=message.chat_id,
            photo=content.file_id,
            caption=content.caption,
            parse_mode=message.parse_mode,
            reply_parameters=build_reply_parameters(message.reply_to_message_id),
            reply_markup=build_reply_markup(message.inline_keyboard),
        )
        return _fill_sent(message, ptb_message)

    async def send_video(self, message: Message) -> Message:
        content: VideoContent = message.content
        ptb_message = await self._bot.send_video(
            chat_id=message.chat_id,
            video=content.file_id,
            caption=content.caption,
            parse_mode=message.parse_mode,
            reply_parameters=build_reply_parameters(message.reply_to_message_id),
            reply_markup=build_reply_markup(message.inline_keyboard),
        )
        return _fill_sent(message, ptb_message)

    async def send_voice(self, message: Message) -> Message:
        content: VoiceContent = message.content
        ptb_message = await self._bot.send_voice(
            chat_id=message.chat_id,
            voice=content.file_id,
            caption=content.caption,
            reply_parameters=build_reply_parameters(message.reply_to_message_id),
        )
        return _fill_sent(message, ptb_message)

    async def send_document(self, message: Message) -> Message:
        content: DocumentContent = message.content
        ptb_message = await self._bot.send_document(
            chat_id=message.chat_id,
            document=content.file_id,
            filename=content.filename,
            caption=content.caption,
            parse_mode=message.parse_mode,
            reply_parameters=build_reply_parameters(message.reply_to_message_id),
            reply_markup=build_reply_markup(message.inline_keyboard),
        )
        return _fill_sent(message, ptb_message)

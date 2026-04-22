from telegram import Message as PtbMessage
from telegram import User as PtbUser
from telegram import InlineKeyboardMarkup, InlineKeyboardButton, ReplyParameters

from toolkit.abc.messenger.models import (
    ChatType,
    ChatUser,
    InlineKeyboard,
    Message,
    MessengerType,
    TextContent,
)

_CHAT_TYPE_MAP = {
    "private": ChatType.PRIVATE,
    "group": ChatType.GROUP,
    "supergroup": ChatType.SUPERGROUP,
    "channel": ChatType.CHANNEL,
}


def ptb_user_to_chat_user(user: PtbUser) -> ChatUser:
    return ChatUser(
        id=user.id,
        messenger_type=MessengerType.TELEGRAM,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
    )


def ptb_message_to_message(ptb_message: PtbMessage, is_edited: bool = False) -> Message:
    return Message(
        chat_id=ptb_message.chat_id,
        content=TextContent(text=ptb_message.text or ""),
        messenger_type=MessengerType.TELEGRAM,
        chat_type=_CHAT_TYPE_MAP.get(ptb_message.chat.type, ChatType.PRIVATE),
        message_id=ptb_message.message_id,
        from_user=ptb_user_to_chat_user(ptb_message.from_user),
        datetime=ptb_message.date,
        reply_to_message_id=(
            ptb_message.reply_to_message.message_id if ptb_message.reply_to_message else None
        ),
        is_edited=is_edited,
    )


def build_reply_markup(inline_keyboard: InlineKeyboard | None) -> InlineKeyboardMarkup | None:
    if inline_keyboard is None:
        return None
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                text=btn.text,
                callback_data=btn.callback_data,
                url=btn.url,
            )
            for btn in row
        ]
        for row in inline_keyboard.rows
    ])


def build_reply_parameters(reply_to_message_id: int | None) -> ReplyParameters | None:
    if reply_to_message_id is None:
        return None
    return ReplyParameters(message_id=reply_to_message_id)

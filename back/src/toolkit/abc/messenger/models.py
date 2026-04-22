from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class MessengerType(str, Enum):
    TELEGRAM = "telegram"
    MAX = "max"
    TUK_TUK = "tuk_tuk"


class ChatType(str, Enum):
    PRIVATE = "private"
    GROUP = "group"
    SUPERGROUP = "supergroup"
    CHANNEL = "channel"


@dataclass
class ChatUser:
    id: int
    messenger_type: MessengerType
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone_number: str | None = None


@dataclass
class TextContent:
    text: str


@dataclass
class ImageContent:
    file_id: str
    caption: str | None = None


@dataclass
class VideoContent:
    file_id: str
    caption: str | None = None


@dataclass
class VoiceContent:
    file_id: str
    caption: str | None = None


@dataclass
class DocumentContent:
    file_id: str
    filename: str | None = None
    caption: str | None = None


Content = TextContent | ImageContent | VideoContent | VoiceContent | DocumentContent


@dataclass
class InlineButton:
    text: str
    callback_data: str | None = None
    url: str | None = None


@dataclass
class InlineKeyboard:
    rows: list[list[InlineButton]] = field(default_factory=list)


@dataclass
class Message:
    chat_id: int | str
    content: Content

    messenger_type: MessengerType | None = None
    chat_type: ChatType | None = None

    message_id: int | None = None
    from_user: ChatUser | None = None
    datetime: datetime | None = None

    reply_to_message_id: int | None = None
    inline_keyboard: InlineKeyboard | None = None
    parse_mode: str | None = None

    mentions: list[ChatUser] = field(default_factory=list)
    is_edited: bool = False
    forward_from: ChatUser | None = None


@dataclass
class CallbackQuery:
    id: str
    from_user: ChatUser
    chat_id: int
    message_id: int | None
    data: str | None
    messenger_type: MessengerType

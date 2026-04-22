from abc import ABC, abstractmethod

from toolkit.abc.messenger.models import (
    DocumentContent,
    ImageContent,
    Message,
    TextContent,
    VideoContent,
    VoiceContent,
)

from .application_manager import ApplicationManager


class Sender(ABC):
    @abstractmethod
    def __init__(self, application_manager: ApplicationManager):
        pass

    @abstractmethod
    async def send_text(self, message: Message) -> Message:
        pass

    @abstractmethod
    async def send_photo(self, message: Message) -> Message:
        pass

    @abstractmethod
    async def send_video(self, message: Message) -> Message:
        pass

    @abstractmethod
    async def send_voice(self, message: Message) -> Message:
        pass

    @abstractmethod
    async def send_document(self, message: Message) -> Message:
        pass

    async def send(self, message: Message) -> Message:
        content = message.content
        if isinstance(content, TextContent):
            return await self.send_text(message)
        if isinstance(content, ImageContent):
            return await self.send_photo(message)
        if isinstance(content, VideoContent):
            return await self.send_video(message)
        if isinstance(content, VoiceContent):
            return await self.send_voice(message)
        if isinstance(content, DocumentContent):
            return await self.send_document(message)
        raise ValueError(f"Unsupported content type: {type(content)}")

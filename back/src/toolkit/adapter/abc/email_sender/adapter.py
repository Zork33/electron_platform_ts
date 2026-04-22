from abc import abstractmethod

from toolkit.abc.abstract_adapter import AbstractAdapter

from .config import SmtpConnectionConfig


class EmailSender(AbstractAdapter):
    _code = "email_sender"
    _title = "Email sender"
    @abstractmethod
    async def send_email(self, to: list[str], subject: str, body: str) -> bool:
        pass

    @abstractmethod
    async def send_html_email(self, to: list[str], subject: str, html_body: str) -> bool:
        pass

    @property
    def connection_config(self) -> SmtpConnectionConfig:
        pass
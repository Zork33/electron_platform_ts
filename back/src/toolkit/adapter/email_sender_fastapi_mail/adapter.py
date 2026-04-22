import traceback
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

from toolkit.abc.adapter import Adapter
from toolkit.adapter.abc.email_sender.adapter import EmailSender
from toolkit.adapter.abc.email_sender.config import SmtpConnectionConfig


class EmailSenderFastapiMail(Adapter, EmailSender):
    _code = "fastapi_mail"
    _title = "FastAPI Mail"
    def __init__(self, connection_config: SmtpConnectionConfig):
        self._connection_config = connection_config
        cfg = ConnectionConfig(
            MAIL_USERNAME=connection_config.username,
            MAIL_PASSWORD=connection_config.password,
            MAIL_FROM=connection_config.from_email,
            MAIL_FROM_NAME=connection_config.from_name,
            MAIL_SERVER=connection_config.server,
            MAIL_PORT=connection_config.port,
            MAIL_STARTTLS=connection_config.starttls,
            MAIL_SSL_TLS=connection_config.ssl_tls,
            USE_CREDENTIALS=connection_config.use_credentials,
            VALIDATE_CERTS=connection_config.validate_certs,
        )
        self._fastmail = FastMail(cfg)
        
    @property
    def connection_config(self) -> SmtpConnectionConfig:
        return self._connection_config
    
    async def send_email(self, to: list[str], subject: str, body: str) -> bool:
        try:
            message = MessageSchema(
                subject=subject,
                recipients=to,
                body=body,
                subtype="plain"
            )
            
            await self._fastmail.send_message(message)
            return True
        except Exception as e:
            print(f"Ошибка при отправке письма: {e}")
            print(traceback.format_exc())
            return False
    
    async def send_html_email(self, to: list[str], subject: str, html_body: str) -> bool:
        try:
            message = MessageSchema(
                subject=subject,
                recipients=to,
                body=html_body,
                subtype="html"
            )

            await self._fastmail.send_message(message)
            return True
        except Exception as e:
            print(f"Ошибка при отправке HTML-письма: {e}")
            print(traceback.format_exc())
            return False

def get_email_sender_adapter() -> EmailSenderFastapiMail:
    return EmailSenderFastapiMail.get_from_container("email_sender")

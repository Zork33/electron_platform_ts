from toolkit.abc.tool import Tool
from toolkit.adapter.abc.email_sender.adapter import EmailSender as EmailSenderAdapter
from toolkit.adapter.abc.email_sender.config import SmtpConnectionConfig


class EmailSender(Tool):
    _code = "email_sender"
    _title = "Email sender"
    def __init__(self, sender_adapter: EmailSenderAdapter):
        self._sender_adapter = sender_adapter
        
    async def send_message(self, to: list[str], subject: str, body: str) -> bool:
        return await self._sender_adapter.send_email(to, subject, body)
        
    async def send_html_message(self, to: list[str], subject: str, html_body: str) -> bool:
        return await self._sender_adapter.send_html_email(to, subject, html_body)
    
    def health_check(self) -> bool:
        try:
            if self._sender_adapter is None:
                return False
                
            return True
        except Exception as e:
            print(f"Ошибка при проверке работоспособности Email-клиента: {e}")
            return False
    
    @property
    def sender_adapter(self) -> EmailSenderAdapter:
        return self._sender_adapter
    
    @property
    def connection_config(self) -> SmtpConnectionConfig:
        return self.sender_adapter.connection_config

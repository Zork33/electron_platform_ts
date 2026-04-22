from configs import email_sender as email_sender_config
from toolkit.tool.email_sender.tool import EmailSender
from toolkit.adapter.email_sender_fastapi_mail.adapter import EmailSenderFastapiMail


def create_email_sender() -> EmailSender:
    adapter = EmailSenderFastapiMail("email_sender", email_sender_config.connection())
    email_sender = EmailSender("email_sender", sender_adapter=adapter)
    print("Email sender initialized successfully")
    return email_sender

from __future__ import annotations
from datetime import datetime, UTC
import secrets
from typing import TYPE_CHECKING

from toolkit.tool.email_sender.tool import EmailSender
from system.errors import ValidationError

if TYPE_CHECKING:
    from .entity import UserAuthConfirmCode


class CodeManager:
    def __init__(self, auth_record: UserAuthConfirmCode):
        self._auth_record = auth_record

    async def _get_settings(self, tx=None):
        from logic.entity.user_auth_confirm_code_settings.entity import UserAuthConfirmCodeSettings
        results = await UserAuthConfirmCodeSettings.get_list(
            filters=[{"field": "reason_id", "value": self._auth_record.reason_id, "operator": "="}],
            page_count=1,
            page_number=1,
            tx=tx,
        )
        settings = results[0] if results else None
        if not settings:
            raise ValidationError(
                f"Настройки для reason_id={self._auth_record.reason_id} не найдены",
                error_code="SETTINGS_NOT_FOUND",
            )
        return settings

    @staticmethod
    def generate_code(alphabet: str, length: int) -> str:
        if not alphabet or length <= 0:
            raise ValueError("Некорректные параметры для генерации кода")

        return "".join(secrets.choice(alphabet) for _ in range(length))

    async def send_to_email(
        self,
        settings=None,
        subject: str = None,
        html_template: str = None,
        email_sender: EmailSender = None,
    ):
        actual_settings = settings or await self._get_settings()
        actual_email_sender = email_sender or EmailSender.get_from_container("email_sender")

        now = datetime.now(UTC)

        if now >= self._auth_record.expires_at:
            raise ValidationError("Срок действия кода подтверждения истек", error_code="CONFIRM_CODE_EXPIRED")

        if self._auth_record.sending_attempts_count >= actual_settings.sending_max_attempts_count:
            raise ValidationError(
                f"Превышен лимит попыток отправки ({actual_settings.sending_max_attempts_count})",
                error_code="SENDING_ATTEMPTS_EXCEEDED"
            )

        default_html_template = "<p>Ваш код подтверждения: <strong>{confirm_code}</strong></p>"
        email_subject = subject or actual_settings.sending_subject
        html_body = (html_template or default_html_template).format(confirm_code=self._auth_record.confirm_code)

        await actual_email_sender.send_html_message([self._auth_record.auth_email], email_subject, html_body)

    async def verify_code(
        self,
        received_confirm_code: str,
        settings=None,
    ):
        actual_settings = settings or await self._get_settings()
        now = datetime.now(UTC)

        if now >= self._auth_record.expires_at:
            raise ValidationError("Срок действия кода подтверждения истек", error_code="CONFIRM_CODE_EXPIRED")

        if self._auth_record.verification_attempts_count >= actual_settings.verification_max_attempts_count:
            raise ValidationError(
                f"Превышен лимит попыток подтверждения ({actual_settings.verification_max_attempts_count})",
                error_code="VERIFICATION_ATTEMPTS_EXCEEDED"
            )

        if received_confirm_code.strip() != self._auth_record.confirm_code:
            raise ValidationError("Неверный код подтверждения", error_code="INVALID_CONFIRM_CODE")

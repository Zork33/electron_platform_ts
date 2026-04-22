from __future__ import annotations
from datetime import datetime, UTC
import json
from typing import TYPE_CHECKING

from .models import History

if TYPE_CHECKING:
    from .entity import UserAuthConfirmCode


class ResultWriter:
    def __init__(self, auth_record: UserAuthConfirmCode):
        self._auth_record = auth_record

    @property
    def history_entries(self) -> list[History]:
        if not self._auth_record.history:
            return []
        
        try:
            data = json.loads(self._auth_record.history)
            return [History(**entry) for entry in data]
        except (json.JSONDecodeError, TypeError):
            return []

    def build_history_with_new_entry(self, action: str, timestamp: str, ok: bool, error_message: str | None = None) -> str:
        new_entry = History(action=action, timestamp=timestamp, ok=ok, error_message=error_message)
        entries = self.history_entries
        entries.append(new_entry)
        return json.dumps([entry.__dict__ for entry in entries])

    async def sending_result(
        self,
        is_success: bool,
        error: str = None,
        tx=None,
    ):
        now = datetime.now(UTC)
        now_timestamp = now.isoformat()
        action = "send"

        updated_history = self.build_history_with_new_entry(action, now_timestamp, is_success, error)

        await self._auth_record.update_self(
            tx=tx,
            is_sent=is_success,
            sending_at=now,
            sending_attempts_count=self._auth_record.sending_attempts_count + 1,
            sending_error=error,
            history=updated_history,
        )

    async def verification_result(
        self,
        is_success: bool,
        error: str = None,
        tx=None,
    ):
        now = datetime.now(UTC)
        now_timestamp = now.isoformat()
        action = "verify"

        updated_history = self.build_history_with_new_entry(action, now_timestamp, is_success, error)

        await self._auth_record.update_self(
            tx=tx,
            is_verified=is_success,
            verification_at=now,
            verification_attempts_count=self._auth_record.verification_attempts_count + 1,
            verification_error=error,
            history=updated_history,
        )

    async def user_creation_result(
        self,
        is_success: bool,
        user_id: int = None,
        error: str = None,
        tx=None,
    ):
        now = datetime.now(UTC)
        now_timestamp = now.isoformat()
        action = "user_creation"

        updated_history = self.build_history_with_new_entry(action, now_timestamp, is_success, error)

        await self._auth_record.update_self(
            tx=tx,
            is_user_created=is_success,
            user_creation_at=now,
            user_creation_error=error,
            user_id=user_id,
            history=updated_history,
        )

    async def access_token_result(
        self,
        is_success: bool,
        error: str = None,
        tx=None,
    ):
        now = datetime.now(UTC)
        now_timestamp = now.isoformat()
        action = "access_token_creation"

        updated_history = self.build_history_with_new_entry(action, now_timestamp, is_success, error)

        await self._auth_record.update_self(
            tx=tx,
            is_access_token_created=is_success,
            access_token_created_at=now,
            access_token_error=error,
            history=updated_history,
        )

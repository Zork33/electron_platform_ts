from datetime import datetime

from logic.abc.presets.entity import Entity
from data_framework.storage_settings import StorageSettings
from .storage import UserAuthConfirmCodeStorage
from .code_manager import CodeManager
from .result_writer import ResultWriter
from toolkit.tool.sql_db.tool import SqlDb


class UserAuthConfirmCode(Entity):
    _storage_settings = StorageSettings(storage_class=UserAuthConfirmCodeStorage)

    CodeManager = CodeManager
    ResultWriter = ResultWriter

    reason_id: int

    user_id: int | None = None

    first_name: str | None = None
    last_name: str | None = None
    middle_name: str | None = None
    auth_email: str | None = None

    confirm_code: str
    expires_at: datetime
    token: str

    sending_at: datetime | None = None
    is_sent: bool = False
    sending_error: str | None = None
    sending_attempts_count: int = 0

    verification_at: datetime | None = None
    is_verified: bool = False
    verification_error: str | None = None
    verification_attempts_count: int = 0

    user_creation_at: datetime | None = None
    is_user_created: bool = False
    user_creation_error: str | None = None

    access_token_created_at: datetime | None = None
    is_access_token_created: bool = False
    access_token_error: str | None = None

    history: str | None = None

    @property
    def code_manager(self) -> CodeManager:
        return self.CodeManager(self)

    @property
    def result_writer(self) -> ResultWriter:
        return self.ResultWriter(self)

    @classmethod
    async def get_by_token(cls, token: str, tx=None, db_client: SqlDb = None, storage: UserAuthConfirmCodeStorage = None):
        actual_storage = storage or cls._get_storage()
        data = await actual_storage.get_by_token(token, tx=tx)
        if data:
            instance = cls._create_instance()
            instance._populate_from_data(data)
            return instance
        return None

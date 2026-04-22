from logic.abc.presets.entity import Entity
from data_framework.storage_settings import StorageSettings


class UserAuthConfirmCodeSettings(Entity):
    _storage_settings = StorageSettings(table_name="user_auth_confirm_code_settings")

    reason_id: int

    confirm_code_length: int
    confirm_code_ttl_minutes: int
    confirm_code_alphabet: str

    sending_max_attempts_count: int
    sending_cooldown_seconds: int
    sending_subject: str

    verification_max_attempts_count: int

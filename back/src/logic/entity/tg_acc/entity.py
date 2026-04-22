from logic.abc.presets.entity import Entity
from data_framework.storage_settings import StorageSettings


class TgAcc(Entity):
    _storage_settings = StorageSettings(table_name="tg_acc")
    
    user_id: int | None = None
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone_number_id: int | None = None

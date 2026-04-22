from logic.abc.presets.entity import Entity
from data_framework.storage_settings import StorageSettings


class PhoneNumber(Entity):
    _storage_settings = StorageSettings(table_name="phone_number")
    
    phone_pattern_id: int | None = None
    number: str | None = None
    full_number: str | None = None

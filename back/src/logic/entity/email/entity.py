from logic.abc.presets.entity import Entity
from data_framework.storage_settings import StorageSettings


class Email(Entity):
    _storage_settings = StorageSettings(table_name="email")
    
    address: str

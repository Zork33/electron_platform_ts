from logic.abc.presets.entity import Entity
from data_framework.storage_settings import StorageSettings


class WebLink(Entity):
    _storage_settings = StorageSettings(table_name="web_link")
    
    title: str | None = None
    type_id: int
    custom_type_name: str | None = None
    url: str
    description: str | None = None

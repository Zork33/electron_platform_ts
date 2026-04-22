from logic.abc.presets.entity import Entity
from data_framework.storage_settings import StorageSettings


class StoredFile(Entity):
    _storage_settings = StorageSettings(table_name="stored_file")

    file_storage_part_id: int
    path: str
    filename: str
    ext: str
    size_bytes: int

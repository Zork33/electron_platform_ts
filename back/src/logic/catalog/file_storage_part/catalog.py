from logic.abc.presets.catalog import Catalog
from data_framework.storage_settings import StorageSettings


class FileStoragePart(Catalog):
    _storage_settings = StorageSettings(table_name="file_storage_part")

    name: str | None = None
    is_public: bool | None = None
    description: str | None = None

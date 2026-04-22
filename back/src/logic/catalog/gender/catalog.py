from logic.abc.presets.catalog import Catalog
from data_framework.storage_settings import StorageSettings


class Gender(Catalog):
    _storage_settings = StorageSettings(table_name="gender")

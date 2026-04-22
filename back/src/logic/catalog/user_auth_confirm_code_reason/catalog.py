from logic.abc.presets.catalog import Catalog
from data_framework.storage_settings import StorageSettings


class UserAuthReason(Catalog):
    _storage_settings = StorageSettings(table_name="user_auth_reason")
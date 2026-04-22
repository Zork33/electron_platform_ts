from logic.abc.presets.catalog import Catalog
from data_framework.storage_settings import StorageSettings


class PhonePattern(Catalog):
    _storage_settings = StorageSettings(table_name="phone_pattern")

    country_id: int
    country_phone_code: str
    number_pattern: str | None = None
    min_length: int
    max_length: int
    mask: str | None = None
    example: str | None = None

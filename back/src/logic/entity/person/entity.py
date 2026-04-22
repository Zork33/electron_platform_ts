from datetime import date
from logic.abc.presets.entity import Entity
from data_framework.storage_settings import StorageSettings


class Person(Entity):
    _storage_settings = StorageSettings(table_name="person")

    first_name: str
    last_name: str | None = None
    middle_name: str | None = None
    birth_date: date | None = None
    gender_id: int | None = None
    description: str | None = None


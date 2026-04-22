from logic.abc.presets.entity import Entity
from data_framework.storage_settings import StorageSettings


class ContactInfo(Entity):
    _storage_settings = StorageSettings(table_name="contact_info")

    person_id: int | None = None
    phone_number_id: int | None = None
    tg_acc_id: int | None = None
    email_id: int | None = None
    web_link_id: int | None = None
    description: str | None = None
    is_primary: bool = False

from dataclasses import dataclass, field


@dataclass
class StorageSettings:
    table_name: str | None = None
    storage_class: type | None = None
    required_fields: list[str] = field(default_factory=lambda: ["id", "created_at", "updated_at"])

    def __post_init__(self):
        if self.table_name and self.storage_class:
            raise TypeError("StorageSettings: define either table_name or storage_class, not both")
        if not self.table_name and not self.storage_class:
            raise TypeError("StorageSettings: define either table_name or storage_class")

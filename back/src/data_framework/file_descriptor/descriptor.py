from dataclasses import dataclass
from enum import Enum

from toolkit.adapter.abc.file_storage.models import StoragePart

from data_framework.file_descriptor.file_settings import FileSettings


class FileDescriptor:

    class Type(str, Enum):
        FILE = "file"
        COLLECTION = "collection"

    def __init__(
        self,
        type: 'FileDescriptor.Type',
        storage_part: StoragePart,
        storage_path_template: str,
        fk_column: str,
        file_settings: FileSettings | None = None,
        include_in_get: bool = True,
        include_in_get_list: bool = False,
        delete_on_delete: bool = False,
        delete_on_hard_delete: bool = True,
    ):
        if not fk_column:
            raise ValueError("FileDescriptor требует параметр 'fk_column'")

        self.type = type
        self.storage_part = storage_part
        self.storage_path_template = storage_path_template
        self.fk_column = fk_column
        self.file_settings = file_settings
        self.include_in_get = include_in_get
        self.include_in_get_list = include_in_get_list
        self.delete_on_delete = delete_on_delete
        self.delete_on_hard_delete = delete_on_hard_delete
        self.attr_name: str | None = None
        self.owner_class: type | None = None

    @property
    def allowed_extensions(self) -> set[str] | None:
        if self.file_settings is None:
            return None
        extensions = set()
        for settings in [self.file_settings.image, self.file_settings.video, self.file_settings.audio]:
            if settings is not None:
                extensions.update(settings.allowed_extensions)
        if self.file_settings.any is not None:
            if self.file_settings.any.allowed_extensions is None:
                return None
            extensions.update(self.file_settings.any.allowed_extensions)
        return extensions or None

    def __set_name__(self, owner: type, name: str) -> None:
        self.attr_name = name
        self.owner_class = owner

    def __get__(self, obj: object | None, objtype: type | None = None):
        if obj is None:
            return self
        bound_attr = f"_bound_{self.attr_name}"
        if hasattr(obj, bound_attr):
            return getattr(obj, bound_attr)
        return self

    @property
    def is_file(self) -> bool:
        return self.type == FileDescriptor.Type.FILE

    @property
    def is_collection(self) -> bool:
        return self.type == FileDescriptor.Type.COLLECTION

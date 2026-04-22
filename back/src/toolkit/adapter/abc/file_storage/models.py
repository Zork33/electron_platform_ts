from dataclasses import dataclass
from datetime import datetime
from typing import BinaryIO


@dataclass
class FilePath:
    """Путь к файлу в хранилище"""
    storage_part_name: str
    path: str


@dataclass
class StoragePart:
    """Раздел файлового хранилища (bucket в MinIO/S3, container в Azure)"""
    name: str
    is_public: bool = False


@dataclass
class UploadParams:
    """Параметры для загрузки файла"""
    file_path: FilePath
    data: bytes | BinaryIO
    size: int | None = None
    content_type: str | None = None


@dataclass
class UploadResult:
    """Результат загрузки файла"""
    file_path: FilePath
    size_bytes: int
    etag: str | None = None


@dataclass
class FileInfo:
    """Метаданные файла в хранилище"""
    file_path: FilePath
    size_bytes: int
    content_type: str | None = None
    last_modified: datetime | None = None
    etag: str | None = None

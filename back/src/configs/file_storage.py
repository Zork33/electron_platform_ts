import os
from toolkit.adapter.abc.file_storage.config import ConnectionConfig


def connection() -> ConnectionConfig:
    return ConnectionConfig(
        host=os.getenv("FILE_STORAGE_HOST"),
        port=int(os.getenv("FILE_STORAGE_PORT")),
        login=os.getenv("FILE_STORAGE_CLIENT_LOGIN"),
        password=os.getenv("FILE_STORAGE_CLIENT_PASSWORD"),
        use_ssl=os.getenv("FILE_STORAGE_USE_SSL", "false").lower() == "true"
    )

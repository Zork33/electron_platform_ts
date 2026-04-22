import os
from toolkit.adapter.abc.sql_db.config import ConnectionConfig


def connection() -> ConnectionConfig:
    host = os.environ.get("DB_HOST")
    port = int(os.environ.get("DB_PORT"))
    database_name = os.environ.get("DB_NAME")
    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    pool_min_size = int(os.environ.get("DB_POOL_MIN_SIZE"))
    pool_max_size = int(os.environ.get("DB_POOL_MAX_SIZE"))
    
    return ConnectionConfig(
        host=host,
        port=port,
        name=database_name,
        user=user,
        password=password,
        pool_min_size=pool_min_size,
        pool_max_size=pool_max_size
    )

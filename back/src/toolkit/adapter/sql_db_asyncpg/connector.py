import json

import asyncpg
from toolkit.adapter.abc.sql_db.connector import Connector as AbstractConnector
from toolkit.adapter.abc.sql_db.config import ConnectionConfig


async def _init_connection(conn):
    """Регистрация JSON-кодека для корректной работы с jsonb-колонками."""
    await conn.set_type_codec(
        'jsonb',
        encoder=json.dumps,
        decoder=json.loads,
        schema='pg_catalog',
    )
    await conn.set_type_codec(
        'json',
        encoder=json.dumps,
        decoder=json.loads,
        schema='pg_catalog',
    )


class Connector(AbstractConnector):
    def __init__(self, connection_config: ConnectionConfig):
        self.host = connection_config.host
        self.port = connection_config.port
        self.name = connection_config.name
        self.user = connection_config.user
        self.password = connection_config.password
        self.pool_min_size = connection_config.pool_min_size
        self.pool_max_size = connection_config.pool_max_size
        self._pool = None
    
    @property
    def pool(self):
        return self._pool

    async def connect(self) -> None:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                host=self.host,
                port=self.port,
                database=self.name,
                user=self.user,
                password=self.password,
                min_size=self.pool_min_size,
                max_size=self.pool_max_size,
                init=_init_connection,
            )
            
            is_healthy = await self.health_check()
            if not is_healthy:
                await self.disconnect()
                raise RuntimeError("Проверка работоспособности соединения с БД не удалась после подключения")

    async def disconnect(self) -> None:
        if self._pool:
            await self._pool.close()
            self._pool = None

    async def health_check(self) -> bool:
        if self._pool is None:
            return False
        try:
            async with self._pool.acquire() as conn:
                await conn.fetchval('SELECT 1')
            return True
        except Exception:
            return False 
from configs import db as db_config
from toolkit.tool.sql_db.tool import SqlDb
from toolkit.adapter.sql_db_asyncpg.adapter import SqlDbAsyncpg


def _create_db_client() -> SqlDb:
    adapter = SqlDbAsyncpg("db", connection_config=db_config.connection())
    db_client = SqlDb("db", client_adapter=adapter)
    return db_client


async def connect_db():
    db_client: SqlDb = _create_db_client()
    await db_client.connector.connect()
    await db_client.connector.health_check()
    print("DB connected successfully")


async def disconnect_db():
    db_client: SqlDb = SqlDb.get_from_container("db")
    await db_client.connector.disconnect()
    print("DB disconnected successfully")

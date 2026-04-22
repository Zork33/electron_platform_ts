from toolkit.abc.tool import Tool
from toolkit.adapter.abc.sql_db.config import ConnectionConfig
from toolkit.adapter.abc.sql_db.adapter import SqlDb as AbstractSqlDbAdapter
from toolkit.tool.abc.sql_db.tool import SqlDb as AbstractSqlDb

from .connector import Connector
from .query_executor import QueryExecutor
from .transaction_manager import TransactionManager


class SqlDb(Tool, AbstractSqlDb):
    _code = "sql_db"
    _title = "SQL database"
    _description = "Подключение к SQL базе данных"
    
    Connector = Connector
    TransactionManager = TransactionManager
    QueryExecutor = QueryExecutor
    
    def __init__(self, client_adapter: AbstractSqlDbAdapter):
        if client_adapter is None:
            raise ValueError("client_adapter не может быть None")
        self._client_adapter = client_adapter
        self._connector = self.Connector(self._client_adapter)
        self._transaction_manager = self.TransactionManager(self._client_adapter)
        self._query_executor = self.QueryExecutor(self._client_adapter)

    @property
    def connection_config(self) -> ConnectionConfig:
        return self.client_adapter.connection_config

    @property
    def client_adapter(self):
        return self._client_adapter

    @property
    def connector(self) -> Connector:
        return self._connector

    @property
    def query_executor(self) -> QueryExecutor:
        return self._query_executor

    @property
    def transaction_manager(self) -> TransactionManager:
        return self._transaction_manager

    async def health_check(self) -> bool:
        return await self.connector.health_check()

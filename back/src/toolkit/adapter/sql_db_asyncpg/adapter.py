from toolkit.abc.adapter import Adapter
from toolkit.adapter.abc.sql_db.config import ConnectionConfig
from toolkit.adapter.abc.sql_db.adapter import SqlDb as AbstractSqlDb
from .connector import Connector
from .executor import Executor
from .transaction_manager import TransactionManager


class SqlDbAsyncpg(Adapter, AbstractSqlDb):
    _code = "asyncpg"
    _title = "asyncpg"
    Connector = Connector
    Executor = Executor
    TransactionManager = TransactionManager
    
    def __init__(self, connection_config: ConnectionConfig):
        if connection_config is None:
            raise ValueError("connection_config не может быть None")
        self._connection_config = connection_config
        self._connector = self.Connector(connection_config)
        self._executor = self.Executor()
        self._transaction_manager = self.TransactionManager(connector=self._connector)

    @property
    def connector(self) -> Connector:
        return self._connector

    @property
    def executor(self) -> Executor:
        return self._executor

    @property
    def transaction_manager(self) -> TransactionManager:
        return self._transaction_manager

    @property
    def connection_config(self) -> ConnectionConfig:
        return self._connection_config


def get_db_adapter() -> SqlDbAsyncpg:
    return SqlDbAsyncpg.get_from_container("db")

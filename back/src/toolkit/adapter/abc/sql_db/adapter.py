from abc import abstractmethod

from toolkit.abc.abstract_adapter import AbstractAdapter

from .config import ConnectionConfig
from .connector import Connector
from .executor import Executor
from .transaction_manager import TransactionManager


class SqlDb(AbstractAdapter):
    _code = "sql_db"
    _title = "SQL database"
    Connector = Connector
    Executor = Executor
    TransactionManager = TransactionManager

    @abstractmethod
    def __init__(self, connection_config: ConnectionConfig):
        pass

    @property
    def connection_config(self) -> ConnectionConfig:
        return self.connection_config

    @property
    @abstractmethod
    def connector(self) -> Connector:
        pass

    @property
    @abstractmethod
    def executor(self) -> Executor:
        pass

    @property
    @abstractmethod
    def transaction_manager(self) -> TransactionManager:
        pass

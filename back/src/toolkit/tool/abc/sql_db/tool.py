from abc import abstractmethod

from toolkit.abc.abstract_tool import AbstractTool
from toolkit.tool.sql_db.connector import Connector
from toolkit.tool.sql_db.query_executor import QueryExecutor
from toolkit.tool.sql_db.transaction_manager import TransactionManager


class SqlDb(AbstractTool):
    _code = "sql_db"
    _title = "SQL database"

    @property
    @abstractmethod
    def connector(self) -> Connector:
        pass

    @property
    @abstractmethod
    def query_executor(self) -> QueryExecutor:
        pass

    @property
    @abstractmethod
    def transaction_manager(self) -> TransactionManager:
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        pass

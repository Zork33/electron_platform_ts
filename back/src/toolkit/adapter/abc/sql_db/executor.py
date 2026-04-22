from abc import ABC, abstractmethod


class Executor(ABC):
    @abstractmethod
    async def execute_raw_sql(
        self,
        conn,
        sql_query: str,
        params: list | tuple,
        fetch: bool
    ) -> list | str | None:
        pass
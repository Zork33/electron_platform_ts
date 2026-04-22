from toolkit.adapter.abc.sql_db.executor import Executor as AbstractExecutor


class Executor(AbstractExecutor):
    async def execute_raw_sql(
        self,
        conn,
        sql_query: str,
        params: list | tuple,
        fetch: bool
    ) -> list | str | None:
        if conn is None:
            raise ValueError("Соединение (conn) не может быть None для выполнения запроса.")

        if fetch:
            rows = await conn.fetch(sql_query, *params)
            return [dict(row) for row in rows]
        else:
            return await conn.execute(sql_query, *params) 
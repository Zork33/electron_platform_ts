from toolkit.tool.sql_db.tool import SqlDb
from toolkit.tool.sql_db.table_crud import TableCrud
from toolkit.tool.sql_db.query_executor import Query


class UserAuthConfirmCodeStorage(TableCrud):
    def __init__(self, db_client: SqlDb, table_name: str = "user_auth_confirm_code"):
        super().__init__(db_client, table_name)
        
    async def get_by_token(self, token: str, tx=None) -> dict | None:
        sql = f"SELECT * FROM {self.table_name} WHERE token = $1 AND deleted_at IS NULL"
        query = Query(sql, [token], fetch=True)
        result = await self.client.query_executor.execute_query(query, tx=tx)
        
        if len(result) > 1:
            raise ValueError(f"Найдено {len(result)} записей с token='{token}'. Ожидалось: 0 или 1")
        
        return result[0] if result else None

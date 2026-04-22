from toolkit.tool.sql_db.tool import SqlDb
from toolkit.tool.sql_db.table_crud import TableCrud


class UserStorage(TableCrud):
    def __init__(self, db_client: SqlDb, table_name: str = '"user"'):
        super().__init__(db_client, table_name)
    
    async def get_by_auth_email(self, auth_email: str, tx=None) -> dict | None:
        filters = [{"field": "auth_email", "value": auth_email, "operator": "="}]
        results = await self.list(filters=filters, page_count=1, page_number=1, tx=tx)
        return results[0] if results else None

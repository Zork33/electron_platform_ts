from toolkit.tool.abc.sql_db.tool import SqlDb as AbstractSqlDb
from toolkit.tool.sql_db.query_executor import Query


class TableCrud:
    def __init__(self, client: AbstractSqlDb, table_name: str):
        self.client = client
        self.table_name = table_name
    
    async def get(self, id: int, res_columns: list = None, tx=None) -> dict | None:
        if not id or id <= 0:
            raise ValueError(f"Для получения записи из {self.table_name} необходим валидный id (положительное число)")
            
        select_clause = "*"
        if isinstance(res_columns, list) and res_columns:
            select_clause = ", ".join(res_columns)
            
        sql = f"SELECT {select_clause} FROM {self.table_name} WHERE id = $1"
        query = Query(query=sql, params=[id], fetch=True)
        result = await self.client.query_executor.execute_query(query, tx)
        return result[0] if result else None
    
    async def get_batch(self, ids: list[int], res_columns: list = None, tx=None) -> list[dict]:
        if not ids:
            return []
        
        select_clause = "*"
        if isinstance(res_columns, list) and res_columns:
            select_clause = ", ".join(res_columns)
        
        placeholders = ", ".join([f"${i+1}" for i in range(len(ids))])
        sql = f"SELECT {select_clause} FROM {self.table_name} WHERE id IN ({placeholders})"
        query = Query(query=sql, params=ids, fetch=True)
        result = await self.client.query_executor.execute_query(query, tx)
        return result if result else []
    
    async def list(
            self,
            filters: list | None = None,
            include_deleted: bool = False,
            res_columns: list | str | None = None,
            orderby: dict | None = None,
            page_count: int | None = None,
            page_number: int | None = None,
            tx=None
            ) -> list[dict] | int:
        filters = filters or []
        
        select_clause = "*"
        is_count_query = False
        
        if isinstance(res_columns, list) and res_columns:
            select_clause = ", ".join(res_columns)
        elif isinstance(res_columns, str):
            select_clause = f"COUNT({res_columns})"
            is_count_query = True
        
        where_clauses = []
        params = []
        param_idx = 1
        
        if not include_deleted:
            where_clauses.append(f"deleted_at IS NULL")
        
        filter_parts = []
        
        for filter_item in filters:
            if isinstance(filter_item, str) and filter_item.upper() in ["AND", "OR"]:
                if filter_parts:
                    filter_parts.append(filter_item.upper())
            elif isinstance(filter_item, dict):
                field = filter_item.get("field")
                value = filter_item.get("value")
                operator = filter_item.get("operator", "=")
                is_null_predicate = operator in ("IS", "IS NOT") and value is None

                if field and (value is not None or is_null_predicate):
                    valid_operators = ["=", ">", "<", ">=", "<=", "<>", "!=", "LIKE", "ILIKE", "IN", "NOT IN", "IS", "IS NOT"]
                    if operator not in valid_operators:
                        raise ValueError(f"Недопустимый оператор '{operator}'. Допустимые операторы: {', '.join(valid_operators)}")
                    
                    if operator in ["IN", "NOT IN"] and isinstance(value, list):
                        placeholders = []
                        for item in value:
                            placeholders.append(f"${param_idx}")
                            params.append(item)
                            param_idx += 1
                        filter_parts.append(f"{field} {operator} ({', '.join(placeholders)})")
                    elif operator in ["IS", "IS NOT"]:
                        if value is None:
                            filter_parts.append(f"{field} {operator} NULL")
                        else:
                            filter_parts.append(f"{field} {operator} ${param_idx}")
                            params.append(value)
                            param_idx += 1
                    else:
                        filter_parts.append(f"{field} {operator} ${param_idx}")
                        params.append(value)
                        param_idx += 1
        
        if filter_parts:
            final_filter = []
            for i, part in enumerate(filter_parts):
                if i > 0 and part not in ["AND", "OR"] and filter_parts[i-1] not in ["AND", "OR"]:
                    final_filter.append("AND")
                final_filter.append(part)
            
            where_clauses.append(" ".join(final_filter))
        
        sql = f"SELECT {select_clause} FROM {self.table_name}"
        
        if where_clauses:
            where_clause = " AND ".join(where_clauses)
            sql += f" WHERE {where_clause}"
        
        if orderby is not None:
            order_fields = orderby.get("field", ["id"])
            if not isinstance(order_fields, list):
                order_fields = ["id"]
            
            order_direction = orderby.get("direction", "asc")
            if not isinstance(order_direction, str):
                order_direction = "asc"
            
            order_direction = order_direction.lower()
            if order_direction not in ["asc", "desc"]:
                order_direction = "asc"
            
            order_parts = [f"{field} {order_direction}" for field in order_fields]
            sql += f" ORDER BY {', '.join(order_parts)}"
        else:
            sql += " ORDER BY id ASC"
        
        if not is_count_query:
            if page_count != 0:
                if page_count is None:
                    page_count = 10
                elif not isinstance(page_count, int) or page_count < 0:
                    raise ValueError("Параметр page_count должен быть положительным целым числом или 0")

                if page_number is None:
                    page_number = 1
                elif not isinstance(page_number, int) or page_number <= 0:
                    raise ValueError("Параметр page_number должен быть положительным целым числом")

                offset = (page_number - 1) * page_count
                sql += f" LIMIT {page_count} OFFSET {offset}"
        
        query = Query(query=sql, params=params, fetch=True)
        result = await self.client.query_executor.execute_query(query, tx)
        
        if is_count_query and result:
            return result[0]['count']
        
        return result
        
    async def count(self, filters: list = None, include_deleted: bool = False, field_name: str = '*', tx=None) -> int:
        return await self.list(filters, include_deleted, field_name, tx=tx)
    
    async def create(self, data: dict, res_columns: list = None, tx=None) -> dict | None:
        returning_clause = "*"
        if isinstance(res_columns, list) and res_columns:
            returning_clause = ", ".join(res_columns)
        
        if not data:
            sql = f"INSERT INTO {self.table_name} DEFAULT VALUES RETURNING {returning_clause}"
            query = Query(query=sql, params=[], fetch=True)
        else:
            columns = ", ".join(data.keys())
            placeholders = ", ".join([f"${i+1}" for i in range(len(data))])
            values = list(data.values())
            sql = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders}) RETURNING {returning_clause}"
            query = Query(query=sql, params=values, fetch=True)
        
        result = await self.client.query_executor.execute_query(query, tx)
        return result[0] if result else None
    
    async def create_batch(self, data_list: list[dict], res_columns: list = None, tx=None) -> list[dict]:
        if not data_list:
            return []
        
        returning_clause = "*"
        if isinstance(res_columns, list) and res_columns:
            returning_clause = ", ".join(res_columns)
        
        first_item = data_list[0]
        columns = list(first_item.keys())
        columns_clause = ", ".join(columns)
        
        values_clauses = []
        params = []
        param_idx = 1
        
        for data in data_list:
            placeholders = []
            for col in columns:
                placeholders.append(f"${param_idx}")
                params.append(data.get(col))
                param_idx += 1
            values_clauses.append(f"({', '.join(placeholders)})")
        
        values_clause = ", ".join(values_clauses)
        sql = f"INSERT INTO {self.table_name} ({columns_clause}) VALUES {values_clause} RETURNING {returning_clause}"
        query = Query(query=sql, params=params, fetch=True)
        result = await self.client.query_executor.execute_query(query, tx)
        return result if result else []
    
    async def update(self, id: int, data: dict, res_columns: list = None, tx=None) -> dict | None:
        if not id or id <= 0:
            raise ValueError(f"Для обновления записи в {self.table_name} необходим валидный id (положительное число)")
            
        if not data:
            raise ValueError(f"Для обновления записи в {self.table_name} необходимо передать непустой словарь данных")
        
        set_clauses = []
        params = []
        param_idx = 1
        
        for key, value in data.items():
            set_clauses.append(f"{key} = ${param_idx}")
            params.append(value)
            param_idx += 1
        
        params.append(id)
        set_clause = ", ".join(set_clauses)
        
        returning_clause = "*"
        if isinstance(res_columns, list) and res_columns:
            returning_clause = ", ".join(res_columns)
        
        sql = f"UPDATE {self.table_name} SET {set_clause} WHERE id = ${param_idx} RETURNING {returning_clause}"
        query = Query(query=sql, params=params, fetch=True)
        result = await self.client.query_executor.execute_query(query, tx)
        
        return result[0] if result else None
    
    async def update_batch(self, updates: list[dict], res_columns: list = None, tx=None) -> list[dict]:
        if not updates:
            return []
        
        results = []
        for update_item in updates:
            if 'id' not in update_item:
                raise ValueError(f"Каждый элемент в update_batch должен содержать 'id'")
            
            id_value = update_item['id']
            data = {k: v for k, v in update_item.items() if k != 'id'}
            
            result = await self.update(id_value, data, res_columns, tx)
            if result:
                results.append(result)
        
        return results
    
    async def hard_delete(self, id: int, res_columns: list = None, tx=None) -> dict | None:
        if not id or id <= 0:
            raise ValueError(f"Для удаления записи из {self.table_name} необходим валидный id (положительное число)")
            
        returning_clause = "*"
        if isinstance(res_columns, list) and res_columns:
            returning_clause = ", ".join(res_columns)
            
        sql = f"DELETE FROM {self.table_name} WHERE id = $1 RETURNING {returning_clause}"
        query = Query(query=sql, params=[id], fetch=True)
        result = await self.client.query_executor.execute_query(query, tx)
        return result[0] if result else None
    
    async def hard_delete_batch(self, ids: list[int], res_columns: list = None, tx=None) -> list[dict]:
        if not ids:
            return []
        
        returning_clause = "*"
        if isinstance(res_columns, list) and res_columns:
            returning_clause = ", ".join(res_columns)
        
        placeholders = ", ".join([f"${i+1}" for i in range(len(ids))])
        sql = f"DELETE FROM {self.table_name} WHERE id IN ({placeholders}) RETURNING {returning_clause}"
        query = Query(query=sql, params=ids, fetch=True)
        result = await self.client.query_executor.execute_query(query, tx)
        return result if result else []

    async def get_id_by_code(self, code: str, tx=None) -> int | None:
        sql = f"SELECT id FROM {self.table_name} WHERE deleted_at IS NULL AND lower(code) = lower($1) LIMIT 1"
        query = Query(query=sql, params=[code], fetch=True)
        result = await self.client.query_executor.execute_query(query, tx)
        return result[0]["id"] if result else None

    async def delete(self, id: int, tx=None) -> dict | None:
        if not id or id <= 0:
            raise ValueError(f"Для удаления записи из {self.table_name} необходим валидный id (положительное число)")
        sql = f"UPDATE {self.table_name} SET deleted_at = now() WHERE id = $1 RETURNING *"
        query = Query(query=sql, params=[id], fetch=True)
        result = await self.client.query_executor.execute_query(query, tx)
        return result[0] if result else None

    async def restore(self, id: int, res_columns: list = None, tx=None) -> dict | None:
        if not id or id <= 0:
            raise ValueError(f"Для восстановления записи в {self.table_name} необходим валидный id (положительное число)")
        returning_clause = "*"
        if isinstance(res_columns, list) and res_columns:
            returning_clause = ", ".join(res_columns)
        sql = (
            f"UPDATE {self.table_name} SET deleted_at = NULL "
            f"WHERE id = $1 AND deleted_at IS NOT NULL RETURNING {returning_clause}"
        )
        query = Query(query=sql, params=[id], fetch=True)
        result = await self.client.query_executor.execute_query(query, tx)
        return result[0] if result else None
    
    async def delete_batch(self, ids: list[int], tx=None) -> list[dict]:
        if not ids:
            return []
        
        placeholders = ", ".join([f"${i+1}" for i in range(len(ids))])
        sql = f"UPDATE {self.table_name} SET deleted_at = now() WHERE id IN ({placeholders}) RETURNING *"
        query = Query(query=sql, params=ids, fetch=True)
        result = await self.client.query_executor.execute_query(query, tx)
        return result if result else []


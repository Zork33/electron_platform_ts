from toolkit.tool.sql_db.tool import SqlDb
from toolkit.tool.sql_db.query_executor import Query

_COLUMNS_SQL = """ 
SELECT
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    col_description(pgc.oid, c.ordinal_position) AS col_comment
FROM information_schema.columns c
JOIN pg_catalog.pg_class pgc ON pgc.relname = c.table_name AND pgc.relkind = 'r'
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position
"""

_FK_SQL = """
SELECT
    kcu.table_name,
    kcu.column_name,
    ccu.table_name AS ref_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
"""


async def get_schema() -> str:
    db: SqlDb = SqlDb.get_from_container("db")

    col_rows = await db.query_executor.execute_query(
        Query(query=_COLUMNS_SQL, params=[], fetch=True)
    )
    fk_rows = await db.query_executor.execute_query(
        Query(query=_FK_SQL, params=[], fetch=True)
    )

    fk_map: dict[tuple[str, str], str] = {
        (r["table_name"], r["column_name"]): r["ref_table"]
        for r in (fk_rows or [])
    }

    tables: dict[str, list[str]] = {}
    for row in col_rows or []:
        table = row["table_name"]
        col = row["column_name"]
        dtype = _short_type(row["data_type"])
        nullable = row["is_nullable"] == "YES"
        comment = row.get("col_comment") or ""
        ref = fk_map.get((table, col))

        parts = [f"{col}:{dtype}"]
        if nullable:
            parts[0] += "?"
        if ref:
            parts.append(f"FK→{ref}")
        if comment:
            parts.append(comment)

        tables.setdefault(table, []).append(" ".join(parts))

    lines = ["DATABASE SCHEMA (PostgreSQL, schema=public)\n"]
    for table_name in sorted(tables):
        lines.append(f"TABLE {table_name}:")
        for col_str in tables[table_name]:
            lines.append(f"  {col_str}")
        lines.append("")

    return "\n".join(lines)


def _short_type(pg_type: str) -> str:
    mapping = {
        "character varying": "varchar",
        "timestamp with time zone": "timestamptz",
        "timestamp without time zone": "timestamp",
        "double precision": "float8",
        "boolean": "bool",
        "integer": "int",
        "bigint": "int8",
        "smallint": "int2",
        "text": "text",
        "jsonb": "jsonb",
        "json": "json",
        "date": "date",
        "numeric": "numeric",
        "uuid": "uuid",
    }
    return mapping.get(pg_type, pg_type)

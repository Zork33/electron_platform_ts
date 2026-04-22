from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import cached_property
from pathlib import Path
from typing import TYPE_CHECKING

from data_framework.file_descriptor.descriptor import FileDescriptor
from toolkit.tool.file_manager.tool import FileManager
from toolkit.tool.sql_db.tool import SqlDb
from toolkit.tool.sql_db.query_executor import Query

if TYPE_CHECKING:
    from data_framework.crud_element import CrudElement


class FileCollection:
    def __init__(self, descriptor: FileDescriptor, owner: CrudElement):
        if not descriptor.is_collection:
            raise ValueError(
                f"FileDescriptor '{descriptor.attr_name}' должен иметь тип COLLECTION"
            )
        self._descriptor = descriptor
        self._owner = owner

    # ─── Lazy deps ────────────────────────────────────────────────────────────

    @cached_property
    def _file_manager(self) -> FileManager:
        return FileManager.get_from_container("file_manager")

    @cached_property
    def _db_client(self) -> SqlDb:
        return SqlDb.get_from_container("db")

    # ─── Helpers ──────────────────────────────────────────────────────────────

    @asynccontextmanager
    async def _transaction(self, tx=None):
        if tx is not None:
            yield tx
        else:
            async with self._db_client.transaction_manager.transaction() as new_tx:
                yield new_tx

    def _collection_id(self) -> int | None:
        return getattr(self._owner, self._descriptor.fk_column, None)

    def _build_path(self, ext: str) -> str:
        base = self._descriptor.storage_path_template.replace(
            "{id}", str(self._owner.id)
        )
        unique = uuid.uuid4().hex
        return f"{base}/{unique}.{ext}"

    # ─── Ленивая инициализация коллекции ─────────────────────────────────────

    async def _ensure_collection(self, tx) -> int:
        collection_id = self._collection_id()
        if collection_id is not None:
            return collection_id

        create_query = Query(
            query="INSERT INTO file_collection DEFAULT VALUES RETURNING id",
            params=[],
            fetch=True,
        )
        rows = await self._db_client.query_executor.execute_query(create_query, tx=tx)
        collection_id = rows[0]["id"]

        table_name = self._owner._storage_settings.table_name
        fk_col = self._descriptor.fk_column
        update_query = Query(
            query=f"UPDATE {table_name} SET {fk_col} = $1 WHERE id = $2",
            params=[collection_id, self._owner.id],
            fetch=False,
        )
        await self._db_client.query_executor.execute_query(update_query, tx=tx)

        setattr(self._owner, fk_col, collection_id)
        return collection_id

    # ─── Загрузка ─────────────────────────────────────────────────────────────

    async def upload(self, file, **kwargs) -> dict:
        filename_str = getattr(file, "filename", None) or ""
        ext = Path(filename_str).suffix.lower().lstrip(".")

        if not ext:
            raise ValueError("Не удалось определить расширение файла")

        allowed = self._descriptor.allowed_extensions
        if allowed is not None and ext not in allowed:
            raise ValueError(
                f"Недопустимое расширение: .{ext}. "
                f"Разрешено: {', '.join(sorted(allowed))}"
            )

        path = self._build_path(ext)
        filename = Path(filename_str).stem or Path(path).stem

        async with self._transaction() as tx:
            collection_id = await self._ensure_collection(tx)

            metadata = await self._file_manager.upload(
                file=file,
                storage_part=self._descriptor.storage_part,
                path=path,
                filename=filename,
                ext=ext,
                tx=tx,
            )

            next_order_query = Query(
                query="""
                    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
                    FROM file_collection_item
                    WHERE file_collection_id = $1 AND deleted_at IS NULL
                """,
                params=[collection_id],
                fetch=True,
            )
            order_rows = await self._db_client.query_executor.execute_query(
                next_order_query, tx=tx
            )
            next_order = order_rows[0]["next_order"] if order_rows else 0

            insert_query = Query(
                query="""
                    INSERT INTO file_collection_item
                        (file_collection_id, stored_file_id, sort_order)
                    VALUES ($1, $2, $3)
                """,
                params=[collection_id, metadata["id"], next_order],
                fetch=False,
            )
            await self._db_client.query_executor.execute_query(insert_query, tx=tx)

        return metadata

    # ─── Чтение ───────────────────────────────────────────────────────────────

    async def get_items(self) -> list[dict]:
        collection_id = self._collection_id()
        if not collection_id:
            return []

        query = Query(
            query="""
                SELECT stored_file_id
                FROM file_collection_item
                WHERE file_collection_id = $1 AND deleted_at IS NULL
                ORDER BY sort_order ASC, id ASC
            """,
            params=[collection_id],
            fetch=True,
        )
        rows = await self._db_client.query_executor.execute_query(query)
        if not rows:
            return []
        file_ids = [row["stored_file_id"] for row in rows]
        return await self._file_manager.get_batch(file_ids)

    async def get_item(self, stored_file_id: int) -> dict | None:
        collection_id = self._collection_id()
        if not collection_id:
            return None

        query = Query(
            query="""
                SELECT stored_file_id
                FROM file_collection_item
                WHERE file_collection_id = $1
                  AND stored_file_id = $2
                  AND deleted_at IS NULL
            """,
            params=[collection_id, stored_file_id],
            fetch=True,
        )
        rows = await self._db_client.query_executor.execute_query(query)
        if not rows:
            return None
        return await self._file_manager.get(stored_file_id)

    async def get_collection_info(self) -> dict:
        collection_id = self._collection_id()
        if not collection_id:
            return {"count": 0, "total_size_bytes": 0, "formats": {}}

        query = Query(
            query="""
                SELECT sf.ext, sf.size_bytes
                FROM file_collection_item fci
                JOIN stored_file sf ON sf.id = fci.stored_file_id
                WHERE fci.file_collection_id = $1 AND fci.deleted_at IS NULL
            """,
            params=[collection_id],
            fetch=True,
        )
        rows = await self._db_client.query_executor.execute_query(query)
        if not rows:
            return {"count": 0, "total_size_bytes": 0, "formats": {}}

        count = len(rows)
        total_size = sum(r["size_bytes"] or 0 for r in rows)
        formats: dict[str, int] = {}
        for r in rows:
            ext = r["ext"] or "unknown"
            formats[ext] = formats.get(ext, 0) + 1

        return {"count": count, "total_size_bytes": total_size, "formats": formats}

    # ─── Модификация ──────────────────────────────────────────────────────────

    async def remove(self, stored_file_id: int) -> None:
        collection_id = self._collection_id()
        if not collection_id:
            return

        async with self._transaction() as tx:
            soft_delete_query = Query(
                query="""
                    UPDATE file_collection_item
                    SET deleted_at = $3
                    WHERE file_collection_id = $1
                      AND stored_file_id = $2
                      AND deleted_at IS NULL
                """,
                params=[collection_id, stored_file_id, datetime.now(timezone.utc)],
                fetch=False,
            )
            await self._db_client.query_executor.execute_query(soft_delete_query, tx=tx)
            await self._file_manager.delete(stored_file_id, tx=tx)

    async def restore(self, stored_file_id: int) -> None:
        collection_id = self._collection_id()
        if not collection_id:
            return

        async with self._transaction() as tx:
            restore_query = Query(
                query="""
                    UPDATE file_collection_item
                    SET deleted_at = NULL
                    WHERE file_collection_id = $1
                      AND stored_file_id = $2
                      AND deleted_at IS NOT NULL
                """,
                params=[collection_id, stored_file_id],
                fetch=False,
            )
            await self._db_client.query_executor.execute_query(restore_query, tx=tx)
            await self._file_manager.restore(stored_file_id, tx=tx)

    async def hard_delete(self, stored_file_id: int) -> None:
        collection_id = self._collection_id()
        if not collection_id:
            return

        async with self._transaction() as tx:
            delete_item_query = Query(
                query="""
                    DELETE FROM file_collection_item
                    WHERE file_collection_id = $1 AND stored_file_id = $2
                """,
                params=[collection_id, stored_file_id],
                fetch=False,
            )
            await self._db_client.query_executor.execute_query(delete_item_query, tx=tx)
            await self._file_manager.hard_delete(stored_file_id, tx=tx)

    async def rename(self, stored_file_id: int, new_filename: str) -> dict:
        item = await self.get_item(stored_file_id)
        if item is None:
            raise ValueError(
                f"Файл {stored_file_id} не найден в коллекции"
            )

        query = Query(
            query="""
                UPDATE stored_file
                SET filename = $1
                WHERE id = $2
                RETURNING *
            """,
            params=[new_filename, stored_file_id],
            fetch=True,
        )
        rows = await self._db_client.query_executor.execute_query(query)
        return rows[0] if rows else item

    async def reorder(self, ordered_ids: list[int]) -> None:
        collection_id = self._collection_id()
        if not collection_id:
            return

        async with self._transaction() as tx:
            for order, file_id in enumerate(ordered_ids):
                query = Query(
                    query="""
                        UPDATE file_collection_item
                        SET sort_order = $1
                        WHERE file_collection_id = $2
                          AND stored_file_id = $3
                          AND deleted_at IS NULL
                    """,
                    params=[order, collection_id, file_id],
                    fetch=False,
                )
                await self._db_client.query_executor.execute_query(query, tx=tx)

import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from toolkit.abc.tool import Tool
from toolkit.tool.abc.file_storage.tool import FileStorage as AbstractFileStorage
from toolkit.tool.abc.sql_db.tool import SqlDb as AbstractSqlDb
from toolkit.tool.file_manager.config import FileManagerConfig
from toolkit.tool.sql_db.table_crud import TableCrud
from toolkit.tool.sql_db.query_executor import Query
from toolkit.adapter.abc.file_storage.models import FilePath, UploadParams, StoragePart

from storage_schemas.file_storage.main.parts.trash import TRASH


class FileManager(Tool):
    _code = "file_manager"
    _title = "File manager"

    def __init__(
        self,
        file_storage: AbstractFileStorage,
        db_client: AbstractSqlDb,
        config: FileManagerConfig,
    ):
        if file_storage is None:
            raise ValueError("file_storage cannot be None")
        if db_client is None:
            raise ValueError("db_client cannot be None")

        self._file_storage = file_storage
        self._db_client = db_client
        self._metadata_crud = TableCrud(db_client, config.metadata_table)

    @property
    def file_storage(self) -> AbstractFileStorage:
        return self._file_storage

    @property
    def metadata_crud(self) -> TableCrud:
        return self._metadata_crud

    @asynccontextmanager
    async def _ensure_transaction(self, tx=None):
        if tx is not None:
            yield tx
        else:
            async with self._db_client.transaction_manager.transaction() as new_tx:
                yield new_tx

    async def upload(
        self,
        file,
        storage_part: StoragePart,
        path: str,
        filename: str,
        ext: str,
        content_type: str | None = None,
        with_replace: bool = False,
        tx=None
    ) -> dict:
        async with self._ensure_transaction(tx) as transaction:
            if isinstance(file, bytes):
                file_content = file
            else:
                file_content = await file.read()
                if content_type is None:
                    content_type = getattr(file, 'content_type', None)

            ext_clean = ext.strip().lower().lstrip('.') if ext else None
            if not ext_clean:
                raise ValueError("Extension (ext) is required")

            file_size = len(file_content)

            storage_part_id = await self.get_storage_part_id_by_name(storage_part, transaction)
            if storage_part_id is None:
                raise ValueError(f"Storage part '{storage_part.name}' not found")

            file_path = FilePath(storage_part_name=storage_part.name, path=path)

            if with_replace:
                existing = await self._get_metadata_by_part_and_path(
                    storage_part_id, path, transaction
                )
                if existing:
                    updated = await self._metadata_crud.update(
                        existing['id'],
                        {'filename': filename, 'ext': ext_clean, 'size_bytes': file_size},
                        tx=transaction
                    )
                    upload_params = UploadParams(
                        file_path=file_path,
                        data=file_content,
                        content_type=content_type
                    )
                    await self._file_storage.filer.upload(upload_params)
                    return updated
            else:
                if await self._file_storage.filer.is_exists(file_path):
                    raise ValueError(f"File already exists at path: {path}")

            metadata = await self._metadata_crud.create({
                'file_storage_part_id': storage_part_id,
                'path': path,
                'filename': filename,
                'ext': ext_clean,
                'size_bytes': file_size
            }, tx=transaction)

            try:
                upload_params = UploadParams(
                    file_path=file_path,
                    data=file_content,
                    content_type=content_type
                )
                await self._file_storage.filer.upload(upload_params)
                return metadata
            except Exception as e:
                raise Exception(f"Failed to upload file to storage: {str(e)}") from e

    async def delete(
        self,
        stored_file_id: int,
        tx=None
    ) -> dict | None:
        async with self._ensure_transaction(tx) as transaction:
            metadata = await self._metadata_crud.get(stored_file_id, tx=transaction)
            if not metadata:
                return None

            storage_part_name = await self._get_storage_part_name_by_id(
                metadata['file_storage_part_id'], transaction
            )
            source_path = FilePath(storage_part_name=storage_part_name, path=metadata['path'])

            trash_part_id = await self.get_storage_part_id_by_name(TRASH, transaction)
            if trash_part_id is None:
                raise ValueError("Storage part 'trash' not found")

            trash_path = f"{metadata['id']}/{storage_part_name}/{metadata['path']}"

            try:
                file_content = await self._file_storage.filer.download(source_path)
            except Exception:
                file_content = None

            if file_content is not None:
                trash_file_path = FilePath(storage_part_name=TRASH.name, path=trash_path)
                upload_params = UploadParams(
                    file_path=trash_file_path,
                    data=file_content,
                    content_type=None
                )
                await self._file_storage.filer.upload(upload_params)
                await self._file_storage.filer.delete(source_path)

            deleted_metadata = await self._metadata_crud.update(
                stored_file_id,
                {
                    'file_storage_part_id': trash_part_id,
                    'path': trash_path,
                    'deleted_at': datetime.now(timezone.utc)
                },
                tx=transaction
            )
            return deleted_metadata

    async def restore(
        self,
        stored_file_id: int,
        tx=None
    ) -> dict | None:
        async with self._ensure_transaction(tx) as transaction:
            metadata = await self._metadata_crud.get(stored_file_id, tx=transaction)
            if not metadata or metadata.get('deleted_at') is None:
                return None

            trash_path = metadata['path']
            parts = trash_path.split('/', 2)
            if len(parts) < 3:
                return None

            original_part_name = parts[1]
            original_path = parts[2]

            trash_file_path = FilePath(storage_part_name=TRASH.name, path=trash_path)
            try:
                file_content = await self._file_storage.filer.download(trash_file_path)
            except Exception:
                return None

            original_part_id = await self.get_storage_part_id_by_name(
                StoragePart(name=original_part_name), transaction
            )
            if original_part_id is None:
                return None

            target_path = FilePath(storage_part_name=original_part_name, path=original_path)
            if await self._file_storage.filer.is_exists(target_path):
                base, ext = os.path.splitext(original_path)
                restored_path = f"{base}_restored_{metadata['id']}{ext}"
                original_path = restored_path
                target_path = FilePath(storage_part_name=original_part_name, path=restored_path)

            upload_params = UploadParams(
                file_path=target_path,
                data=file_content,
                content_type=None
            )
            await self._file_storage.filer.upload(upload_params)
            await self._file_storage.filer.delete(trash_file_path)

            restored_metadata = await self._metadata_crud.update(
                stored_file_id,
                {
                    'file_storage_part_id': original_part_id,
                    'path': original_path,
                    'deleted_at': None
                },
                tx=transaction
            )
            return restored_metadata

    async def hard_delete(
        self,
        stored_file_id: int,
        tx=None
    ) -> dict | None:
        async with self._ensure_transaction(tx) as transaction:
            metadata = await self._metadata_crud.get(stored_file_id, tx=transaction)
            if not metadata:
                return None

            deleted_metadata = await self._metadata_crud.hard_delete(stored_file_id, tx=transaction)

            try:
                storage_part_name = await self._get_storage_part_name_by_id(
                    metadata['file_storage_part_id'], transaction
                )
                file_path = FilePath(storage_part_name=storage_part_name, path=metadata['path'])
                await self._file_storage.filer.delete(file_path)
            except Exception:
                pass

            return deleted_metadata

    async def get(
        self,
        stored_file_id: int,
        tx=None
    ) -> dict | None:
        return await self._metadata_crud.get(stored_file_id, tx=tx)

    async def get_batch(
        self,
        stored_file_ids: list[int],
        tx=None
    ) -> list[dict]:
        return await self._metadata_crud.get_batch(stored_file_ids, tx=tx)

    async def exists(
        self,
        stored_file_id: int,
        tx=None
    ) -> bool:
        metadata = await self._metadata_crud.get(stored_file_id, tx=tx)
        if not metadata:
            return False

        try:
            storage_part_name = await self._get_storage_part_name_by_id(
                metadata['file_storage_part_id'], tx
            )
            file_path = FilePath(storage_part_name=storage_part_name, path=metadata['path'])
            return await self._file_storage.filer.is_exists(file_path)
        except Exception:
            return False

    async def exists_in_storage(
        self,
        storage_part: StoragePart,
        path: str
    ) -> bool:
        try:
            file_path = FilePath(storage_part_name=storage_part.name, path=path)
            return await self._file_storage.filer.is_exists(file_path)
        except Exception:
            return False

    async def download(
        self,
        stored_file_id: int,
        tx=None
    ) -> bytes | None:
        metadata = await self._metadata_crud.get(stored_file_id, tx=tx)
        if not metadata:
            return None

        try:
            storage_part_name = await self._get_storage_part_name_by_id(
                metadata['file_storage_part_id'], tx
            )
            file_path = FilePath(storage_part_name=storage_part_name, path=metadata['path'])
            return await self._file_storage.filer.download(file_path)
        except Exception:
            return None

    async def get_url(
        self,
        stored_file_id: int,
        expiration_seconds: int | None = None,
        tx=None
    ) -> str | None:
        metadata = await self._metadata_crud.get(stored_file_id, tx=tx)
        if not metadata:
            return None

        try:
            storage_part_name = await self._get_storage_part_name_by_id(
                metadata['file_storage_part_id'], tx
            )
            file_path = FilePath(storage_part_name=storage_part_name, path=metadata['path'])
            return await self._file_storage.filer.get_presigned_url(
                file_path,
                expiration_seconds or 3600
            )
        except Exception:
            return None

    async def replace(
        self,
        stored_file_id: int,
        file,
        content_type: str | None = None,
        tx=None
    ) -> dict | None:
        async with self._ensure_transaction(tx) as transaction:
            old_metadata = await self._metadata_crud.get(stored_file_id, tx=transaction)
            if not old_metadata:
                return None

            if isinstance(file, bytes):
                file_content = file
            else:
                file_content = await file.read()
                if content_type is None:
                    content_type = getattr(file, 'content_type', None)

            file_size = len(file_content)

            updated_metadata = await self._metadata_crud.update(
                stored_file_id,
                {'size_bytes': file_size},
                tx=transaction
            )

            storage_part_name = await self._get_storage_part_name_by_id(
                old_metadata['file_storage_part_id'], transaction
            )
            file_path = FilePath(storage_part_name=storage_part_name, path=old_metadata['path'])
            upload_params = UploadParams(
                file_path=file_path,
                data=file_content,
                content_type=content_type
            )
            await self._file_storage.filer.upload(upload_params)

            return updated_metadata

    async def delete_batch(
        self,
        stored_file_ids: list[int],
        tx=None
    ) -> list[dict]:
        async with self._ensure_transaction(tx) as transaction:
            results = []
            for file_id in stored_file_ids:
                result = await self.delete(file_id, tx=transaction)
                if result:
                    results.append(result)
            return results

    async def hard_delete_batch(
        self,
        stored_file_ids: list[int],
        tx=None
    ) -> list[dict]:
        async with self._ensure_transaction(tx) as transaction:
            results = []
            for file_id in stored_file_ids:
                result = await self.hard_delete(file_id, tx=transaction)
                if result:
                    results.append(result)
            return results

    async def get_storage_part_id_by_name(
        self,
        storage_part: StoragePart,
        tx=None
    ) -> int | None:
        query = Query(
            query="""
                SELECT id FROM file_storage_part
                WHERE LOWER(name) = LOWER($1)
                  AND deleted_at IS NULL
                LIMIT 1
            """,
            params=[storage_part.name],
            fetch=True
        )
        result = await self._db_client.query_executor.execute_query(query, tx)
        return result[0]['id'] if result else None

    async def _get_storage_part_name_by_id(
        self,
        storage_part_id: int,
        tx=None
    ) -> str | None:
        query = Query(
            query="SELECT name FROM file_storage_part WHERE id = $1 AND deleted_at IS NULL",
            params=[storage_part_id],
            fetch=True
        )
        result = await self._db_client.query_executor.execute_query(query, tx)
        return result[0]['name'] if result else None

    async def _get_metadata_by_part_and_path(
        self,
        storage_part_id: int,
        path: str,
        tx=None
    ) -> dict | None:
        filters = [
            {"field": "file_storage_part_id", "value": storage_part_id},
            {"field": "path", "value": path}
        ]
        result = await self._metadata_crud.list(
            filters=filters,
            page_count=1,
            page_number=1,
            tx=tx
        )
        return result[0] if result else None

    async def health_check(self) -> bool:
        try:
            fs_healthy = await self._file_storage.health_check()
            db_healthy = await self._db_client.health_check()
            return fs_healthy and db_healthy
        except Exception:
            return False

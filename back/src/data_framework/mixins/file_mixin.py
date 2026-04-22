from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from data_framework.file_descriptor.descriptor import FileDescriptor
from toolkit.tool.file_manager.tool import FileManager
from toolkit.tool.sql_db.query_executor import Query

from data_framework.mixins.crud_mixin import CrudMixin

if TYPE_CHECKING:
    from data_framework.crud_element import CrudElement


@dataclass
class FileMixinSettings:
    pass


class FileMixin(CrudMixin):
    _file_manager: FileManager = None

    @classmethod
    def _init_for_class(cls, target_cls: type[CrudElement]):
        file_fields = []
        for attr_name in dir(target_cls):
            attr = getattr(target_cls, attr_name, None)
            if isinstance(attr, FileDescriptor):
                file_fields.append(attr)
        target_cls._file_fields = file_fields

    @classmethod
    def _get_file_manager(cls) -> FileManager:
        if cls._file_manager is None:
            cls._file_manager = FileManager.get_from_container("file_manager")
        return cls._file_manager

    @classmethod
    async def _load_collection(cls, target_cls: type[CrudElement], descriptor: FileDescriptor, instance: CrudElement):
        collection_id = getattr(instance, descriptor.fk_column, None)
        if not collection_id:
            return []
        db_client = target_cls._get_db_client()
        query = Query(
            query='''
                SELECT stored_file_id
                FROM file_collection_item
                WHERE file_collection_id = $1 AND deleted_at IS NULL
                ORDER BY sort_order ASC, id ASC
            ''',
            params=[collection_id],
            fetch=True,
        )
        rows = await db_client.query_executor.execute_query(query)
        if not rows:
            return []
        file_ids = [row['stored_file_id'] for row in rows]
        file_manager = cls._get_file_manager()
        return await file_manager.get_batch(file_ids)

    @classmethod
    async def on_after_get(cls, target_cls: type[CrudElement], instance: CrudElement):
        file_fields: list[FileDescriptor] = getattr(target_cls, '_file_fields', [])
        file_manager = cls._get_file_manager()

        for descriptor in file_fields:
            if not descriptor.include_in_get:
                continue

            bound_attr = f"_bound_{descriptor.attr_name}"

            if descriptor.is_file:
                fk_value = getattr(instance, descriptor.fk_column, None)
                if fk_value is not None:
                    file_data = await file_manager.get(fk_value)
                    setattr(instance, bound_attr, file_data)
                else:
                    setattr(instance, bound_attr, None)

            elif descriptor.is_collection:
                files = await cls._load_collection(target_cls, descriptor, instance)
                setattr(instance, bound_attr, files)

    @classmethod
    async def _delete_files(cls, target_cls: type[CrudElement], instance: CrudElement, tx, hard: bool):
        file_fields: list[FileDescriptor] = getattr(target_cls, '_file_fields', [])
        file_manager = cls._get_file_manager()
        flag = 'delete_on_hard_delete' if hard else 'delete_on_delete'
        delete_method = file_manager.hard_delete if hard else file_manager.delete
        delete_batch_method = file_manager.hard_delete_batch if hard else file_manager.delete_batch

        for descriptor in file_fields:
            if not getattr(descriptor, flag):
                continue

            if descriptor.is_file:
                fk_value = getattr(instance, descriptor.fk_column, None)
                if fk_value is not None:
                    await delete_method(fk_value, tx=tx)

            elif descriptor.is_collection:
                collection_id = getattr(instance, descriptor.fk_column, None)
                if not collection_id:
                    continue
                db_client = target_cls._get_db_client()
                query = Query(
                    query='''
                        SELECT stored_file_id
                        FROM file_collection_item
                        WHERE file_collection_id = $1 AND deleted_at IS NULL
                    ''',
                    params=[collection_id],
                    fetch=True,
                )
                rows = await db_client.query_executor.execute_query(query, tx=tx)
                if rows:
                    file_ids = [row['stored_file_id'] for row in rows]
                    await delete_batch_method(file_ids, tx=tx)

                if hard:
                    delete_collection_query = Query(
                        query='DELETE FROM file_collection WHERE id = $1',
                        params=[collection_id],
                        fetch=False,
                    )
                    await db_client.query_executor.execute_query(delete_collection_query, tx=tx)

    @classmethod
    async def on_after_delete(cls, target_cls: type[CrudElement], instance: CrudElement, tx):
        await cls._delete_files(target_cls, instance, tx, hard=False)

    @classmethod
    async def on_after_hard_delete(cls, target_cls: type[CrudElement], instance: CrudElement, tx):
        await cls._delete_files(target_cls, instance, tx, hard=True)

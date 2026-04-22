from abc import ABC
from contextlib import asynccontextmanager
from datetime import date, datetime
from types import NoneType, UnionType
from typing import get_args, get_origin, Union

from data_framework.mixins.catalog_mixin import CatalogMixinSettings
from data_framework.mixins.container_mixin import ContainerMixinSettings
from data_framework.mixins.file_mixin import FileMixinSettings
from data_framework.mixins.crud_mixin import CrudMixin
from data_framework.storage_settings import StorageSettings
from toolkit.tool.sql_db.tool import SqlDb
from toolkit.tool.sql_db.table_crud import TableCrud


class CrudElement(ABC):
    _INIT_TOKEN = object()

    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    _storage_settings: StorageSettings
    _storage = None
    _db_client = None

    _active_mixins: list[CrudMixin] = []
    _container_mixin_settings: ContainerMixinSettings | None = None
    _catalog_mixin_settings: CatalogMixinSettings | None = None
    _file_mixin_settings: FileMixinSettings | None = None


    def __init__(self, _token=None):
        if _token is not CrudElement._INIT_TOKEN:
            raise TypeError(
                f"Direct instantiation of {self.__class__.__name__} is forbidden."
                f"Use {self.__class__.__name__}.create() / get() instead."
            )

    def __init_subclass__(cls, **kwargs) -> None:
        super().__init_subclass__(**kwargs)

        is_abstract = ABC in cls.__bases__ or getattr(cls, '__abstractmethods__', None)

        if not is_abstract:
            if not hasattr(cls, '_storage_settings') or cls._storage_settings is None:
                raise TypeError(f"{cls.__name__} must define _storage_settings")

            active = []
            if getattr(cls, '_container_mixin_settings', None) is not None:
                from data_framework.mixins.container_mixin import ContainerMixin
                active.append(ContainerMixin)
            if getattr(cls, '_catalog_mixin_settings', None) is not None:
                from data_framework.mixins.catalog_mixin import CatalogMixin
                CatalogMixin._init_for_class(cls)
                active.append(CatalogMixin)
            if getattr(cls, '_file_mixin_settings', None) is not None:
                from data_framework.mixins.file_mixin import FileMixin
                FileMixin._init_for_class(cls)
                active.append(FileMixin)
            for mixin_cls in active:
                if not issubclass(mixin_cls, CrudMixin):
                    raise TypeError(
                        f"{mixin_cls.__name__} must inherit from LogicMixin"
                    )
            cls._active_mixins = active
        else:
            cls._active_mixins = []

    @classmethod
    def _get_db_client(cls) -> SqlDb:
        if cls._db_client is None:
            cls._db_client = SqlDb.get_from_container("db")
        return cls._db_client

    @classmethod
    def _get_storage(cls):
        if cls._storage is None:
            client = cls._get_db_client()
            settings = cls._storage_settings
            if settings.storage_class is not None:
                cls._storage = settings.storage_class(client)
            else:
                cls._storage = TableCrud(client, settings.table_name)
        return cls._storage

    @classmethod
    @asynccontextmanager
    async def _ensure_transaction(cls, tx, db_client: SqlDb):
        if tx:
            yield tx
        else:
            async with db_client.transaction_manager.transaction() as new_tx:
                yield new_tx

    @classmethod
    def _validate_required_fields(cls, data: dict):
        missing = [f for f in cls._storage_settings.required_fields if f not in data or data[f] is None]
        if missing:
            raise ValueError(
                f"{cls.__name__}: missing required fields from database: {', '.join(missing)}"
            )

    @classmethod
    def _create_instance(cls):
        return cls(_token=CrudElement._INIT_TOKEN)

    @staticmethod
    def _resolve_type(field_type):
        origin = get_origin(field_type)
        if origin is Union or isinstance(field_type, UnionType):
            non_none = [a for a in get_args(field_type) if a is not NoneType]
            if non_none:
                return non_none[0]
        return field_type

    @staticmethod
    def _coerce_value(value, field_type):
        if value is None:
            return value
        resolved = CrudElement._resolve_type(field_type)
        if resolved is date and isinstance(value, str):
            return date.fromisoformat(value)
        if resolved is datetime and isinstance(value, str):
            return datetime.fromisoformat(value)
        return value

    def _populate_from_data(self, data: dict):
        annotations = {}
        for parent in self.__class__.__mro__:
            annotations.update(getattr(parent, "__annotations__", {}))
        for field_name, field_type in annotations.items():
            if not field_name.startswith("_") and field_name in data:
                setattr(self, field_name, self._coerce_value(data[field_name], field_type))

    @classmethod
    def _coerce_data(cls, data: dict) -> dict:
        annotations = {}
        for parent in cls.__mro__:
            annotations.update(getattr(parent, "__annotations__", {}))
        result = {}
        for key, value in data.items():
            if key in annotations:
                result[key] = CrudElement._coerce_value(value, annotations[key])
            else:
                result[key] = value
        return result

    @classmethod
    async def create(cls, data: dict, tx=None):
        data = cls._coerce_data(data)
        for mixin in cls._active_mixins:
            data = await mixin.on_before_create(cls, data)
        instance = None
        async with cls._ensure_transaction(tx, cls._get_db_client()) as active_tx:
            storage = cls._get_storage()
            result = await storage.create(data, tx=active_tx)
            if result:
                cls._validate_required_fields(result)
                instance = cls._create_instance()
                instance._populate_from_data(result)
                for mixin in cls._active_mixins:
                    await mixin.on_after_create(cls, instance, active_tx)
        if instance:
            for mixin in cls._active_mixins:
                await mixin.on_post_commit_create(cls, instance)
        return instance

    @classmethod
    async def create_batch(cls, data_list: list[dict], tx=None):
        data_list = [cls._coerce_data(d) for d in data_list]
        storage = cls._get_storage()
        results = await storage.create_batch(data_list, tx=tx)
        instances = []
        for result in results:
            cls._validate_required_fields(result)
            instance = cls._create_instance()
            instance._populate_from_data(result)
            for mixin in cls._active_mixins:
                await mixin.on_after_get(cls, instance)
            instances.append(instance)
        return instances

    @classmethod
    async def get(cls, id_value: int, tx=None):
        storage = cls._get_storage()
        data = await storage.get(id_value, tx=tx)
        if not data:
            return None
        cls._validate_required_fields(data)
        instance = cls._create_instance()
        instance._populate_from_data(data)
        for mixin in cls._active_mixins:
            await mixin.on_after_get(cls, instance)
        return instance

    @classmethod
    async def get_batch(cls, ids: list[int], tx=None):
        storage = cls._get_storage()
        results = await storage.get_batch(ids, tx=tx)
        instances = []
        for data in results:
            cls._validate_required_fields(data)
            instance = cls._create_instance()
            instance._populate_from_data(data)
            for mixin in cls._active_mixins:
                await mixin.on_after_get(cls, instance)
            instances.append(instance)
        return instances

    @classmethod
    async def get_list(
        cls,
        filters: list = None,
        include_deleted: bool = False,
        tx=None,
        **kwargs,
    ):
        storage = cls._get_storage()
        result = await storage.list(filters, include_deleted, tx=tx, **kwargs)
        instances = []
        for data in result:
            cls._validate_required_fields(data)
            instance = cls._create_instance()
            instance._populate_from_data(data)
            for mixin in cls._active_mixins:
                await mixin.on_after_get(cls, instance)
            instances.append(instance)
        return instances

    @classmethod
    async def update(cls, id_value: int, data: dict, tx=None):
        data = cls._coerce_data(data)
        for mixin in cls._active_mixins:
            data = await mixin.on_before_update(cls, data)
        instance = None
        async with cls._ensure_transaction(tx, cls._get_db_client()) as active_tx:
            storage = cls._get_storage()
            result = await storage.update(id_value, data, tx=active_tx)
            if result:
                cls._validate_required_fields(result)
                instance = cls._create_instance()
                instance._populate_from_data(result)
                for mixin in cls._active_mixins:
                    await mixin.on_after_update(cls, instance, active_tx)
        if instance:
            for mixin in cls._active_mixins:
                await mixin.on_post_commit_update(cls, instance)
        return instance

    @classmethod
    async def update_batch(cls, updates: list[dict], tx=None):
        storage = cls._get_storage()
        results = await storage.update_batch(updates, tx=tx)
        instances = []
        for result in results:
            cls._validate_required_fields(result)
            instance = cls._create_instance()
            instance._populate_from_data(result)
            for mixin in cls._active_mixins:
                await mixin.on_after_get(cls, instance)
            instances.append(instance)
        return instances

    @classmethod
    async def delete(cls, id_value: int, tx=None):
        instance = None
        async with cls._ensure_transaction(tx, cls._get_db_client()) as active_tx:
            storage = cls._get_storage()
            result = await storage.delete(id_value, tx=active_tx)
            if result:
                cls._validate_required_fields(result)
                instance = cls._create_instance()
                instance._populate_from_data(result)
                for mixin in cls._active_mixins:
                    await mixin.on_after_delete(cls, instance, active_tx)
        if instance:
            for mixin in cls._active_mixins:
                await mixin.on_post_commit_delete(cls, instance)
        return instance

    @classmethod
    async def restore(cls, id_value: int, tx=None):
        instance = None
        async with cls._ensure_transaction(tx, cls._get_db_client()) as active_tx:
            storage = cls._get_storage()
            result = await storage.restore(id_value, tx=active_tx)
            if result:
                cls._validate_required_fields(result)
                instance = cls._create_instance()
                instance._populate_from_data(result)
                for mixin in cls._active_mixins:
                    await mixin.on_after_get(cls, instance)
        return instance

    @classmethod
    async def delete_batch(cls, ids: list[int], tx=None):
        storage = cls._get_storage()
        results = await storage.delete_batch(ids, tx=tx)
        instances = []
        for result in results:
            cls._validate_required_fields(result)
            instance = cls._create_instance()
            instance._populate_from_data(result)
            instances.append(instance)
        return instances

    @classmethod
    async def hard_delete(cls, id_value: int, tx=None):
        instance = None
        async with cls._ensure_transaction(tx, cls._get_db_client()) as active_tx:
            storage = cls._get_storage()
            result = await storage.hard_delete(id_value, tx=active_tx)
            if result:
                cls._validate_required_fields(result)
                instance = cls._create_instance()
                instance._populate_from_data(result)
                for mixin in cls._active_mixins:
                    await mixin.on_after_hard_delete(cls, instance, active_tx)
        if instance:
            for mixin in cls._active_mixins:
                await mixin.on_post_commit_hard_delete(cls, instance)
        return instance

    @classmethod
    async def hard_delete_batch(cls, ids: list[int], tx=None):
        storage = cls._get_storage()
        results = await storage.hard_delete_batch(ids, tx=tx)
        instances = []
        for result in results:
            cls._validate_required_fields(result)
            instance = cls._create_instance()
            instance._populate_from_data(result)
            instances.append(instance)
        return instances

    @classmethod
    async def count(cls, filters: list = None, include_deleted: bool = False, tx=None) -> int:
        storage = cls._get_storage()
        return await storage.count(filters, include_deleted, tx=tx)

    @classmethod
    async def get_id_by_code(cls, code: str, tx=None) -> int | None:
        storage = cls._get_storage()
        result = await storage.get_id_by_code(code, tx=tx)
        for mixin in cls._active_mixins:
            result = await mixin.on_after_get_id_by_code(cls, code, result)
        return result

    async def refresh_self(self, tx=None):
        if not self.id:
            raise ValueError("Cannot refresh element without ID")
        storage = self._get_storage()
        data = await storage.get(self.id, tx=tx)
        if not data:
            raise ValueError(f"{self.__class__.__name__}(id={self.id}) not found in database")
        self._validate_required_fields(data)
        self._populate_from_data(data)
        for mixin in self._active_mixins:
            await mixin.on_after_get(self.__class__, self)
        return self

    async def update_self(self, tx=None, **data):
        if not self.id:
            raise ValueError("Cannot update element without ID")
        data = self._coerce_data(data)
        for mixin in self._active_mixins:
            data = await mixin.on_before_update(self.__class__, data)
        updated = False
        async with self._ensure_transaction(tx, self._get_db_client()) as active_tx:
            storage = self._get_storage()
            result = await storage.update(self.id, data, tx=active_tx)
            if result:
                updated = True
                self._validate_required_fields(result)
                self._populate_from_data(result)
                for mixin in self._active_mixins:
                    await mixin.on_after_update(self.__class__, self, active_tx)
        if updated:
            for mixin in self._active_mixins:
                await mixin.on_post_commit_update(self.__class__, self)
        return self

    async def delete_self(self, tx=None):
        if not self.id:
            raise ValueError("Cannot delete element without ID")
        deleted = False
        async with self._ensure_transaction(tx, self._get_db_client()) as active_tx:
            storage = self._get_storage()
            result = await storage.delete(self.id, tx=active_tx)
            if result:
                deleted = True
                self._populate_from_data(result)
                for mixin in self._active_mixins:
                    await mixin.on_after_delete(self.__class__, self, active_tx)
        if deleted:
            for mixin in self._active_mixins:
                await mixin.on_post_commit_delete(self.__class__, self)
        return self

    async def hard_delete_self(self, tx=None):
        if not self.id:
            raise ValueError("Cannot delete element without ID")
        deleted = False
        async with self._ensure_transaction(tx, self._get_db_client()) as active_tx:
            storage = self._get_storage()
            result = await storage.hard_delete(self.id, tx=active_tx)
            if result:
                deleted = True
                self._populate_from_data(result)
                for mixin in self._active_mixins:
                    await mixin.on_after_hard_delete(self.__class__, self, active_tx)
        if deleted:
            for mixin in self._active_mixins:
                await mixin.on_post_commit_hard_delete(self.__class__, self)
        return self

    def __eq__(self, other) -> bool:
        if not isinstance(other, self.__class__):
            return NotImplemented
        return self.id is not None and self.id == other.id

    def __hash__(self) -> int:
        return hash((self.__class__, self.id))

    def __str__(self) -> str:
        obj_id = getattr(self, 'id', None)
        return f"{self.__class__.__name__}(id={obj_id})"

    def __repr__(self) -> str:
        obj_id = getattr(self, 'id', None)
        return f"{self.__class__.__name__}(id={obj_id}, module='{self.__class__.__module__}')"

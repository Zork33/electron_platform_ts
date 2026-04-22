from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from object_container.object_container import ObjectContainer
from object_container.models import ObjectEntry, ObjectMetadata, ObjectKey

from data_framework.mixins.crud_mixin import CrudMixin

if TYPE_CHECKING:
    from data_framework.crud_element import CrudElement


@dataclass
class ContainerMixinSettings:
    ttl: int = 1800
    updatable: bool = True


class ContainerMixin(CrudMixin):
    @staticmethod
    def _add_to_container(instance: CrudElement):
        settings: ContainerMixinSettings = instance._container_mixin_settings
        container = ObjectContainer.get_instance()
        category = instance.__class__.__module__
        key = ObjectKey(category=category, id=str(instance.id))
        metadata = ObjectMetadata(ttl_seconds=settings.ttl)
        entry = ObjectEntry(instance=instance, metadata=metadata)

        if settings.updatable:
            container.storage.add_or_update(key, entry)
        else:
            container.storage.add(key, entry)

    @staticmethod
    def _remove_from_container(instance: CrudElement):
        container = ObjectContainer.get_instance()
        category = instance.__class__.__module__
        key = ObjectKey(category=category, id=str(instance.id))
        container.storage.remove(key)

    @classmethod
    async def on_after_create(cls, target_cls: type[CrudElement], instance: CrudElement, tx):
        cls._add_to_container(instance)

    @classmethod
    async def on_after_get(cls, target_cls: type[CrudElement], instance: CrudElement):
        cls._add_to_container(instance)

    @classmethod
    async def on_after_update(cls, target_cls: type[CrudElement], instance: CrudElement, tx):
        cls._add_to_container(instance)

    @classmethod
    async def on_after_delete(cls, target_cls: type[CrudElement], instance: CrudElement, tx):
        cls._remove_from_container(instance)

    @classmethod
    async def on_after_hard_delete(cls, target_cls: type[CrudElement], instance: CrudElement, tx):
        cls._remove_from_container(instance)

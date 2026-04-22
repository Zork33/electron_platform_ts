from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from data_framework.crud_element import CrudElement


class LifecycleHooks:
    @classmethod
    async def on_before_create(cls, target_cls: type[CrudElement], data: dict) -> dict:
        return data

    @classmethod
    async def on_after_create(cls, target_cls: type[CrudElement], instance: CrudElement, tx):
        pass

    @classmethod
    async def on_post_commit_create(cls, target_cls: type[CrudElement], instance: CrudElement):
        pass

    @classmethod
    async def on_after_get(cls, target_cls: type[CrudElement], instance: CrudElement):
        pass

    @classmethod
    async def on_before_update(cls, target_cls: type[CrudElement], data: dict) -> dict:
        return data

    @classmethod
    async def on_after_update(cls, target_cls: type[CrudElement], instance: CrudElement, tx):
        pass

    @classmethod
    async def on_post_commit_update(cls, target_cls: type[CrudElement], instance: CrudElement):
        pass

    @classmethod
    async def on_after_delete(cls, target_cls: type[CrudElement], instance: CrudElement, tx):
        pass

    @classmethod
    async def on_post_commit_delete(cls, target_cls: type[CrudElement], instance: CrudElement):
        pass

    @classmethod
    async def on_after_hard_delete(cls, target_cls: type[CrudElement], instance: CrudElement, tx):
        pass

    @classmethod
    async def on_post_commit_hard_delete(cls, target_cls: type[CrudElement], instance: CrudElement):
        pass

    @classmethod
    async def on_after_get_id_by_code(cls, target_cls: type[CrudElement], code: str, result):
        return result


class CrudMixin(LifecycleHooks):
    pass

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from data_framework.mixins.crud_mixin import CrudMixin

if TYPE_CHECKING:
    from data_framework.crud_element import CrudElement


@dataclass
class CatalogMixinSettings:
    pass


class CatalogMixin(CrudMixin):
    @classmethod
    def _init_for_class(cls, target_cls: type[CrudElement]):
        if 'code' not in target_cls.__annotations__:
            target_cls.__annotations__['code'] = str | None
        if 'title' not in target_cls.__annotations__:
            target_cls.__annotations__['title'] = str | None

    @staticmethod
    def _validate_code(code: str):
        pattern = r"^[A-Z0-9_]{1,50}$"
        if not isinstance(code, str) or not re.fullmatch(pattern, code):
            raise ValueError(
                "code должен состоять из A-Z, 0-9 и _; без пробелов и дефисов; длина 1..50; верхний регистр"
            )

    @classmethod
    async def on_before_create(cls, target_cls: type[CrudElement], data: dict) -> dict:
        title = data.get("title")
        if not isinstance(title, str) or not title.strip():
            raise ValueError("title обязателен и не может быть пустым")
        code = data.get("code")
        cls._validate_code(code)
        return data

    @classmethod
    async def on_before_update(cls, target_cls: type[CrudElement], data: dict) -> dict:
        if "title" in data:
            title = data.get("title")
            if not isinstance(title, str) or not title.strip():
                raise ValueError("title обязателен и не может быть пустым")
        if "code" in data:
            cls._validate_code(data.get("code"))
        return data

    @classmethod
    async def on_after_get_id_by_code(cls, target_cls: type[CrudElement], code: str, result):
        if result is None:
            table_name = getattr(target_cls, '_db_table_name', None) or 'unknown_table'
            raise ValueError(f"Элемент каталога с code='{code}' не найден в {table_name}")
        return result

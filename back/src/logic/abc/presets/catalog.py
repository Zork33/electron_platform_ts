from abc import ABC
from data_framework.crud_element import CrudElement
from data_framework.mixins.catalog_mixin import CatalogMixinSettings
from data_framework.mixins.container_mixin import ContainerMixinSettings


class Catalog(CrudElement, ABC):
    _catalog_mixin_settings = CatalogMixinSettings()
    _container_mixin_settings = ContainerMixinSettings(ttl=300)

    code: str | None = None
    title: str | None = None

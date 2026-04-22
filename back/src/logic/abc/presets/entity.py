from abc import ABC
from data_framework.crud_element import CrudElement
from data_framework.mixins.container_mixin import ContainerMixinSettings


class Entity(CrudElement, ABC):
    _container_mixin_settings = ContainerMixinSettings(ttl=400)

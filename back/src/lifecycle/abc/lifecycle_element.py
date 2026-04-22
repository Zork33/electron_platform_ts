from object_container.mixin import ObjectContainerMixin
from abc import ABC


class LifecycleElement(ObjectContainerMixin, ABC):
    _container_ttl = -1
    _container_updatable = False
    _container_gettable = True
    
    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)

        original_init = cls.__init__

        def enhanced_init(self, container_id: str, *args, **kwargs):
            self._container_id = container_id
            self._container_category = self.__class__.__module__

            original_init(self, *args, **kwargs)

            self._add_to_container()

        cls.__init__ = enhanced_init

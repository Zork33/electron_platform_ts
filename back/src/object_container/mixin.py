from abc import ABC
from object_container.object_container import ObjectContainer
from object_container.models import ObjectEntry, ObjectMetadata, ObjectKey


class ObjectContainerMixin(ABC):
    _container_id: str
    _container_category: str
    
    _container_ttl: int
    _container_updatable: bool
    _container_gettable: bool
    
    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        cls._container_category = cls.__module__
        
        if not hasattr(cls, '_container_ttl'):
            raise TypeError(f"{cls.__name__} must define _container_ttl")
        if not hasattr(cls, '_container_updatable'):
            raise TypeError(f"{cls.__name__} must define _container_updatable")
        if not hasattr(cls, '_container_gettable'):
            raise TypeError(f"{cls.__name__} must define _container_gettable")
    
    @classmethod
    def get_from_container(cls, container_id: str):
        if not cls._container_gettable:
            raise ValueError(f"Getting objects from container is disabled for {cls.__name__}")
        
        container = ObjectContainer.get_instance()
        key = ObjectKey(category=cls._container_category, id=container_id)
        entry = container.storage.get(key)
        
        if entry is None:
            raise ValueError(f"{cls.__name__} with id '{container_id}' not found in container")
        return entry.instance
    
    def _remove_from_container(self) -> None:
        container = ObjectContainer.get_instance()
        key = ObjectKey(category=self._container_category, id=self._container_id)
        container.storage.remove(key)

    def _add_to_container(self):
        container = ObjectContainer.get_instance()
        key = ObjectKey(category=self._container_category, id=self._container_id)
        metadata = ObjectMetadata(ttl_seconds=self._container_ttl)
        entry = ObjectEntry(instance=self, metadata=metadata)
        
        if self._container_updatable:
            container.storage.add_or_update(key, entry)
        else:
            container.storage.add(key, entry)
    
    def __str__(self) -> str:
        return f"{self.__class__.__name__}(container_id={self._container_id})"
    
    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(container_id='{self._container_id}', container_category='{self._container_category}')"


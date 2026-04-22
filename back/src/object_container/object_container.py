from __future__ import annotations

from .storage import Storage  
from .cleaner import Cleaner
from .statistics import Statistics


class ObjectContainer:
    Storage = Storage
    Cleaner = Cleaner
    Statistics = Statistics
    
    _instance: ObjectContainer | None = None
    
    _storage: Storage
    _cleaner: Cleaner
    _statistics: Statistics
    
    def __init__(self):
        raise RuntimeError("Use ObjectContainer.initialize() instead of ObjectContainer()")
    
    @classmethod
    def initialize(cls) -> ObjectContainer:
        if cls._instance is not None:
            if hasattr(cls._instance, '_storage'):
                raise RuntimeError("ObjectContainer already initialized!")
        
        if cls._instance is None:
            cls._instance = object.__new__(cls)
            
        cls._instance._storage = cls.Storage()
        cls._instance._cleaner = cls.Cleaner(cls._instance._storage)
        cls._instance._statistics = cls.Statistics(cls._instance._storage, cls._instance._cleaner)
        
        return cls._instance
    
    @classmethod
    def get_instance(cls) -> ObjectContainer:
        if cls._instance is None:
            raise RuntimeError("ObjectContainer not initialized! Use ObjectContainer.initialize() first.")
        return cls._instance
    
    @classmethod
    def set_instance(cls, instance: ObjectContainer):
        cls._instance = instance
    
    @classmethod
    def is_initialized(cls) -> bool:
        return cls._instance is not None
    
    @classmethod
    async def destroy(cls):
        if cls._instance is not None:
            await cls._instance.cleaner.stop()
            cls._instance._storage.clear_all()
            cls._instance = None
    
    @property
    def storage(self) -> Storage:
        return self._storage
    
    @property  
    def cleaner(self) -> Cleaner:
        return self._cleaner
    
    @property
    def statistics(self) -> Statistics:
        return self._statistics

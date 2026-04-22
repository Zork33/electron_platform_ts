from datetime import datetime

from .models import ObjectKey, ObjectEntry


class Storage:
    def __init__(self):
        self._storage: dict[str, dict[str, ObjectEntry]] = {}

    def get_storage(self) -> dict[str, dict[str, ObjectEntry]]:
        return self._storage 
    
    def add(self, key: ObjectKey, entry: ObjectEntry):
        if key.category not in self._storage:
            self._storage[key.category] = {}
        
        if key.id in self._storage[key.category]:
            raise ValueError(f"Object with ID '{key.id}' already exists in category '{key.category}'")
        
        self._storage[key.category][key.id] = entry
    
    def add_or_update(self, key: ObjectKey, entry: ObjectEntry):
        if key.category not in self._storage:
            self._storage[key.category] = {}
    
        self._storage[key.category][key.id] = entry
    
    def touch(self, key: ObjectKey) -> bool:
        entry = self._storage.get(key.category, {}).get(key.id)
        if entry is None:
            return False
        
        entry.metadata.last_accessed = datetime.now()
        return True
    
    def get(self, key: ObjectKey) -> ObjectEntry | None:
        entry = self._storage.get(key.category, {}).get(key.id)
        if entry is not None:
            self.touch(key)
        return entry
    
    def remove(self, key: ObjectKey) -> bool:
        category_storage = self._storage.get(key.category, {})
        if key.id not in category_storage:
            return False
        
        del category_storage[key.id]
        
        if not category_storage and key.category in self._storage:
            del self._storage[key.category]
        
        return True
    
    def clear_all(self):
        self._storage.clear()

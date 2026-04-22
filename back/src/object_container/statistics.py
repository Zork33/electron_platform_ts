from datetime import datetime, timedelta
from .storage import Storage
from .cleaner import Cleaner
from .models import ObjectInfo, CategoryInfo


class Statistics:
    def __init__(self, storage: Storage, cleaner: Cleaner):
        self._storage = storage
        self._cleaner = cleaner
        self._initialization_time = datetime.now()
    
    def get_storage_info(self) -> dict:
        storage = self._storage.get_storage()
        total_objects = sum(len(objects) for objects in storage.values())
        total_categories = len(storage)
        
        object_list = []
        for category, objects in storage.items():
            category_objects = []
            
            for id, entry in objects.items():
                expires_at = None
                if entry.metadata.ttl_seconds != -1:
                    expires_at = entry.metadata.created_at + timedelta(seconds=entry.metadata.ttl_seconds)
                
                obj_info = ObjectInfo(
                    id=id,
                    created_at=entry.metadata.created_at,
                    last_accessed=entry.metadata.last_accessed,
                    ttl_seconds=entry.metadata.ttl_seconds,
                    expires_at=expires_at
                )
                category_objects.append(obj_info)
            
            object_list.append(CategoryInfo(
                category=category, 
                object_count=len(category_objects),
                objects=category_objects
            ))
        
        return {
            "summary": {
                "total_categories": total_categories,
                "total_objects": total_objects
            },
            "object_list": object_list
        }
    
    def get_cleaner_info(self) -> dict:
        cleanup_log = self._cleaner.cleanup_log
        
        last_cleanup = None
        if cleanup_log:
            last_cleanup = cleanup_log[-1].timestamp.isoformat()
        
        next_cleanup = None
        if self._cleaner.is_running:
            next_cleanup_time = self._cleaner.next_cleanup_time
            if next_cleanup_time:
                next_cleanup = next_cleanup_time.isoformat()
        
        return {
            "summary": {
                "last_cleanup": last_cleanup,
                "next_cleanup": next_cleanup,
                "is_running": self._cleaner.is_running,
                "interval_seconds": self._cleaner.interval_seconds
            },
            "cleanup_log": [
                {
                    "datetime": entry.timestamp.isoformat(),
                    "cleaned_count": entry.cleaned_count
                }
                for entry in cleanup_log
            ]
        }
    
    def get_container_info(self) -> dict:
        storage = self._storage.get_storage()
        total_objects = sum(len(objects) for objects in storage.values())
        total_categories = len(storage)
        
        return {
            "initialization_time": self._initialization_time.isoformat(),
            "total_categories": total_categories,
            "total_objects": total_objects,
            "cleaner_running": self._cleaner.is_running
        }

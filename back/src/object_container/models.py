from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum


@dataclass
class ObjectKey:
    category: str
    id: str
    
    def __post_init__(self):
        if not self.category.strip():
            raise ValueError("Category cannot be empty")
        if not self.id.strip():
            raise ValueError("Object ID cannot be empty")


class ObjectMetadata:
    def __init__(self, ttl_seconds: int = 3600):
        if ttl_seconds < -1:
            raise ValueError("TTL cannot be less than -1")
        self.ttl_seconds = ttl_seconds
        self.created_at = datetime.now()
        self.last_accessed = datetime.now()
        
    def is_expired(self) -> bool:
        if self.ttl_seconds == -1:
            return False
        return datetime.now() - self.last_accessed > timedelta(seconds=self.ttl_seconds)

    
class ObjectEntry:
    def __init__(self, instance: object, metadata: ObjectMetadata):
        self.instance = instance
        self.metadata = metadata


@dataclass
class CleanupLogEntry:
    timestamp: datetime
    cleaned_count: int
    
    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "cleaned_count": self.cleaned_count
        }


@dataclass
class ObjectInfo:
    id: str
    created_at: datetime
    last_accessed: datetime
    ttl_seconds: int
    expires_at: datetime | None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat(),
            "last_accessed": self.last_accessed.isoformat(), 
            "ttl_seconds": self.ttl_seconds,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None
        }


@dataclass
class CategoryInfo:
    category: str
    object_count: int
    objects: list[ObjectInfo]
    
    def to_dict(self) -> dict:
        return {
            "category": self.category,
            "object_count": self.object_count,
            "objects": [obj.to_dict() for obj in self.objects]
        }
    

class TtlSecondsStrategy(Enum):
    MOMENT = 0
    SHORT = 300
    MEDIUM = 1800
    LONG = 3600
    FOREVER = -1

from abc import ABC, abstractmethod

from .models import StoragePart


class PartManager(ABC):
    
    @abstractmethod
    async def create(self, part: StoragePart) -> bool:
        pass
    
    @abstractmethod
    async def delete(self, part_name: str) -> bool:
        pass
    
    @abstractmethod
    async def is_exists(self, part_name: str) -> bool:
        pass
    
    @abstractmethod
    async def list(self) -> list[str]:
        pass
    
    @abstractmethod
    async def set_public(self, part_name: str, is_public: bool) -> bool:
        pass

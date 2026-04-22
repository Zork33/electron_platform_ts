from toolkit.adapter.abc.file_storage.adapter import FileStorage as FileStorageAdapter
from toolkit.adapter.abc.file_storage.models import StoragePart


class PartManager:
    def __init__(self, adapter: FileStorageAdapter):
        self._adapter = adapter
    
    async def create(self, part: StoragePart) -> bool:
        return await self._adapter.part_manager.create(part)
    
    async def delete(self, part_name: str) -> bool:
        return await self._adapter.part_manager.delete(part_name)
    
    async def is_exists(self, part_name: str) -> bool:
        return await self._adapter.part_manager.is_exists(part_name)
    
    async def list(self) -> list[str]:
        return await self._adapter.part_manager.list()
    
    async def set_public(self, part_name: str, is_public: bool) -> bool:
        return await self._adapter.part_manager.set_public(part_name, is_public)

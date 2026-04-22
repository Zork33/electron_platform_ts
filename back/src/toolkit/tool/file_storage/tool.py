from toolkit.abc.tool import Tool
from toolkit.adapter.abc.file_storage.adapter import FileStorage as FileStorageAdapter
from toolkit.tool.abc.file_storage.tool import FileStorage as AbstractFileStorage

from .part_manager import PartManager
from .filer import Filer


class FileStorage(Tool, AbstractFileStorage):
    _code = "file_storage"
    _title = "File storage"
    PartManager = PartManager
    Filer = Filer
    
    def __init__(self, file_storage_adapter: FileStorageAdapter):
        if file_storage_adapter is None:
            raise ValueError("file_storage_adapter cannot be None")
        
        self._adapter = file_storage_adapter
        self._part_manager = self.PartManager(file_storage_adapter)
        self._filer = self.Filer(file_storage_adapter)
    
    @property
    def part_manager(self) -> PartManager:
        return self._part_manager
    
    @property
    def filer(self) -> Filer:
        return self._filer
    
    async def health_check(self) -> bool:
        return await self._adapter.health_check()

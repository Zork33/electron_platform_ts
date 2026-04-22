import asyncio
from minio import Minio

from toolkit.abc.adapter import Adapter
from toolkit.adapter.abc.file_storage.adapter import FileStorage as AbstractFileStorage
from toolkit.adapter.abc.file_storage.config import ConnectionConfig as FileStorageConnectionConfig
from .filer import Filer
from .part_manager import PartManager


class FileStorageMinioPyLib(Adapter, AbstractFileStorage):
    _code = "minio_py_lib"
    _title = "MinIO"
    PartManager = PartManager
    Filer = Filer
    
    def __init__(self, config: FileStorageConnectionConfig):
        if config is None:
            raise ValueError("config cannot be None")
        
        self._config = config
        
        self._client = Minio(
            endpoint=f"{config.host}:{config.port}",
            access_key=config.login,
            secret_key=config.password,
            secure=config.use_ssl
        )
        
        self._part_manager = self.PartManager(self._client)
        self._filer = self.Filer(self._client)
    
    @property
    def part_manager(self) -> PartManager:
        return self._part_manager
    
    @property
    def filer(self) -> Filer:
        return self._filer
    
    async def health_check(self) -> bool:
        try:
            await asyncio.to_thread(self._client.list_buckets)
            return True
        except Exception as e:
            print(f"FileStorage health check failed: {e}")
            return False

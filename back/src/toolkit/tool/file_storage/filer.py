from toolkit.adapter.abc.file_storage.adapter import FileStorage as FileStorageAdapter
from toolkit.adapter.abc.file_storage.models import UploadParams, UploadResult, FileInfo, FilePath


class Filer:
    def __init__(self, adapter: FileStorageAdapter):
        self._adapter = adapter
    
    async def upload(self, params: UploadParams) -> UploadResult:
        return await self._adapter.filer.upload(params)
    
    async def download(self, file_path: FilePath) -> bytes:
        return await self._adapter.filer.download(file_path)
    
    async def delete(self, file_path: FilePath) -> bool:
        return await self._adapter.filer.delete(file_path)
    
    async def is_exists(self, file_path: FilePath) -> bool:
        return await self._adapter.filer.is_exists(file_path)
    
    async def info(self, file_path: FilePath) -> FileInfo | None:
        return await self._adapter.filer.info(file_path)
    
    async def info_list(
        self,
        storage_part_name: str,
        prefix: str | None = None,
        limit: int = 100
    ) -> list[FileInfo]:
        return await self._adapter.filer.info_list(storage_part_name, prefix, limit)
    
    async def get_presigned_url(
        self,
        file_path: FilePath,
        expires_in: int = 3600
    ) -> str:
        return await self._adapter.filer.get_presigned_url(file_path, expires_in)

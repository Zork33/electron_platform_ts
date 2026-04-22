from abc import ABC, abstractmethod

from .models import FileInfo, UploadParams, UploadResult, FilePath


class Filer(ABC):
    
    @abstractmethod
    async def upload(self, params: UploadParams) -> UploadResult:
        pass
    
    @abstractmethod
    async def download(self, file_path: FilePath) -> bytes:
        pass
    
    @abstractmethod
    async def delete(self, file_path: FilePath) -> bool:
        pass
    
    @abstractmethod
    async def is_exists(self, file_path: FilePath) -> bool:
        pass
    
    @abstractmethod
    async def info(self, file_path: FilePath) -> FileInfo | None:
        pass
    
    @abstractmethod
    async def info_list(
        self,
        storage_part_name: str,
        prefix: str | None = None,
        limit: int = 100
    ) -> list[FileInfo]:
        pass
    
    @abstractmethod
    async def get_presigned_url(
        self,
        file_path: FilePath,
        expires_in: int = 3600
    ) -> str:
        pass

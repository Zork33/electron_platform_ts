import io
import asyncio
from datetime import datetime, timedelta
from minio import Minio
from minio.error import S3Error

from toolkit.adapter.abc.file_storage.filer import Filer as AbstractFiler
from toolkit.adapter.abc.file_storage.models import UploadParams, UploadResult, FileInfo, FilePath


class Filer(AbstractFiler):
    def __init__(self, client: Minio):
        self._client = client
    
    async def upload(self, params: UploadParams) -> UploadResult:
        try:
            if isinstance(params.data, bytes):
                data_stream = io.BytesIO(params.data)
                size = len(params.data)
            else:
                data_stream = params.data
                size = params.size
                if size is None:
                    raise ValueError("size is required for stream uploads")

            result = await asyncio.to_thread(
                self._client.put_object,
                bucket_name=params.file_path.storage_part_name,
                object_name=params.file_path.path,
                data=data_stream,
                length=size,
                content_type=params.content_type
            )
            
            return UploadResult(
                file_path=params.file_path,
                size_bytes=size,
                etag=result.etag
            )
        except S3Error as e:
            raise Exception(f"Failed to upload file: {e}")
    
    async def download(self, file_path: FilePath) -> bytes:
        try:
            response = await asyncio.to_thread(
                self._client.get_object,
                bucket_name=file_path.storage_part_name,
                object_name=file_path.path
            )
            
            data = response.read()
            response.close()
            response.release_conn()
            
            return data
        except S3Error as e:
            raise Exception(f"Failed to download file: {e}")
    
    async def delete(self, file_path: FilePath) -> bool:
        try:
            await asyncio.to_thread(
                self._client.remove_object,
                bucket_name=file_path.storage_part_name,
                object_name=file_path.path
            )
            return True
        except S3Error:
            return False
    
    async def is_exists(self, file_path: FilePath) -> bool:
        try:
            await asyncio.to_thread(
                self._client.stat_object,
                bucket_name=file_path.storage_part_name,
                object_name=file_path.path
            )
            return True
        except S3Error:
            return False
    
    async def info(self, file_path: FilePath) -> FileInfo | None:
        try:
            stat = await asyncio.to_thread(
                self._client.stat_object,
                bucket_name=file_path.storage_part_name,
                object_name=file_path.path
            )
            
            last_modified = stat.last_modified
            if last_modified and not isinstance(last_modified, datetime):
                if isinstance(last_modified, str):
                    last_modified = datetime.fromisoformat(last_modified.replace('Z', '+00:00'))
            
            return FileInfo(
                file_path=file_path,
                size_bytes=stat.size,
                content_type=stat.content_type,
                last_modified=last_modified,
                etag=stat.etag
            )
        except S3Error:
            return None
    
    async def info_list(
        self,
        storage_part_name: str,
        prefix: str | None = None,
        limit: int = 100
    ) -> list[FileInfo]:
        try:
            objects = await asyncio.to_thread(
                self._client.list_objects,
                bucket_name=storage_part_name,
                prefix=prefix,
                recursive=True
            )
            
            result = []
            for obj in objects:
                if len(result) >= limit:
                    break
                
                file_path = FilePath(
                    storage_part_name=storage_part_name,
                    path=obj.object_name
                )
                
                last_modified = obj.last_modified
                if last_modified and not isinstance(last_modified, datetime):
                    if isinstance(last_modified, str):
                        last_modified = datetime.fromisoformat(last_modified.replace('Z', '+00:00'))
                
                file_info = FileInfo(
                    file_path=file_path,
                    size_bytes=obj.size,
                    content_type=obj.content_type,
                    last_modified=last_modified,
                    etag=obj.etag
                )
                result.append(file_info)
            
            return result
        except S3Error as e:
            raise Exception(f"Failed to list files: {e}")
    
    async def get_presigned_url(
        self,
        file_path: FilePath,
        expires_in: int = 3600
    ) -> str:
        try:
            url = await asyncio.to_thread(
                self._client.presigned_get_object,
                bucket_name=file_path.storage_part_name,
                object_name=file_path.path,
                expires=timedelta(seconds=expires_in)
            )
            return url
        except S3Error as e:
            raise Exception(f"Failed to generate presigned URL: {e}")

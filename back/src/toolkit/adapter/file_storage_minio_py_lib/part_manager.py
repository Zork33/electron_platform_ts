import asyncio
import json

from minio import Minio
from minio.error import S3Error

from toolkit.adapter.abc.file_storage.part_manager import PartManager as AbstractPartManager
from toolkit.adapter.abc.file_storage.models import StoragePart


class PartManager(AbstractPartManager):
    def __init__(self, client: Minio):
        self._client = client
    
    async def create(self, part: StoragePart) -> bool:
        try:
            await asyncio.to_thread(
                self._client.make_bucket,
                bucket_name=part.name
            )
            
            if part.is_public:
                await self.set_public(part.name, True)
            
            return True
        except S3Error as e:
            if e.code == "BucketAlreadyOwnedByYou":
                return True
            raise Exception(f"Failed to create storage part: {e}")
    
    async def delete(self, part_name: str) -> bool:
        try:
            await asyncio.to_thread(
                self._client.remove_bucket,
                bucket_name=part_name
            )
            return True
        except S3Error:
            return False
    
    async def is_exists(self, part_name: str) -> bool:
        try:
            result = await asyncio.to_thread(
                self._client.bucket_exists,
                bucket_name=part_name
            )
            return result
        except S3Error:
            return False
    
    async def list(self) -> list[str]:
        try:
            buckets = await asyncio.to_thread(
                self._client.list_buckets
            )
            return [bucket.name for bucket in buckets]
        except S3Error as e:
            raise Exception(f"Failed to list storage parts: {e}")
    
    async def set_public(self, part_name: str, is_public: bool) -> bool:
        try:
            if is_public:
                policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"AWS": "*"},
                            "Action": ["s3:GetObject"],
                            "Resource": [f"arn:aws:s3:::{part_name}/*"]
                        }
                    ]
                }
            else:
                policy = {}
            
            await asyncio.to_thread(
                self._client.set_bucket_policy,
                bucket_name=part_name,
                policy=json.dumps(policy) if policy else ""
            )
            return True
        except S3Error as e:
            raise Exception(f"Failed to set public access: {e}")

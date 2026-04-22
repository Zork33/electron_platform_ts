from configs import file_storage as file_storage_config
from toolkit.adapter.file_storage_minio_py_lib.adapter import FileStorageMinioPyLib
from toolkit.tool.file_storage.tool import FileStorage
from storage_schemas.file_storage.main.parts.registry import ALL_PARTS
from storage_schemas.file_storage.syncer import sync_parts


def _create_file_storage() -> FileStorage:
    adapter = FileStorageMinioPyLib("file_storage", config=file_storage_config.connection())
    file_storage = FileStorage("file_storage", file_storage_adapter=adapter)
    return file_storage


async def connect_file_storage():
    file_storage = _create_file_storage()
    healthy = await file_storage.health_check()
    
    if healthy:
        print("File Storage connected successfully")
    else:
        print("⚠️  WARNING: File Storage (MinIO) health check failed")


async def sync_file_storage_parts():
    file_storage: FileStorage = FileStorage.get_from_container("file_storage")
    result = await sync_parts(file_storage, ALL_PARTS)
    
    if result.created:
        print(f"📊 Created {len(result.created)} storage part(s)")
    if result.updated_public:
        print(f"🔓 Updated {len(result.updated_public)} part(s) to public")
    if result.failed:
        print(f"⚠️  Failed to sync {len(result.failed)} part(s)")
    print(f"✓ Total parts in registry: {len(ALL_PARTS)}")

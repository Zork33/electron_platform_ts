from dataclasses import dataclass
from toolkit.adapter.abc.file_storage.models import StoragePart
from toolkit.tool.file_storage.tool import FileStorage


@dataclass
class SyncResult:
    created: list[str]
    existed: list[str]
    updated_public: list[str]
    failed: list[tuple[str, str]]


async def sync_parts(
    file_storage: FileStorage,
    parts: list[StoragePart]
) -> SyncResult:
    result = SyncResult(created=[], existed=[], updated_public=[], failed=[])
    
    for part in parts:
        try:
            exists = await file_storage.part_manager.is_exists(part.name)
            if not exists:
                await file_storage.part_manager.create(part)
                result.created.append(part.name)
                print(f"✅ Storage part '{part.name}' created")
            else:
                result.existed.append(part.name)
                print(f"ℹ️  Storage part '{part.name}' already exists")
            
            if part.is_public:
                await file_storage.part_manager.set_public(part.name, True)
                result.updated_public.append(part.name)
                print(f"🔓 Storage part '{part.name}' set to public")
        except Exception as e:
            result.failed.append((part.name, str(e)))
            print(f"❌ Failed to sync storage part '{part.name}': {e}")
    
    return result

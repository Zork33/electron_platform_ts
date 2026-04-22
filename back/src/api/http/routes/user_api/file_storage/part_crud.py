from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from toolkit.tool.file_storage.tool import FileStorage
from toolkit.adapter.abc.file_storage.models import StoragePart


router = APIRouter(tags=["file-storage-part"])


class CreatePartRequest(BaseModel):
    name: str
    is_public: bool = False


@router.post("/create")
async def create_part(request: CreatePartRequest):
    """Создать новый раздел (bucket) в файловом хранилище"""
    try:
        file_storage: FileStorage = FileStorage.get_from_container("file_storage")
        
        # Проверяем, не существует ли уже
        exists = await file_storage.part_manager.is_exists(request.name)
        if exists:
            raise HTTPException(status_code=409, detail=f"Part '{request.name}' already exists")
        
        part = StoragePart(name=request.name, is_public=request.is_public)
        result = await file_storage.part_manager.create(part)
        
        if result:
            return {
                "success": True,
                "message": f"Part '{request.name}' created successfully",
                "part": {"name": request.name, "is_public": request.is_public}
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create part")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{part_name}")
async def check_part_exists(part_name: str):
    """Проверить существование раздела"""
    try:
        file_storage: FileStorage = FileStorage.get_from_container("file_storage")
        
        exists = await file_storage.part_manager.is_exists(part_name)
        
        return {
            "part_name": part_name,
            "exists": exists
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{part_name}")
async def delete_part(part_name: str):
    """Удалить раздел (bucket) из файлового хранилища"""
    try:
        file_storage: FileStorage = FileStorage.get_from_container("file_storage")
        
        # Проверяем существование
        exists = await file_storage.part_manager.is_exists(part_name)
        if not exists:
            raise HTTPException(status_code=404, detail=f"Part '{part_name}' not found")
        
        result = await file_storage.part_manager.delete(part_name)
        
        if result:
            return {
                "success": True,
                "message": f"Part '{part_name}' deleted successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to delete part")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

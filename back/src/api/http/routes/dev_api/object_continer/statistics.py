from fastapi import APIRouter, HTTPException
from object_container.object_container import ObjectContainer

router = APIRouter(tags=["object-container"])


@router.get("/storage-info")
async def get_storage_info():
    """Получить информацию о хранилище объектов"""
    try:
        if not ObjectContainer.is_initialized():
            raise HTTPException(status_code=503, detail="ObjectContainer не инициализирован")
        
        container = ObjectContainer.get_instance()
        return container.statistics.get_storage_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения статистики хранилища: {str(e)}")


@router.get("/cleaner-info") 
async def get_cleaner_info():
    """Получить информацию о системе очистки"""
    try:
        if not ObjectContainer.is_initialized():
            raise HTTPException(status_code=503, detail="ObjectContainer не инициализирован")
        
        container = ObjectContainer.get_instance()
        return container.statistics.get_cleaner_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения статистики очистки: {str(e)}")


@router.get("/container-info")
async def get_container_info():
    """Получить общую информацию о контейнере"""
    try:
        if not ObjectContainer.is_initialized():
            raise HTTPException(status_code=503, detail="ObjectContainer не инициализирован")
        
        container = ObjectContainer.get_instance()
        return container.statistics.get_container_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения информации о контейнере: {str(e)}")


@router.get("/all-statistics")
async def get_all_statistics():
    """Получить всю статистику объединенно"""
    try:
        if not ObjectContainer.is_initialized():
            raise HTTPException(status_code=503, detail="ObjectContainer не инициализирован")
        
        container = ObjectContainer.get_instance()
        statistics = container.statistics
        
        return {
            "storage": statistics.get_storage_info(),
            "cleaner": statistics.get_cleaner_info(),
            "container": statistics.get_container_info()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения статистики: {str(e)}")

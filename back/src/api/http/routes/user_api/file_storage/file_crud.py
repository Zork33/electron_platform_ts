from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import io

from toolkit.tool.file_storage.tool import FileStorage
from toolkit.adapter.abc.file_storage.models import FilePath, UploadParams


router = APIRouter(tags=["file-storage-file"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    storage_part_name: str = Form(...),
    path: str = Form(...)
):
    """Загрузить файл в хранилище"""
    try:
        file_storage: FileStorage = FileStorage.get_from_container("file_storage")
        
        # Проверяем существование раздела
        part_exists = await file_storage.part_manager.is_exists(storage_part_name)
        if not part_exists:
            raise HTTPException(status_code=404, detail=f"Storage part '{storage_part_name}' not found")
        
        # Читаем содержимое файла
        file_content = await file.read()
        
        # Создаем параметры для загрузки
        file_path = FilePath(storage_part_name=storage_part_name, path=path)
        upload_params = UploadParams(
            file_path=file_path,
            data=file_content,
            content_type=file.content_type
        )
        
        # Загружаем файл
        result = await file_storage.filer.upload(upload_params)
        
        return {
            "success": True,
            "message": "File uploaded successfully",
            "file_path": {
                "storage_part_name": result.file_path.storage_part_name,
                "path": result.file_path.path
            },
            "size_bytes": result.size_bytes,
            "etag": result.etag
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download")
async def download_file(
    storage_part_name: str,
    path: str
):
    """Скачать файл из хранилища"""
    try:
        file_storage: FileStorage = FileStorage.get_from_container("file_storage")
        
        # Создаем путь к файлу
        file_path = FilePath(storage_part_name=storage_part_name, path=path)
        
        # Проверяем существование файла
        exists = await file_storage.filer.is_exists(file_path)
        if not exists:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Получаем информацию о файле
        file_info = await file_storage.filer.info(file_path)
        
        # Скачиваем файл
        file_data = await file_storage.filer.download(file_path)
        
        # Определяем имя файла для скачивания
        filename = path.split('/')[-1] if '/' in path else path
        
        # Возвращаем файл как stream
        return StreamingResponse(
            io.BytesIO(file_data),
            media_type=file_info.content_type if file_info and file_info.content_type else "application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete")
async def delete_file(
    storage_part_name: str,
    path: str
):
    """Удалить файл из хранилища"""
    try:
        file_storage: FileStorage = FileStorage.get_from_container("file_storage")
        
        # Создаем путь к файлу
        file_path = FilePath(storage_part_name=storage_part_name, path=path)
        
        # Проверяем существование файла
        exists = await file_storage.filer.is_exists(file_path)
        if not exists:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Удаляем файл
        result = await file_storage.filer.delete(file_path)
        
        if result:
            return {
                "success": True,
                "message": "File deleted successfully",
                "file_path": {
                    "storage_part_name": storage_part_name,
                    "path": path
                }
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to delete file")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info")
async def get_file_info(
    storage_part_name: str,
    path: str
):
    """Получить информацию о файле"""
    try:
        file_storage: FileStorage = FileStorage.get_from_container("file_storage")
        
        # Создаем путь к файлу
        file_path = FilePath(storage_part_name=storage_part_name, path=path)
        
        # Получаем информацию о файле
        file_info = await file_storage.filer.info(file_path)
        
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {
            "success": True,
            "file_info": {
                "storage_part_name": file_info.file_path.storage_part_name,
                "path": file_info.file_path.path,
                "size_bytes": file_info.size_bytes,
                "content_type": file_info.content_type,
                "last_modified": file_info.last_modified.isoformat() if file_info.last_modified else None,
                "etag": file_info.etag
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/presigned-url")
async def get_presigned_url(
    storage_part_name: str,
    path: str,
    expires_in: int = 3600
):
    """Получить presigned URL для скачивания файла"""
    try:
        file_storage: FileStorage = FileStorage.get_from_container("file_storage")
        
        # Создаем путь к файлу
        file_path = FilePath(storage_part_name=storage_part_name, path=path)
        
        # Проверяем существование файла
        exists = await file_storage.filer.is_exists(file_path)
        if not exists:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Получаем presigned URL
        presigned_url = await file_storage.filer.get_presigned_url(file_path, expires_in)
        
        return {
            "success": True,
            "presigned_url": presigned_url,
            "expires_in": expires_in,
            "file_path": {
                "storage_part_name": storage_part_name,
                "path": path
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

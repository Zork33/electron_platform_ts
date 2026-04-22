import io
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from fastapi.responses import StreamingResponse

from toolkit.tool.file_manager.tool import FileManager

from storage_schemas.file_storage.main.parts.private import PRIVATE
from storage_schemas.file_storage.main.parts.public import PUBLIC


STORAGE_PARTS = {"private": PRIVATE, "public": PUBLIC}
router = APIRouter(tags=["file-manager"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    storage_part_name: str = Form("private"),
    path: str = Form(...),
    filename: str = Form(...),
    ext: str = Form(...),
    with_replace: bool = Form(False)
):
    try:
        file_manager: FileManager = FileManager.get_from_container("file_manager")
        storage_part = STORAGE_PARTS.get(storage_part_name.lower())
        if not storage_part:
            raise HTTPException(status_code=400, detail=f"Unknown storage part: {storage_part_name}")

        metadata = await file_manager.upload(
            file=file,
            storage_part=storage_part,
            path=path,
            filename=filename,
            ext=ext,
            with_replace=with_replace
        )
        return {"success": True, "metadata": metadata}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_files(
    include_deleted: bool = False,
    page_count: int = 20,
    page_number: int = 1
):
    try:
        file_manager: FileManager = FileManager.get_from_container("file_manager")
        result = await file_manager.metadata_crud.list(
            include_deleted=include_deleted,
            page_count=page_count,
            page_number=page_number
        )
        return {"success": True, "items": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{stored_file_id}")
async def get_file(stored_file_id: int):
    try:
        file_manager: FileManager = FileManager.get_from_container("file_manager")
        metadata = await file_manager.get(stored_file_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="File not found")
        return {"success": True, "metadata": metadata}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{stored_file_id}/download")
async def download_file(stored_file_id: int):
    try:
        file_manager: FileManager = FileManager.get_from_container("file_manager")
        metadata = await file_manager.get(stored_file_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="File not found")

        file_data = await file_manager.download(stored_file_id)
        if not file_data:
            raise HTTPException(status_code=404, detail="File not found in storage")

        download_filename = f"{metadata['filename']}.{metadata['ext']}"
        try:
            ascii_filename = download_filename.encode("ascii").decode("ascii")
        except UnicodeEncodeError:
            ascii_filename = f"download.{metadata['ext']}"
        encoded_filename = quote(download_filename, safe="")
        content_disposition = f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_filename}'
        return StreamingResponse(
            io.BytesIO(file_data),
            media_type="application/octet-stream",
            headers={"Content-Disposition": content_disposition}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{stored_file_id}/url")
async def get_file_url(
    stored_file_id: int,
    expires_in: int = 3600
):
    try:
        file_manager: FileManager = FileManager.get_from_container("file_manager")
        metadata = await file_manager.get(stored_file_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="File not found")

        url = await file_manager.get_url(stored_file_id, expires_in)
        if not url:
            raise HTTPException(status_code=404, detail="Failed to generate URL")
        return {"success": True, "url": url, "expires_in": expires_in}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{stored_file_id}/restore")
async def restore_file(stored_file_id: int):
    try:
        file_manager: FileManager = FileManager.get_from_container("file_manager")
        metadata = await file_manager.restore(stored_file_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="File not found or not in trash")
        return {"success": True, "metadata": metadata}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{stored_file_id}")
async def delete_file(stored_file_id: int, hard: bool = False):
    try:
        file_manager: FileManager = FileManager.get_from_container("file_manager")
        if hard:
            metadata = await file_manager.hard_delete(stored_file_id)
        else:
            metadata = await file_manager.delete(stored_file_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="File not found")
        return {"success": True, "metadata": metadata}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{stored_file_id}/replace")
async def replace_file(
    stored_file_id: int,
    file: UploadFile = File(...)
):
    try:
        file_manager: FileManager = FileManager.get_from_container("file_manager")
        metadata = await file_manager.replace(stored_file_id, file)
        if not metadata:
            raise HTTPException(status_code=404, detail="File not found")
        return {"success": True, "metadata": metadata}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

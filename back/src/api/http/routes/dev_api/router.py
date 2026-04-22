from fastapi import APIRouter

from .object_continer.statistics import router as object_container_router
from .file_storage.part_crud import router as file_storage_part_router
from .web_socket.router import router as web_socket_router

router = APIRouter()

router.include_router(object_container_router, prefix="/object-container")
router.include_router(file_storage_part_router, prefix="/file-storage/part")
router.include_router(web_socket_router, prefix="/web-socket")

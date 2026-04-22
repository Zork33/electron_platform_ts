from fastapi import APIRouter
from .auth.registration_confirm_code import router as registration_router
from .auth.login_confirm_code import router as login_router
from .auth.access_token_refresh import router as access_token_refresh_router
from .person.router import router as person_router
from .user.router import router as user_router
from .file_storage.part_crud import router as file_storage_part_router
from .file_storage.file_crud import router as file_storage_file_router
from .file_manager.crud import router as file_manager_router
from .contact_info.router import router as contact_info_router
from .phone_number.router import router as phone_number_router
from .email.router import router as email_router
from .tg_acc.router import router as tg_acc_router
from .web_link.router import router as web_link_router

router = APIRouter()

router.include_router(registration_router, prefix="/auth")
router.include_router(login_router, prefix="/auth")
router.include_router(access_token_refresh_router, prefix="/auth")
router.include_router(person_router, prefix="/person")
router.include_router(user_router, prefix="/user")
router.include_router(file_storage_part_router, prefix="/file-storage/part")
router.include_router(file_storage_file_router, prefix="/file-storage/file")
router.include_router(file_manager_router, prefix="/file-manager")
router.include_router(contact_info_router, prefix="/contact-info")
router.include_router(phone_number_router, prefix="/phone-number")
router.include_router(email_router, prefix="/email")
router.include_router(tg_acc_router, prefix="/tg-acc")
router.include_router(web_link_router, prefix="/web-link")

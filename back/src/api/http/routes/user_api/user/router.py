import io

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse

from api.http.factory.factory import Factory
from logic.entity.user.entity import User
from logic.service.user.service import UserService
from system.errors import ApplicationError

router = Factory.create_logic_element_crud_router(
    logic_element_class=User,
    prefix="",
    tags=["user"]
)


def _media_type_by_ext(ext: str | None) -> str:
    if not ext:
        return "application/octet-stream"
    ext_lower = ext.lower()
    if ext_lower in {"jpg", "jpeg"}:
        return "image/jpeg"
    if ext_lower == "png":
        return "image/png"
    if ext_lower == "webp":
        return "image/webp"
    if ext_lower == "gif":
        return "image/gif"
    return "application/octet-stream"

@router.get("/current-user")
async def get_current_user(request: Request):
    """Получить информацию о текущем пользователе"""
    try:
        user: User = request.state.user
        return await UserService.get_info(user)
    except AttributeError:
        raise HTTPException(status_code=401, detail={
            "error_message": "Пользователь не авторизован",
            "error_code": "UNAUTHORIZED",
        })
    except ApplicationError as e:
        raise HTTPException(status_code=e.http_status, detail={
            "error_message": e.message,
            "error_code": e.error_code,
            "meta": e.meta or {},
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "error_message": "Внутренняя ошибка сервера",
            "error_code": "INTERNAL_ERROR",
        })


@router.post("/{user_id:int}/avatar/upload")
async def upload_user_avatar(user_id: int, file: UploadFile = File(...)):
    try:
        user = await User.upload_avatar(user_id=user_id, file=file)
        return Factory.instance_to_api_dict(user)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id:int}/avatar/replace")
async def replace_user_avatar(user_id: int, file: UploadFile = File(...)):
    try:
        user = await User.replace_avatar(user_id=user_id, file=file)
        return Factory.instance_to_api_dict(user)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id:int}/avatar")
async def delete_user_avatar(user_id: int):
    try:
        user = await User.delete_avatar(user_id=user_id)
        return Factory.instance_to_api_dict(user)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id:int}/avatar/content")
async def get_user_avatar_content(user_id: int):
    try:
        content, metadata = await User.get_avatar_content(user_id=user_id)
        media_type = _media_type_by_ext(metadata.get("ext"))
        return StreamingResponse(
            io.BytesIO(content),
            media_type=media_type,
            headers={"Cache-Control": "no-store"},
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

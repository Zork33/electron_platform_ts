from fastapi import APIRouter, HTTPException

from api.http.routes.user_api.auth.models.login_confirm_code import (
    LoginStartRequest,
    LoginStartResponse,
    LoginFinishRequest,
    LoginFinishResponse,
)
from logic.process.auth.login.confirm_code.process import LoginConfirmCode
from logic.process.auth.login.confirm_code.models import (
    LoginStartParams,
    LoginFinishParams,
)
from system.errors import ApplicationError

router = APIRouter(tags=["auth"])


@router.post("/login-confirm-code-start")
async def login_confirm_code_start(request_data: LoginStartRequest) -> LoginStartResponse:
    print(f"[API] POST /login-confirm-code-start | email={request_data.auth_email}")
    try:
        params = LoginStartParams(**request_data.model_dump())
        result = await LoginConfirmCode.start(params)
        response = LoginStartResponse(**result.model_dump())
        print(f"[API] ✓ Response: confirmation_token={response.confirmation_token[:8]}..., expires_at={response.expires_at}")
        return response
    except ApplicationError as e:
        print(f"[API] ❌ DomainError: {e.error_code} - {e.message}")
        raise HTTPException(status_code=e.http_status, detail={
            "error_message": e.message,
            "error_code": e.error_code,
            "meta": e.meta or {},
        })
    except Exception as e:
        print(f"[API] ❌ Exception: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail={
            "error_message": "Внутренняя ошибка сервера",
            "error_code": "INTERNAL_ERROR",
        })


@router.post("/login-confirm-code-finish")
async def login_confirm_code_finish(request_data: LoginFinishRequest) -> LoginFinishResponse:
    print(f"[API] POST /login-confirm-code-finish | confirmation_token={request_data.confirmation_token[:8]}..., code={request_data.confirm_code}")
    try:
        params = LoginFinishParams(**request_data.model_dump())
        result = await LoginConfirmCode.finish(params)
        response = LoginFinishResponse(**result.model_dump())
        print(f"[API] ✓ Response: user_id={response.user_id}, person_id={response.person_id}")
        return response
    except ApplicationError as e:
        print(f"[API] ❌ DomainError: {e.error_code} - {e.message}")
        raise HTTPException(status_code=e.http_status, detail={
            "error_message": e.message,
            "error_code": e.error_code,
            "meta": e.meta or {},
        })
    except Exception as e:
        print(f"[API] ❌ Exception: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail={
            "error_message": "Внутренняя ошибка сервера",
            "error_code": "INTERNAL_ERROR",
        })

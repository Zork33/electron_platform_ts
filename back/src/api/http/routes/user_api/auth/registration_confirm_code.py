from fastapi import APIRouter, HTTPException

from api.http.routes.user_api.auth.models.registration_confirm_code import (
    RegistrationStartRequest,
    RegistrationStartResponse,
    RegistrationFinishRequest,
    RegistrationFinishResponse,
)
from logic.process.auth.registration.confirm_code.process import RegistrationConfirmCode
from logic.process.auth.registration.confirm_code.models import (
    RegistrationStartParams,
    RegistrationFinishParams,
)
from system.errors import ApplicationError

router = APIRouter(tags=["auth"])


@router.post("/registration-confirm-code-start")
async def registration_confirm_code_start(
    request_data: RegistrationStartRequest
) -> RegistrationStartResponse:
    print(f"[API] POST /registration-confirm-code-start | email={request_data.auth_email}, name={request_data.first_name}")
    try:
        params = RegistrationStartParams(**request_data.model_dump())
        result = await RegistrationConfirmCode.start(params)
        response = RegistrationStartResponse(**result.model_dump())
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


@router.post("/registration-confirm-code-finish")
async def registration_confirm_code_finish(
    request_data: RegistrationFinishRequest
) -> RegistrationFinishResponse:
    print(f"[API] POST /registration-confirm-code-finish | confirmation_token={request_data.confirmation_token[:8]}..., code={request_data.confirm_code}")
    try:
        params = RegistrationFinishParams(**request_data.model_dump())
        result = await RegistrationConfirmCode.finish(params)
        response = RegistrationFinishResponse(**result.model_dump())
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

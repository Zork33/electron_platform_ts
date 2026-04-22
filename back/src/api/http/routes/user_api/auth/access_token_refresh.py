from fastapi import APIRouter, HTTPException, Request

from api.http.routes.user_api.auth.models.access_token_refresh import AccessTokenRefreshResponse
from logic.service.auth.service import AuthService, AccessTokenRefreshParams
from system.errors import ApplicationError

router = APIRouter(tags=["auth"])


@router.post("/access-token-refresh")
async def access_token_refresh(request: Request) -> AccessTokenRefreshResponse:
    print(f"[API] POST /access-token-refresh")
    try:
        authorization = request.headers.get("Authorization") or ""
        params = AccessTokenRefreshParams(authorization=authorization)
        result = await AuthService.refresh_access_token(params)
        response = AccessTokenRefreshResponse(
            access_token=result.access_token,
            expires_at=result.expires_at,
        )

        print(f"[API] ✓ Response: access_token={response.access_token[:20]}..., expires_at={response.expires_at}")
        return response

    except ApplicationError as e:
        print(f"[API] ❌ ApplicationError: {e.error_code} - {e.message}")
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

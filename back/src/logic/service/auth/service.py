from dataclasses import dataclass
from datetime import datetime, timedelta, UTC, timezone
import json
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from toolkit.tool.user_auth_jwt_manager.tool import UserAuthJwtManager
from toolkit.tool.sql_db.tool import SqlDb

from system.errors import ValidationError, AuthenticationError, NotFoundError

from logic.entity.user.entity import User
from logic.entity.user_auth_confirm_code.entity import UserAuthConfirmCode
from logic.entity.user_auth_confirm_code.code_manager import CodeManager
from logic.entity.user_auth_confirm_code_settings.entity import UserAuthConfirmCodeSettings
from logic.catalog.user_auth_confirm_code_reason.catalog import UserAuthReason


@dataclass
class AuthResult:
    is_valid: bool
    user_id: int | None = None
    error_message: str | None = None
    error_response: JSONResponse | None = None

    @classmethod
    def success(cls, user_id: int) -> 'AuthResult':
        return cls(is_valid=True, user_id=user_id)

    @classmethod
    def failure(cls, error_message: str) -> 'AuthResult':
        error_response = JSONResponse(
            status_code=401,
            content={"detail": error_message}
        )
        return cls(is_valid=False, error_message=error_message, error_response=error_response)


class AccessTokenRefreshParams(BaseModel):
    authorization: str


class AccessTokenRefreshResult(BaseModel):
    access_token: str
    expires_at: datetime


class AuthService:
    @staticmethod
    async def authenticate_request(request: Request) -> AuthResult:
        try:
            jwt_manager: UserAuthJwtManager = UserAuthJwtManager.get_from_container("user_auth_jwt_manager")
            db_client: SqlDb = SqlDb.get_from_container("db")

            authorization = request.headers.get("Authorization")
            payload = await jwt_manager.validate_access_token(authorization)
            jwt_manager.check_token_expiry(payload)

            user_id = payload["user_id"]
            print(f"[AUTH] ✓ Токен валиден, user_id={user_id}")

            async with db_client.transaction_manager.transaction() as tx:
                user = await User.get(user_id, tx=tx)
                if not user:
                    raise NotFoundError(message="Пользователь не найден", error_code="USER_NOT_FOUND")

                AuthService.validate_user_session(user)
                request.state.user = user

            print(f"[AUTH] ✓ Авторизация успешна: user_id={user_id}, email={user.auth_email}")
            return AuthResult.success(user_id)

        except (AuthenticationError, NotFoundError) as e:
            print(f"[AUTH] ❌ {e.error_code}: {e.message}")
            return AuthResult.failure(e.message)
        except Exception as e:
            print(f"[AUTH] ❌ Неожиданная ошибка: {type(e).__name__}: {e}")
            return AuthResult.failure("Authorization validation error")

    @staticmethod
    async def refresh_access_token(data: AccessTokenRefreshParams) -> AccessTokenRefreshResult:
        print(f"[TOKEN REFRESH] Начало обновления токена")

        jwt_manager: UserAuthJwtManager = UserAuthJwtManager.get_from_container("user_auth_jwt_manager")
        db_client: SqlDb = SqlDb.get_from_container("db")

        payload = await jwt_manager.validate_access_token(data.authorization)
        user_id = payload["user_id"]
        print(f"[TOKEN REFRESH] ✓ user_id из токена: {user_id}")

        async with db_client.transaction_manager.transaction() as tx:
            user = await User.get(user_id, tx=tx)
            if not user:
                raise NotFoundError(message="Пользователь не найден", error_code="USER_NOT_FOUND")

            AuthService.validate_user_session(user)
            print(f"[TOKEN REFRESH] ✓ Сессия пользователя валидна")

            new_auth_session_expires_at = datetime.now(timezone.utc) + timedelta(days=jwt_manager.config.auth_session_expire_days)
            await user.update_self(tx=tx, auth_session_expires_at=new_auth_session_expires_at)
            print(f"[TOKEN REFRESH] ✓ Сессия продлена до {new_auth_session_expires_at}")

            new_access_token = await jwt_manager.create_access_token(user_id)
            access_token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=jwt_manager.config.access_token_expire_minutes)

        print(f"[TOKEN REFRESH] ✓ Токен обновлён для user_id={user_id}")
        return AccessTokenRefreshResult(access_token=new_access_token, expires_at=access_token_expires_at)

    @staticmethod
    def validate_user_session(user: User) -> None:
        if not user.has_access:
            raise AuthenticationError(
                message="Доступ пользователя запрещен",
                error_code="ACCESS_DENIED",
            )
        if user.auth_session_expires_at and datetime.now(timezone.utc) > user.auth_session_expires_at:
            raise AuthenticationError(
                message="Сессия истекла, требуется повторный вход",
                error_code="SESSION_EXPIRED",
            )

    @staticmethod
    async def authenticate_ws_token(token: str) -> AuthResult:
        try:
            jwt_manager: UserAuthJwtManager = UserAuthJwtManager.get_from_container("user_auth_jwt_manager")
            db_client: SqlDb = SqlDb.get_from_container("db")

            payload = await jwt_manager.validate_access_token(f"Bearer {token}")
            jwt_manager.check_token_expiry(payload)

            user_id = payload["user_id"]

            async with db_client.transaction_manager.transaction() as tx:
                user = await User.get(user_id, tx=tx)
                if not user:
                    raise NotFoundError(message="Пользователь не найден", error_code="USER_NOT_FOUND")

                AuthService.validate_user_session(user)

            print(f"[WS AUTH] ✓ user_id={user_id}")
            return AuthResult.success(user_id)

        except (AuthenticationError, NotFoundError) as e:
            print(f"[WS AUTH] ❌ {e.error_code}: {e.message}")
            return AuthResult.failure(e.message)
        except Exception as e:
            print(f"[WS AUTH] ❌ Неожиданная ошибка: {type(e).__name__}: {e}")
            return AuthResult.failure("Authorization validation error")

    @staticmethod
    async def create_confirm_code_for_registration(
        auth_email: str,
        first_name: str,
        last_name: str | None = None,
        middle_name: str | None = None,
        tx=None,
    ) -> UserAuthConfirmCode:
        return await AuthService._create_confirm_code(
            reason_code="REGISTRATION",
            auth_email=auth_email,
            first_name=first_name,
            last_name=last_name,
            middle_name=middle_name,
            tx=tx,
        )

    @staticmethod
    async def create_confirm_code_for_login(
        auth_email: str,
        user_id: int,
        tx=None,
    ) -> UserAuthConfirmCode:
        return await AuthService._create_confirm_code(
            reason_code="LOGIN",
            auth_email=auth_email,
            user_id=user_id,
            tx=tx,
        )

    @staticmethod
    async def _create_confirm_code(
        reason_code: str,
        auth_email: str,
        first_name: str | None = None,
        last_name: str | None = None,
        middle_name: str | None = None,
        user_id: int | None = None,
        tx=None,
    ) -> UserAuthConfirmCode:
        reason_id = await UserAuthReason.get_id_by_code(reason_code, tx=tx)
        if not reason_id:
            raise ValidationError(
                f"Причина аутентификации с кодом '{reason_code}' не найдена",
                error_code="REASON_NOT_FOUND",
            )

        results = await UserAuthConfirmCodeSettings.get_list(
            filters=[{"field": "reason_id", "value": reason_id, "operator": "="}],
            page_count=1,
            page_number=1,
            tx=tx,
        )
        settings = results[0] if results else None
        if not settings:
            raise ValidationError(
                f"Настройки для reason_id={reason_id} не найдены",
                error_code="SETTINGS_NOT_FOUND",
            )

        token = str(uuid.uuid4())
        code = CodeManager.generate_code(settings.confirm_code_alphabet, settings.confirm_code_length)
        expires_at = datetime.now(UTC) + timedelta(minutes=settings.confirm_code_ttl_minutes)

        history = [{
            "action": "create",
            "timestamp": datetime.now(UTC).isoformat(),
            "ok": True,
            "error_message": None,
        }]

        return await UserAuthConfirmCode.create({
            "user_id": user_id,
            "reason_id": reason_id,
            "auth_email": auth_email,
            "token": token,
            "confirm_code": code,
            "expires_at": expires_at,
            "first_name": first_name,
            "last_name": last_name,
            "middle_name": middle_name,
            "history": json.dumps(history),
        }, tx=tx)

from datetime import datetime, timezone, timedelta

from toolkit.abc.tool import Tool
from toolkit.adapter.abc.jwt_encoder.adapter import JwtEncoder as JwtEncoderAdapter
from system.errors import AuthenticationError
from .config import Config


class UserAuthJwtManager(Tool):
    _code = "user_auth_jwt_manager"
    _title = "User auth JWT manager"
    def __init__(self, jwt_encoder: JwtEncoderAdapter, config: Config):
        if jwt_encoder is None:
            raise ValueError("jwt_encoder не может быть None")
        if config is None:
            raise ValueError("config не может быть None")

        self._jwt_encoder = jwt_encoder
        self._config = config

    @property
    def config(self) -> Config:
        return self._config

    async def create_access_token(self, user_id: int) -> str:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=self._config.access_token_expire_minutes)
        payload = {
            "user_id": user_id,
            "expires_at": int(expires_at.timestamp()),
            "created_at": int(now.timestamp()),
        }
        return await self._jwt_encoder.encode_token(payload)

    async def validate_access_token(self, authorization: str | None) -> dict:
        if not authorization:
            raise AuthenticationError(
                message="Токен авторизации не найден",
                error_code="TOKEN_NOT_FOUND",
            )

        try:
            scheme, token = authorization.split()
            if scheme.lower() != "bearer":
                raise ValueError()
        except ValueError:
            raise AuthenticationError(
                message="Неверный формат токена авторизации",
                error_code="INVALID_TOKEN_FORMAT",
            )

        payload = await self._jwt_encoder.decode_token(token)
        if not payload:
            raise AuthenticationError(
                message="Невалидный токен",
                error_code="INVALID_TOKEN",
            )

        if not payload.get("expires_at"):
            raise AuthenticationError(
                message="Токен не содержит срок действия",
                error_code="TOKEN_MISSING_EXPIRY",
            )

        if not payload.get("user_id"):
            raise AuthenticationError(
                message="Токен не содержит идентификатор пользователя",
                error_code="TOKEN_MISSING_USER_ID",
            )

        return payload

    def check_token_expiry(self, payload: dict) -> None:
        expires_at = payload.get("expires_at")
        if datetime.now(timezone.utc).timestamp() >= expires_at:
            raise AuthenticationError(
                message="Токен истёк",
                error_code="TOKEN_EXPIRED",
            )


def get_user_auth_jwt_manager() -> UserAuthJwtManager:
    return UserAuthJwtManager.get_from_container("user_auth_jwt_manager")

import jwt

from toolkit.abc.adapter import Adapter
from toolkit.adapter.abc.jwt_encoder.adapter import JwtEncoder
from toolkit.adapter.abc.jwt_encoder.config import Config as JwtEncoderConfig


class JwtEncoderPyJwt(Adapter, JwtEncoder):
    _code = "py_jwt"
    _title = "PyJWT"
    def __init__(self, config: JwtEncoderConfig):
        self._config = config

    async def encode_token(self, payload: dict) -> str:
        encoded_jwt = jwt.encode(
            payload,
            self._config.secret_key,
            algorithm=self._config.algorithm_type
        )
        return encoded_jwt

    async def decode_token(self, token: str) -> dict | None:
        try:
            payload = jwt.decode(
                token,
                self._config.secret_key,
                algorithms=[self._config.algorithm_type]
            )
            return payload
        except jwt.PyJWTError as e:
            print(f"JWT decoding/validation failed: {e}")
            return None

    async def decode_token_ignore_expiry(self, token: str) -> dict | None:
        """Decode JWT token without verifying expiration (for refresh operations)"""
        try:
            payload = jwt.decode(
                token,
                self._config.secret_key,
                algorithms=[self._config.algorithm_type],
                options={"verify_exp": False}
            )
            return payload
        except jwt.PyJWTError as e:
            print(f"JWT decoding failed (ignoring expiry): {e}")
            return None



    @property
    def config(self) -> JwtEncoderConfig:
        return self._config


def get_user_auth_jwt_encoder() -> JwtEncoderPyJwt:
    return JwtEncoderPyJwt.get_from_container("user_auth_jwt_encoder")

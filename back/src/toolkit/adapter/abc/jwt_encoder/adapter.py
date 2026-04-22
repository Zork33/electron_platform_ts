from abc import abstractmethod

from toolkit.abc.abstract_adapter import AbstractAdapter

from .config import Config as JwtEncoderConfig


class JwtEncoder(AbstractAdapter):
    _code = "jwt_encoder"
    _title = "JWT encoder"
    def __init__(self, config: JwtEncoderConfig):
        pass

    @abstractmethod
    async def encode_token(self, payload: dict) -> str:
        pass

    @abstractmethod
    async def decode_token(self, token: str) -> dict | None:
        pass

    @abstractmethod
    async def decode_token_ignore_expiry(self, token: str) -> dict | None:
        pass

    @property
    @abstractmethod
    def config(self) -> JwtEncoderConfig:
        pass
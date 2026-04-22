from pydantic import Field

from toolkit.abc.config import Config


class ConnectionConfig(Config):
    token: str = Field(min_length=1)
    username: str | None = None
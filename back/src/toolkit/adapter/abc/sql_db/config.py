from pydantic import Field

from toolkit.abc.config import Config


class ConnectionConfig(Config):
    host: str = Field(min_length=1)
    port: int = Field(gt=0)
    name: str = Field(min_length=1)
    user: str = Field(min_length=1)
    password: str = Field(min_length=1)
    pool_min_size: int = Field(ge=1)
    pool_max_size: int = Field(le=20)

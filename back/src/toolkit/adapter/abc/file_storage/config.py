from pydantic import Field

from toolkit.abc.config import Config


class ConnectionConfig(Config):
    host: str = Field(min_length=1)
    port: int = Field(gt=0)
    login: str = Field(min_length=1)
    password: str = Field(min_length=1)
    use_ssl: bool = False

from pydantic import Field

from toolkit.abc.config import Config as ToolkitConfig


class Config(ToolkitConfig):
    secret_key: str = Field(min_length=1)
    algorithm_type: str = Field(min_length=1)

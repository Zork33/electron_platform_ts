from pydantic import Field

from toolkit.abc.config import Config as ToolkitConfig


class Config(ToolkitConfig):
    access_token_expire_minutes: int = Field(ge=1)
    auth_session_expire_days: int = Field(ge=1)

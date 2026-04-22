import os
from toolkit.tool.user_auth_jwt_manager.config import Config


def config() -> Config:
    access_token_expire_minutes = int(os.environ.get("USER_AUTH_ACCESS_TOKEN_EXPIRE_MINUTES"))
    auth_session_expire_days = int(os.environ.get("USER_AUTH_SESSION_EXPIRE_DAYS"))

    return Config(
        access_token_expire_minutes=access_token_expire_minutes,
        auth_session_expire_days=auth_session_expire_days,
    )

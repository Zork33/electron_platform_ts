import os
from toolkit.adapter.abc.jwt_encoder.config import Config


def config() -> Config:
    secret_key = os.environ.get("USER_AUTH_JWT_SECRET_KEY")
    algorithm_type = os.environ.get("USER_AUTH_JWT_ALGORITHM_TYPE")
    
    if not all([secret_key, algorithm_type]):
        raise ValueError("Не указаны необходимые параметры для JWT encoder (USER_AUTH_JWT_SECRET_KEY, USER_AUTH_JWT_ALGORITHM_TYPE)")
    
    return Config(
        secret_key=secret_key,
        algorithm_type=algorithm_type
    )

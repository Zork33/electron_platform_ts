from configs import user_auth_jwt_encoder as encoder_config
from configs import user_auth_jwt_manager as manager_config
from toolkit.tool.user_auth_jwt_manager.tool import UserAuthJwtManager
from toolkit.adapter.jwt_encoder_py_jwt.adapter import JwtEncoderPyJwt


def create_user_auth_jwt_manager() -> UserAuthJwtManager:
    try:
        encoder = JwtEncoderPyJwt("user_auth_jwt_encoder", config=encoder_config.config())
        jwt_manager = UserAuthJwtManager(
            "user_auth_jwt_manager",
            jwt_encoder=encoder,
            config=manager_config.config()
        )
        print("UserAuthJwtManager initialized successfully")
        return jwt_manager

    except Exception as e:
        print(f"Критическая ошибка при инициализации UserAuthJwtManager: {e}")
        raise

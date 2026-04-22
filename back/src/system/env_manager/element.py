from enum import Enum
from dotenv import load_dotenv
from pathlib import Path
import os

from system.abc.system_element import SystemElement


class Environment(Enum):
    DEVELOPMENT = "dev"
    TESTING = "test"
    STAGING = "staging"
    PRODUCTION = "prod"


class EnvManager(SystemElement):
    def load_env(self, path: str = None) -> None:
        if path:
            env_path = Path(path)
        else:
            env_path = (
                Path(__file__).resolve()
                .parent
                .parent
                .parent
                .parent
            )
        env_file = env_path / '.env' if env_path.is_dir() else env_path

        load_dotenv(dotenv_path=str(env_file))

        if os.getenv('CHECK') != 'ok':
            raise RuntimeError(
                "\n"
                "========================================================================================\n"
                "Ошибка при загрузке переменных окружения!\n"
                "Отсутствует или некорректно установлена переменная CHECK в .env, приложение остановлено!\n"
                "========================================================================================\n"
            )
    
    @property
    def environment(self) -> Environment:
        env_value = os.getenv('ENVIRONMENT')
        
        if env_value is None:
            raise RuntimeError("Переменная окружения ENVIRONMENT не установлена")
        
        env_value = env_value.lower()
        
        for env_type in Environment:
            if env_type.value == env_value:
                return env_type
        
        available_envs = ', '.join([env.value for env in Environment])
        raise RuntimeError(f"Неизвестное значение ENVIRONMENT: '{env_value}'. Доступные варианты: {available_envs}")
    
    def is_development(self) -> bool:
        return self.environment == Environment.DEVELOPMENT
    
    def is_testing(self) -> bool:
        return self.environment == Environment.TESTING
    
    def is_staging(self) -> bool:
        return self.environment == Environment.STAGING
    
    def is_production(self) -> bool:
        return self.environment == Environment.PRODUCTION

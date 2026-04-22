from system.env_manager.element import EnvManager


def create_env_manager():
    env_manager: EnvManager = EnvManager("env_manager")
    return env_manager


def load_env():
    env_manager: EnvManager = EnvManager.get_from_container("env_manager")
    if env_manager:
        env_manager.load_env()
        print(f"Env loaded successfully. Environment: {env_manager.environment.value}")
    else:
        print("Env manager not found")

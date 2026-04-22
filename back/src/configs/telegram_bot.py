import os

from toolkit.adapter.abc.telegram_bot.config import ConnectionConfig


def connection() -> ConnectionConfig:
    return ConnectionConfig(
        token=os.environ.get("TELEGRAM_BOT_DI_LOUNGE_TOKEN"),
        username=os.environ.get("TELEGRAM_BOT_DI_LOUNGE_USERNAME"),
    )

from telegram.ext import Application
from toolkit.adapter.abc.telegram_bot.application_manager import ApplicationManager as AbstractApplicationManager


class ApplicationManager(AbstractApplicationManager):
    def __init__(self, token: str):
        self._token = token
        self._application = None

    @property
    def application(self):
        return self._application

    def build_application(self):
        self._application = Application.builder().token(self._token).build()

    async def start(self):
        if self._application is None:
            raise ValueError("Application не инициализирован")
        await self._application.initialize()
        await self._application.start()
        await self._application.updater.start_polling()

    async def stop(self):
        if self._application is None:
            raise ValueError("Application не инициализирован")
        await self._application.updater.stop()
        await self._application.stop()

    async def shutdown(self):
        if self._application is None:
            raise ValueError("Application не инициализирован")
        await self._application.shutdown()

    async def health_check(self):
        if self._application is None:
            return False
        try:
            await self._application.bot.get_me()
            return True
        except Exception:
            return False
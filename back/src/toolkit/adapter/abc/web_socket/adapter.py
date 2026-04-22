from abc import abstractmethod
from typing import Any

from toolkit.abc.abstract_adapter import AbstractAdapter


class WebSocket(AbstractAdapter):
    _code = "web_socket"
    _title = "WebSocket"

    @abstractmethod
    async def send(self, ws: Any, payload: dict) -> None:
        pass

    @abstractmethod
    async def close(self, ws: Any) -> None:
        pass

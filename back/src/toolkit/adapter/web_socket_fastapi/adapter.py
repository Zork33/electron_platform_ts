from starlette.websockets import WebSocket

from toolkit.abc.adapter import Adapter
from toolkit.adapter.abc.web_socket.adapter import WebSocket as AbstractWebSocket


class WebSocketFastApi(Adapter, AbstractWebSocket):
    _code = "fastapi"
    _title = "FastAPI"

    def __init__(self):
        pass

    async def send(self, ws: WebSocket, payload: dict) -> None:
        await ws.send_json(payload)

    async def close(self, ws: WebSocket) -> None:
        await ws.close()

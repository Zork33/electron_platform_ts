from fastapi.websockets import WebSocket as WsConnection

from toolkit.tool.web_socket.tool import WebSocket


class Dispatcher:
    def __init__(self, ws: WebSocket):
        self._ws = ws

    async def dispatch(self, ws_conn: WsConnection, user_id: int, data: dict) -> None:
        msg_type = data.get("type")

        if msg_type == "pong":
            self._ws.handle_pong(ws_conn)
        else:
            print(f"ws unknown message type: user_id={user_id}, type={msg_type}")

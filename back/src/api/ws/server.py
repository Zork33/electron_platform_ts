from fastapi import FastAPI
from fastapi.websockets import WebSocket as WsConnection, WebSocketDisconnect

from api.http.abc.api_element import ApiElement
from api.ws.dispatcher import Dispatcher
from logic.service.auth.service import AuthService
from toolkit.tool.web_socket.tool import WebSocket


class Server(ApiElement):
    def __init__(self, app: FastAPI):
        self._app = app

    @property
    def _ws(self) -> WebSocket:
        return WebSocket.get_from_container("web_socket")

    @property
    def _dispatcher(self) -> Dispatcher:
        return Dispatcher(self._ws)

    def setup(self) -> None:
        self._app.add_api_websocket_route("/ws", self._endpoint)

    async def _endpoint(self, ws_conn: WsConnection, token: str):
        user_id = await self.authenticate(ws_conn, token)
        if user_id is None:
            return

        ws = self._ws
        dispatcher = Dispatcher(ws)

        client_ip = ws_conn.client.host if ws_conn.client else None
        user_agent = ws_conn.headers.get("user-agent")
        await ws.connect(user_id, ws_conn, client_ip=client_ip, user_agent=user_agent)

        try:
            while True:
                data: dict = await ws_conn.receive_json()
                await dispatcher.dispatch(ws_conn, user_id, data)
        except WebSocketDisconnect:
            pass
        except Exception as e:
            print(f"ws error: user_id={user_id}, error={e}")
        finally:
            await ws.disconnect(user_id, ws_conn)

    async def authenticate(self, ws_conn: WsConnection, token: str) -> int | None:
        await ws_conn.accept()

        auth_result = await AuthService.authenticate_ws_token(token)
        if not auth_result.is_valid:
            await ws_conn.close(code=4001)
            return None

        return auth_result.user_id

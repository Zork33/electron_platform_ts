from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from toolkit.tool.web_socket.tool import WebSocket

router = APIRouter(tags=["web-socket"])


class DebugMessageRequest(BaseModel):
    message: str = ""


@router.get("/pool")
async def get_pool_info():
    """Получить информацию о пуле WebSocket-соединений"""
    try:
        ws: WebSocket = WebSocket.get_from_container("web_socket")
        return ws.pool_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-all")
async def send_to_all(body: DebugMessageRequest):
    """Отправить debug-сообщение всем активным соединениям"""
    try:
        ws: WebSocket = WebSocket.get_from_container("web_socket")
        payload = {"type": "debug", "target": "all", "message": body.message}
        await ws.broadcast_all(payload)
        return {"sent": True, "target": "all"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-user/{user_id}")
async def send_to_user(user_id: int, body: DebugMessageRequest):
    """Отправить debug-сообщение всем соединениям конкретного пользователя"""
    try:
        ws: WebSocket = WebSocket.get_from_container("web_socket")
        payload = {"type": "debug", "target": "user", "user_id": user_id, "message": body.message}
        await ws.send_to_user(user_id, payload)
        return {"sent": True, "target": "user", "user_id": user_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-connection/{conn_id}")
async def send_to_connection(conn_id: int, body: DebugMessageRequest):
    """Отправить debug-сообщение в конкретное соединение"""
    try:
        ws: WebSocket = WebSocket.get_from_container("web_socket")
        payload = {"type": "debug", "target": "connection", "conn_id": conn_id, "message": body.message}
        await ws.send_to_connection(conn_id, payload)
        return {"sent": True, "target": "connection", "conn_id": conn_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

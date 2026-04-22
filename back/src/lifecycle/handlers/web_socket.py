from toolkit.adapter.web_socket_fastapi.adapter import WebSocketFastApi
from toolkit.tool.web_socket.tool import WebSocket


async def create_web_socket():
    try:
        adapter = WebSocketFastApi("web_socket_adapter")
        ws = WebSocket("web_socket", adapter=adapter)
        await ws.start()
        print("WebSocket initialized successfully")
    except Exception as e:
        print(f"Критическая ошибка при инициализации WebSocket: {e}")
        raise


async def stop_web_socket():
    try:
        ws: WebSocket = WebSocket.get_from_container("web_socket")
        await ws.stop()
        print("WebSocket остановлен")
    except Exception as e:
        print(f"Ошибка при остановке WebSocket: {e}")

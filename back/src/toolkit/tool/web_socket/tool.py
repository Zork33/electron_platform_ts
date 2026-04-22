import asyncio
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from toolkit.abc.tool import Tool
from toolkit.adapter.abc.web_socket.adapter import WebSocket as WebSocketAdapter

_PING_PAYLOAD = {"type": "ping"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class WebSocket(Tool):
    _code = "web_socket"
    _title = "WebSocket"

    def __init__(
        self,
        adapter: WebSocketAdapter,
        ping_interval: int = 30,
        ping_timeout: int = 10,
    ):
        if adapter is None:
            raise ValueError("adapter cannot be None")

        self._adapter = adapter
        self._ping_interval = ping_interval
        self._ping_timeout = ping_timeout

        self._pool: dict[int, set[Any]] = defaultdict(set)
        self._conn_meta: dict[Any, dict] = {}
        self._conn_by_id: dict[int, Any] = {}
        self._last_pong: dict[Any, float] = {}
        self._conn_counter: int = 0

        self._ping_task: asyncio.Task | None = None

    def _next_conn_id(self) -> int:
        self._conn_counter += 1
        return self._conn_counter

    async def connect(
        self,
        user_id: int,
        ws: Any,
        *,
        client_ip: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        conn_id = self._next_conn_id()
        self._pool[user_id].add(ws)
        self._last_pong[ws] = time.monotonic()
        self._conn_meta[ws] = {
            "conn_id": conn_id,
            "user_id": user_id,
            "connected_at": _now_iso(),
            "client_ip": client_ip,
            "user_agent": user_agent,
            "last_ping_at": None,
            "last_pong_at": None,
        }
        self._conn_by_id[conn_id] = ws
        print(f"ws connected: user_id={user_id}, connections={len(self._pool[user_id])}")

    async def disconnect(self, user_id: int, ws: Any) -> None:
        self._pool[user_id].discard(ws)
        self._last_pong.pop(ws, None)
        meta = self._conn_meta.pop(ws, None)
        if meta:
            self._conn_by_id.pop(meta["conn_id"], None)

        if not self._pool[user_id]:
            del self._pool[user_id]

        try:
            await self._adapter.close(ws)
        except Exception:
            pass

        print(f"ws disconnected: user_id={user_id}")

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        for ws in list(self._pool.get(user_id, set())):
            try:
                await self._adapter.send(ws, payload)
            except Exception as exc:
                print(f"send failed for user_id={user_id}, closing: {exc}")
                await self.disconnect(user_id, ws)

    async def send_to_connection(self, conn_id: int, payload: dict) -> None:
        ws = self._conn_by_id.get(conn_id)
        if ws is None:
            return
        meta = self._conn_meta.get(ws, {})
        user_id = meta.get("user_id")
        try:
            await self._adapter.send(ws, payload)
        except Exception as exc:
            print(f"send failed for conn_id={conn_id}, closing: {exc}")
            if user_id is not None:
                await self.disconnect(user_id, ws)

    async def broadcast_to_users(self, user_ids: list[int], payload: dict) -> None:
        for user_id in user_ids:
            await self.send_to_user(user_id, payload)

    async def broadcast_all(self, payload: dict) -> None:
        await self.broadcast_to_users(list(self._pool.keys()), payload)

    def handle_pong(self, ws: Any) -> None:
        if ws in self._last_pong:
            self._last_pong[ws] = time.monotonic()
            if ws in self._conn_meta:
                self._conn_meta[ws]["last_pong_at"] = _now_iso()

    def pool_info(self) -> dict:
        connections = [dict(meta) for meta in self._conn_meta.values()]
        connections.sort(key=lambda c: c["conn_id"])
        return {
            "total_users": len(self._pool),
            "total_connections": len(self._conn_meta),
            "ping_interval": self._ping_interval,
            "ping_timeout": self._ping_timeout,
            "connections": connections,
        }

    async def start(self) -> None:
        if self._ping_task is None or self._ping_task.done():
            self._ping_task = asyncio.create_task(self._ping_loop())

    async def stop(self) -> None:
        if self._ping_task and not self._ping_task.done():
            self._ping_task.cancel()
            try:
                await self._ping_task
            except asyncio.CancelledError:
                pass

    async def health_check(self) -> bool:
        return self._ping_task is not None and not self._ping_task.done()

    async def _ping_loop(self) -> None:
        while True:
            await asyncio.sleep(self._ping_interval)
            await self._run_ping_round()

    async def _run_ping_round(self) -> None:
        ping_sent_at = time.monotonic()
        ping_sent_iso = _now_iso()

        for user_id, connections in list(self._pool.items()):
            for ws in list(connections):
                try:
                    await self._adapter.send(ws, _PING_PAYLOAD)
                    if ws in self._conn_meta:
                        self._conn_meta[ws]["last_ping_at"] = ping_sent_iso
                except Exception as exc:
                    print(f"ping send failed for user_id={user_id}: {exc}")
                    await self.disconnect(user_id, ws)

        await asyncio.sleep(self._ping_timeout)

        for user_id, connections in list(self._pool.items()):
            for ws in list(connections):
                if self._last_pong.get(ws, 0) < ping_sent_at:
                    print(f"ping timeout for user_id={user_id}, closing connection")
                    await self.disconnect(user_id, ws)

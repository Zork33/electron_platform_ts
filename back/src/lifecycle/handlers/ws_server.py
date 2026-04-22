from fastapi import FastAPI

from api.ws.server import Server


def ws_server(app: FastAPI) -> None:
    server = Server("ws_server", app)
    server.setup()

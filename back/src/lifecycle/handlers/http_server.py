from fastapi import FastAPI
from api.http.server.element import Server


def http_web_server(app: FastAPI) -> None:
    server = Server("http_server", app)
    server.setup()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


class CORS:
    _allowed_origins = [
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:8081",
    ]
    
    def __init__(self, app: FastAPI):
        self._app = app
    
    def setup(self) -> None:
        self._app.add_middleware(
            CORSMiddleware,
            allow_origins=self._allowed_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

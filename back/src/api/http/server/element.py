from fastapi import FastAPI

from api.http.abc.api_element import ApiElement
from .cors import CORS
from .middleware import Middleware
from .exception_handler import ExceptionHandler
from .router import Router


class Server(ApiElement):
    CORS = CORS
    Middleware = Middleware
    ExceptionHandler = ExceptionHandler
    Router = Router
    
    def __init__(self, app: FastAPI):
        self._app = app
        self._cors = self.CORS(self._app)
        self._middleware = self.Middleware(self._app)
        self._exception_handler = self.ExceptionHandler(self._app)
        self._router = self.Router(self._app)
    
    @property
    def app(self) -> FastAPI:
        return self._app
    
    @property
    def cors(self) -> CORS:
        return self._cors
    
    @property
    def middleware(self) -> Middleware:
        return self._middleware
    
    @property
    def exception_handler(self) -> ExceptionHandler:
        return self._exception_handler
    
    @property
    def router(self) -> Router:
        return self._router
    
    def setup(self) -> None:
        self._cors.setup()
        self._middleware.setup()
        self._exception_handler.setup()
        self._router.setup()
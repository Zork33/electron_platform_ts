from fastapi import FastAPI, APIRouter
from api.http.routes.user_api.router import router as user_api_router
from api.http.routes.dev_api.router import router as dev_api_router


class Router:
    def __init__(self, app: FastAPI):
        self._app = app
        self._main_router = APIRouter()
    
    def setup(self) -> None:
        self._setup_user_api()
        self._setup_dev_api()
        
        self._app.include_router(self._main_router)
    
    def _setup_user_api(self) -> None:
        self._main_router.include_router(user_api_router, prefix="/user-api")
    
    def _setup_dev_api(self) -> None:
        self._main_router.include_router(dev_api_router, prefix="/dev-api")

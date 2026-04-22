from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

from logic.service.auth.service import AuthService

CallNext = Callable[[Request], Awaitable[Response]]
MiddlewareHandler = Callable[[Request, CallNext], Awaitable[Response]]


class Middleware:
    def __init__(self, app: FastAPI):
        self._app = app
    
    def setup(self) -> None:
        self._app.middleware("http")(self._main_middleware)
    
    async def _main_middleware(self, request: Request, call_next: CallNext) -> Response:
        path = request.url.path
        handlers: tuple[tuple[str, MiddlewareHandler], ...] = (
            ("/user-api/auth/", self._handle_user_auth_api),
            ("/user-api/", self._handle_user_api),
            ("/system-api/auth/", self._handle_system_auth_api),
            ("/system-api/", self._handle_system_api),
            ("/public-api/", self._handle_public_api),
            ("/dev-api/", self._handle_dev_api),
        )
        
        for prefix, handler in handlers:
            if path.startswith(prefix):
                return await handler(request, call_next)
        
        return await call_next(request)
    
    async def _passthrough_handler(self, request: Request, call_next: CallNext) -> Response:
        return await call_next(request)
    
    async def _handle_user_auth_api(self, request: Request, call_next: CallNext) -> Response:
        return await self._passthrough_handler(request, call_next)

    async def _handle_user_api(self, request: Request, call_next: CallNext) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)
        
        auth_result = await AuthService.authenticate_request(request)
        
        if not auth_result.is_valid:
            return auth_result.error_response
        
        return await call_next(request)
    
    async def _handle_system_auth_api(self, request: Request, call_next: CallNext) -> Response:
        return await self._passthrough_handler(request, call_next)
    
    async def _handle_system_api(self, request: Request, call_next: CallNext) -> Response:
        return await self._passthrough_handler(request, call_next)
    
    async def _handle_public_api(self, request: Request, call_next: CallNext) -> Response:
        return await self._passthrough_handler(request, call_next)
    
    async def _handle_dev_api(self, request: Request, call_next: CallNext) -> Response:
        return await self._passthrough_handler(request, call_next)
    
    

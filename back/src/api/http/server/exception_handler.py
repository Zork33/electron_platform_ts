import traceback
from datetime import datetime

from asyncpg.exceptions import UniqueViolationError
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from configs import error_report_email as error_report_config
from system.errors import ApplicationError
from toolkit.tool.email_sender.tool import EmailSender


def _unique_violation_message(exc: UniqueViolationError) -> str:
    """Возвращает человекочитаемое сообщение для нарушения уникальности."""
    return "Запись с таким значением уже существует"


class ExceptionHandler:
    def __init__(self, app: FastAPI):
        self._app = app

    def setup(self) -> None:
        self._app.exception_handler(RequestValidationError)(
            self._handle_validation_error
        )
        self._app.exception_handler(ApplicationError)(
            self._handle_application_error
        )
        self._app.exception_handler(UniqueViolationError)(
            self._handle_unique_violation
        )
        self._app.exception_handler(Exception)(
            self._handle_general_error
        )
    
    async def _handle_validation_error(
        self, 
        request: Request, 
        exc: RequestValidationError
    ) -> JSONResponse:
        errors = [
            {
                'field': error['loc'][-1] if error['loc'] else None,
                'msg': error['msg'],
                'type': error['type']
            }
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={"detail": "Ошибка валидации данных", "errors": errors}
        )
    
    async def _handle_application_error(
        self,
        request: Request,
        exc: ApplicationError
    ) -> JSONResponse:
        content = {
            "detail": exc.message,
            "error_code": exc.error_code
        }
        if exc.meta:
            content["meta"] = exc.meta

        return JSONResponse(
            status_code=exc.http_status,
            content=content
        )

    async def _handle_unique_violation(
        self,
        request: Request,
        exc: UniqueViolationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content={"detail": _unique_violation_message(exc)}
        )

    async def _handle_general_error(
        self, 
        request: Request, 
        exc: Exception
    ) -> JSONResponse:
        try:
            await self._send_error_report(request, exc)
        except Exception:
            pass
        
        return JSONResponse(
            status_code=500,
            content={"detail": "Возникла непредвиденная ошибка"}
        )
    
    async def _send_error_report(self, request: Request, exc: Exception) -> None:
        config = error_report_config.config()
        
        if not config.enabled:
            return
        
        email_sender: EmailSender = EmailSender.get_from_container("email_sender")
        
        subject = f"[ERROR] {type(exc).__name__}: {request.method} {request.url.path}"
        
        body_parts = [
            f"Время: {datetime.now().isoformat()}",
            f"URL: {request.url}",
            f"Метод: {request.method}",
            f"Исключение: {type(exc).__name__}",
            f"Сообщение: {str(exc)}",
            "",
            "Traceback:",
            traceback.format_exc(),
        ]
        
        try:
            headers = dict(request.headers)
            headers.pop("authorization", None)
            headers.pop("cookie", None)
            body_parts.insert(4, f"Headers: {headers}")
        except Exception:
            pass
        
        body = "\n".join(body_parts)
        
        await email_sender.send_message(
            to=[config.recipient_email],
            subject=subject,
            body=body
        )

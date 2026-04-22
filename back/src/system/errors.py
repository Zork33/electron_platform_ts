class ApplicationError(Exception):
    error_code: str = "APPLICATION_ERROR"
    http_status: int = 500
    message: str | None
    meta: dict | None

    def __init__(self, message: str | None = None, error_code: str | None = None, meta: dict | None = None):
        self.message = message or self.__class__.__name__
        self.error_code = error_code or self.error_code
        self.meta = meta
        super().__init__(self.message)


class ValidationError(ApplicationError):
    error_code = "VALIDATION_ERROR"
    http_status = 422


class ResourceConflictError(ApplicationError):
    error_code = "RESOURCE_CONFLICT"
    http_status = 409


class RateLimitError(ApplicationError):
    error_code = "RATE_LIMIT"
    http_status = 429


class NotFoundError(ApplicationError):
    error_code = "NOT_FOUND"
    http_status = 404


class ForbiddenError(ApplicationError):
    error_code = "FORBIDDEN"
    http_status = 403


class ProviderTemporaryError(ApplicationError):
    error_code = "PROVIDER_TEMPORARY_ERROR"
    http_status = 503


class ProviderPermanentError(ApplicationError):
    error_code = "PROVIDER_PERMANENT_ERROR"
    http_status = 400


class InternalError(ApplicationError):
    error_code = "INTERNAL_ERROR"
    http_status = 500


class EmailSendingError(ApplicationError):
    error_code = "EMAIL_SENDING_ERROR"
    http_status = 500


class AuthenticationError(ApplicationError):
    error_code = "AUTHENTICATION_ERROR"
    http_status = 401


class ExpiredError(ApplicationError):
    error_code = "EXPIRED"
    http_status = 410


class AttemptsExceededError(ApplicationError):
    error_code = "ATTEMPTS_EXCEEDED"
    http_status = 429

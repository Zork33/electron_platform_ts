import type { Response } from 'express'

export interface ApiErrorDetail {
  error_message: string
  error_code: string
  meta?: Record<string, unknown> | null
}

export interface ApiErrorBody {
  detail: ApiErrorDetail
}

export class ApplicationError extends Error {
  readonly error_code: string
  readonly http_status: number
  readonly meta: Record<string, unknown> | null

  constructor(message: string | null = null, errorCode = 'APPLICATION_ERROR', httpStatus = 500, meta: Record<string, unknown> | null = null) {
    super(message ?? 'ApplicationError')
    this.name = this.constructor.name
    this.error_code = errorCode
    this.http_status = httpStatus
    this.meta = meta
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string | null = null, meta: Record<string, unknown> | null = null) {
    super(message, 'VALIDATION_ERROR', 422, meta)
  }
}

export class ResourceConflictError extends ApplicationError {
  constructor(message: string | null = null, meta: Record<string, unknown> | null = null) {
    super(message, 'RESOURCE_CONFLICT', 409, meta)
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message: string | null = null, meta: Record<string, unknown> | null = null) {
    super(message, 'RATE_LIMIT', 429, meta)
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string | null = null, meta: Record<string, unknown> | null = null) {
    super(message, 'NOT_FOUND', 404, meta)
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message: string | null = null, meta: Record<string, unknown> | null = null) {
    super(message, 'FORBIDDEN', 403, meta)
  }
}

export class ProviderTemporaryError extends ApplicationError {
  constructor(message: string | null = null, meta: Record<string, unknown> | null = null) {
    super(message, 'PROVIDER_TEMPORARY_ERROR', 503, meta)
  }
}

export class ProviderPermanentError extends ApplicationError {
  constructor(message: string | null = null, meta: Record<string, unknown> | null = null) {
    super(message, 'PROVIDER_PERMANENT_ERROR', 400, meta)
  }
}

export class InternalError extends ApplicationError {
  constructor(message: string | null = null, meta: Record<string, unknown> | null = null) {
    super(message, 'INTERNAL_ERROR', 500, meta)
  }
}

export class EmailSendingError extends ApplicationError {
  constructor(message: string | null = null, meta: Record<string, unknown> | null = null) {
    super(message, 'EMAIL_SENDING_ERROR', 500, meta)
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message: string | null = null, meta: Record<string, unknown> | null = null) {
    super(message, 'AUTHENTICATION_ERROR', 401, meta)
  }
}

export class ExpiredError extends ApplicationError {
  constructor(message: string | null = null, meta: Record<string, unknown> | null = null) {
    super(message, 'EXPIRED', 410, meta)
  }
}

export class AttemptsExceededError extends ApplicationError {
  constructor(message: string | null = null, meta: Record<string, unknown> | null = null) {
    super(message, 'ATTEMPTS_EXCEEDED', 429, meta)
  }
}

export const serializeApiError = (error: ApplicationError): ApiErrorBody => ({
  detail: {
    error_message: error.message,
    error_code: error.error_code,
    meta: error.meta,
  },
})

const respond = (res: Response, error: ApplicationError) => res.status(error.http_status).json(serializeApiError(error))

export const badRequest = (res: Response, error_message: string, error_code = 'VALIDATION_ERROR', meta: Record<string, unknown> | null = null) =>
  respond(res, new ApplicationError(error_message, error_code, 400, meta))

export const validationError = (res: Response, error_message: string, error_code = 'VALIDATION_ERROR', meta: Record<string, unknown> | null = null) =>
  respond(res, new ApplicationError(error_message, error_code, 422, meta))

export const notFound = (res: Response, error_message: string, error_code = 'NOT_FOUND', meta: Record<string, unknown> | null = null) =>
  respond(res, new ApplicationError(error_message, error_code, 404, meta))

export const unauthorized = (res: Response, error_message: string, error_code = 'AUTHENTICATION_ERROR', meta: Record<string, unknown> | null = null) =>
  respond(res, new ApplicationError(error_message, error_code, 401, meta))

export const conflict = (res: Response, error_message: string, error_code = 'RESOURCE_CONFLICT', meta: Record<string, unknown> | null = null) =>
  respond(res, new ApplicationError(error_message, error_code, 409, meta))

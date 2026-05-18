import type { Response } from 'express'

export interface ApiErrorDetail {
  error_message: string
  error_code: string
  meta?: Record<string, unknown> | null
}

const respond = (res: Response, httpStatus: number, error_code: string, error_message: string, meta: Record<string, unknown> | null = null) =>
  res.status(httpStatus).json({ detail: { error_message, error_code, meta } })

export const badRequest = (res: Response, error_message: string, error_code = 'VALIDATION_ERROR', meta: Record<string, unknown> | null = null) =>
  respond(res, 400, error_code, error_message, meta)

export const notFound = (res: Response, error_message: string, error_code = 'NOT_FOUND', meta: Record<string, unknown> | null = null) =>
  respond(res, 404, error_code, error_message, meta)

export const unauthorized = (res: Response, error_message: string, error_code = 'AUTHENTICATION_ERROR', meta: Record<string, unknown> | null = null) =>
  respond(res, 401, error_code, error_message, meta)

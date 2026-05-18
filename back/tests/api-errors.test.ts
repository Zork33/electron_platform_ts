import { describe, expect, test } from 'vitest'
import {
  ApplicationError,
  AuthenticationError,
  ExpiredError,
  NotFoundError,
  serializeApiError,
  ValidationError,
} from '../src/api-errors.js'

describe('api errors', () => {
  test('serializes python-compatible error payloads', () => {
    const error = new ValidationError('bad input', { field: 'name' })

    expect(error.error_code).toBe('VALIDATION_ERROR')
    expect(error.http_status).toBe(422)
    expect(serializeApiError(error)).toEqual({
      detail: {
        error_message: 'bad input',
        error_code: 'VALIDATION_ERROR',
        meta: { field: 'name' },
      },
    })
  })

  test('exposes python error code/status defaults', () => {
    const notFound = new NotFoundError('missing entity')
    const auth = new AuthenticationError('token missing')
    const expired = new ExpiredError('expired token')
    const generic = new ApplicationError('boom')

    expect(notFound.http_status).toBe(404)
    expect(auth.http_status).toBe(401)
    expect(expired.http_status).toBe(410)
    expect(generic.error_code).toBe('APPLICATION_ERROR')
    expect(generic.http_status).toBe(500)
  })
})

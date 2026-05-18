import { beforeEach, describe, expect, test } from 'vitest'
import { AuthService } from '../src/auth-service.js'
import type { User } from '../src/types.js'

const users = new Map<number, User>()

const auth = new AuthService({
  getUserById: (userId) => users.get(userId) ?? null,
  patchUser: (userId, patch) => {
    const current = users.get(userId)
    if (!current) return
    users.set(userId, { ...current, ...patch })
  },
})

beforeEach(() => {
  auth.reset()
  users.clear()
  users.set(1, {
    id: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    deleted_at: null,
    person_id: null,
    auth_email: 'demo@example.com',
    has_access: true,
    is_admin: false,
    session_expires_at: null,
    avatar_id: null,
    auth_telegram_id: null,
  })
})

describe('auth service', () => {
  test('confirmation lifecycle records history', () => {
    const confirmation = auth.createConfirmation('login', { auth_email: 'demo@example.com' })
    expect(confirmation.history[0].action).toBe('create')
    expect(confirmation.confirm_code).toMatch(/^\d{6}$/)
    expect(auth.markConfirmationSent(confirmation.token, true)?.sending_attempts_count).toBe(1)
    expect(auth.verifyConfirmation(confirmation.token, 'wrong')).toEqual({ ok: false, error: 'Invalid confirmation code' })
    expect(auth.verifyConfirmation(confirmation.token, confirmation.confirm_code)).toEqual(
      expect.objectContaining({ ok: true, record: expect.objectContaining({ is_verified: true }) })
    )
  })

  test('access tokens follow user lifecycle', () => {
    const token = auth.issueAccessToken(1)
    expect(token.token.split('.')).toHaveLength(3)
    expect(auth.getUserByAccessToken(token.token)?.auth_email).toBe('demo@example.com')

    const refreshed = auth.refreshAccessToken(token.token)
    expect(refreshed?.user_id).toBe(1)
    expect(auth.getUserByAccessToken(token.token)).toBeNull()

    auth.revokeAccessToken(refreshed?.token ?? '')
    expect(auth.getUserByAccessToken(refreshed?.token ?? '')).toBeNull()

    const second = auth.issueAccessToken(1)
    auth.revokeAllAccessTokensForUser(1)
    expect(auth.getUserByAccessToken(second.token)).toBeNull()

    users.set(1, { ...users.get(1)!, deleted_at: '2024-01-02T00:00:00.000Z' })
    const deleted = auth.issueAccessToken(1)
    expect(auth.getUserByAccessToken(deleted.token)).toBeNull()
  })

  test('tracks creation failure metadata on confirmation records', () => {
    const confirmation = auth.createConfirmation('register', { auth_email: 'demo@example.com' })
    expect(auth.markConfirmationUserCreationFailed(confirmation.token, 'User not found')?.user_creation_error).toBe('User not found')
    expect(auth.markConfirmationAccessTokenCreationFailed(confirmation.token, 'Token creation failed')?.access_token_error).toBe(
      'Token creation failed'
    )
  })
})

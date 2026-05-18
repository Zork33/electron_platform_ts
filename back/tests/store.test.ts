import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createConfirmCodeSettings, store, toFileMetadata } from '../src/store.js'

beforeEach(() => {
  store.reset()
})

describe('store', () => {
  test('seeds demo user and access token', () => {
    const token = store.auth.accessTokens.keys().next().value as string | undefined
    expect(token).toBeTruthy()
    expect(store.auth.getUserByAccessToken(token ?? '')?.auth_email).toBe('demo@example.com')
  })

  test('confirmation and access token lifecycle', () => {
    const confirmation = store.auth.createConfirmation('login', { auth_email: 'demo@example.com' })
    expect(confirmation.history[0].action).toBe('create')
    expect(store.auth.markConfirmationSent(confirmation.token, true)?.sending_attempts_count).toBe(1)
    expect(store.auth.consumeConfirmation(confirmation.token)?.confirm_code).toBe(confirmation.confirm_code)
    expect(store.auth.consumeConfirmation(confirmation.token)?.token).toBe(confirmation.token)
    const expiredConfirmation = store.auth.createConfirmation('login', { auth_email: 'expired@example.com' })
    store.auth.confirmationTokens.set(expiredConfirmation.token, {
      ...expiredConfirmation,
      expires_at: '2000-01-01T00:00:00.000Z',
    })
    expect(store.auth.consumeConfirmation(expiredConfirmation.token)).toBeNull()

    const user = store.profileService.ensureUserByEmail('new@example.com', { first_name: 'New' })
    const access = store.auth.issueAccessToken(user.id)
    expect(store.auth.getUserByAccessToken(access.token)?.id).toBe(user.id)

    const refreshed = store.auth.refreshAccessToken(access.token)
    expect(refreshed?.user_id).toBe(user.id)
    expect(store.auth.getUserByAccessToken(access.token)).toBeNull()
    expect(store.auth.getUserByAccessToken(refreshed?.token ?? '')?.id).toBe(user.id)

    expect(store.auth.revokeAccessToken(refreshed?.token ?? '')).toBe(true)
    expect(store.auth.getUserByAccessToken(refreshed?.token ?? '')).toBeNull()

    const expired = store.auth.issueAccessToken(user.id)
    store.auth.accessTokens.set(expired.token, { ...expired, expires_at: '2000-01-01T00:00:00.000Z' })
    expect(store.auth.refreshAccessToken(expired.token)).toBeNull()

    const expiredLookup = store.auth.issueAccessToken(user.id)
    store.auth.accessTokens.set(expiredLookup.token, { ...expiredLookup, expires_at: '2000-01-01T00:00:00.000Z' })
    expect(store.auth.getUserByAccessToken(expiredLookup.token)).toBeNull()

    const deletedUserToken = store.auth.issueAccessToken(user.id)
    store.users.softDelete(user.id)
    expect(store.auth.getUserByAccessToken(deletedUserToken.token)).toBeNull()

    const verifyToken = store.auth.createConfirmation('register', { auth_email: 'verify@example.com', first_name: 'V' })
    expect(store.auth.verifyConfirmation(verifyToken.token, 'wrong')).toEqual({ ok: false, error: 'Invalid confirmation code' })
    expect(store.auth.verifyConfirmation(verifyToken.token, verifyToken.confirm_code)).toEqual(
      expect.objectContaining({ ok: true, record: expect.objectContaining({ is_verified: true }) })
    )
  })

  test('file storage lifecycle and metadata helpers', () => {
    const file = store.fileStorage.storeFile({
      storagePartName: 'public',
      path: 'docs/readme.txt',
      filename: 'readme.txt',
      ext: 'txt',
      content: Buffer.from('hello'),
      contentType: 'text/plain',
    })

    expect(store.fileStorage.getFileByPath('public', 'docs/readme.txt')?.id).toBe(file.id)
    expect(store.fileStorage.deleteFileByPath('public', 'docs/readme.txt')?.deleted_at).not.toBeNull()
    expect(store.fileStorage.restoreFile(file.id)?.deleted_at).toBeNull()
    expect(store.profileService.serializeUser(store.users.get(1)!).avatar).toBeNull()
    expect(store.profileService.getCurrentUser(store.users.get(1)!).person?.first_name).toBe('Alexey')
    const orphanUser = store.users.create({
      person_id: null,
      auth_email: 'orphan@example.com',
      has_access: true,
      is_admin: false,
      session_expires_at: null,
      avatar_id: null,
      auth_telegram_id: null,
    })
    expect(store.profileService.getCurrentUser(orphanUser).person).toBeNull()
    expect(store.fileStorage.getDefaultImage().length).toBeGreaterThan(0)
    expect(toFileMetadata(null)).toBeNull()
  })

  test('ws connection lifecycle', () => {
    const connId = store.ws.registerConnection({
      userId: 1,
      clientIp: '127.0.0.1',
      userAgent: 'vitest',
    })

    store.ws.updateConnection(connId, { last_pong_at: '2024-01-01T00:00:00.000Z' })
    expect(store.ws.listConnections()[0].last_pong_at).toBe('2024-01-01T00:00:00.000Z')

    store.ws.removeConnection(connId)
    expect(store.ws.listConnections()).toHaveLength(0)
  })

  test('store confirm code settings include cooldown env overrides', () => {
    vi.stubEnv('CONFIRM_SENDING_COOLDOWN_SECONDS', '42')
    try {
      const settings = createConfirmCodeSettings()
      expect(settings.getByReasonCode('LOGIN').sending_cooldown_seconds).toBe(42)
      expect(settings.getByReasonCode('REGISTRATION').sending_cooldown_seconds).toBe(42)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

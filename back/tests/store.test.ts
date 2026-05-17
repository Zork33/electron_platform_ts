import { beforeEach, describe, expect, test } from 'vitest'
import { store, toFileMetadata } from '../src/store.js'

beforeEach(() => {
  store.reset()
})

describe('store', () => {
  test('seeds demo user and access token', () => {
    const token = store.accessTokens.keys().next().value as string | undefined
    expect(token).toBeTruthy()
    expect(store.getUserByAccessToken(token ?? '')?.auth_email).toBe('demo@example.com')
  })

  test('confirmation and access token lifecycle', () => {
    const confirmation = store.createConfirmation('login', { auth_email: 'demo@example.com' })
    expect(confirmation.history[0].action).toBe('create')
    expect(store.markConfirmationSent(confirmation.token, true)?.sending_attempts_count).toBe(1)
    expect(store.consumeConfirmation(confirmation.token)?.confirm_code).toBe('123456')
    expect(store.consumeConfirmation(confirmation.token)?.token).toBe(confirmation.token)
    const expiredConfirmation = store.createConfirmation('login', { auth_email: 'expired@example.com' })
    store.confirmationTokens.set(expiredConfirmation.token, {
      ...expiredConfirmation,
      expires_at: '2000-01-01T00:00:00.000Z',
    })
    expect(store.consumeConfirmation(expiredConfirmation.token)).toBeNull()

    const user = store.ensureUserByEmail('new@example.com', { first_name: 'New' })
    const access = store.issueAccessToken(user.id)
    expect(store.getUserByAccessToken(access.token)?.id).toBe(user.id)

    const refreshed = store.refreshAccessToken(access.token)
    expect(refreshed?.user_id).toBe(user.id)
    expect(store.getUserByAccessToken(access.token)).toBeNull()
    expect(store.getUserByAccessToken(refreshed?.token ?? '')?.id).toBe(user.id)

    expect(store.revokeAccessToken(refreshed?.token ?? '')).toBe(true)
    expect(store.getUserByAccessToken(refreshed?.token ?? '')).toBeNull()

    const expired = store.issueAccessToken(user.id)
    store.accessTokens.set(expired.token, { ...expired, expires_at: '2000-01-01T00:00:00.000Z' })
    expect(store.refreshAccessToken(expired.token)).toBeNull()

    const expiredLookup = store.issueAccessToken(user.id)
    store.accessTokens.set(expiredLookup.token, { ...expiredLookup, expires_at: '2000-01-01T00:00:00.000Z' })
    expect(store.getUserByAccessToken(expiredLookup.token)).toBeNull()

    const deletedUserToken = store.issueAccessToken(user.id)
    store.users.softDelete(user.id)
    expect(store.getUserByAccessToken(deletedUserToken.token)).toBeNull()

    const verifyToken = store.createConfirmation('register', { auth_email: 'verify@example.com', first_name: 'V' })
    expect(store.verifyConfirmation(verifyToken.token, 'wrong')).toEqual({ ok: false, error: 'Invalid confirmation code' })
    expect(store.verifyConfirmation(verifyToken.token, '123456')).toEqual(
      expect.objectContaining({ ok: true, record: expect.objectContaining({ is_verified: true }) })
    )
  })

  test('file storage lifecycle and metadata helpers', () => {
    const file = store.storeFile({
      storagePartName: 'public',
      path: 'docs/readme.txt',
      filename: 'readme.txt',
      ext: 'txt',
      content: Buffer.from('hello'),
      contentType: 'text/plain',
    })

    expect(store.getFileByPath('public', 'docs/readme.txt')?.id).toBe(file.id)
    expect(store.deleteFileByPath('public', 'docs/readme.txt')?.deleted_at).not.toBeNull()
    expect(store.files.restore(file.id)?.deleted_at).toBeNull()
    expect(store.serializeUser(store.users.get(1)!).avatar).toBeNull()
    expect(store.buildCurrentUser(store.users.get(1)!).person?.first_name).toBe('Alexey')
    const orphanUser = store.users.create({
      person_id: null,
      auth_email: 'orphan@example.com',
      has_access: true,
      is_admin: false,
      session_expires_at: null,
      avatar_id: null,
      auth_telegram_id: null,
    })
    expect(store.buildCurrentUser(orphanUser).person).toBeNull()
    expect(store.getDefaultImage().length).toBeGreaterThan(0)
    expect(toFileMetadata(null)).toBeNull()
  })

  test('ws connection lifecycle', () => {
    const connId = store.registerWsConnection({
      userId: 1,
      clientIp: '127.0.0.1',
      userAgent: 'vitest',
    })

    store.updateWsConnection(connId, { last_pong_at: '2024-01-01T00:00:00.000Z' })
    expect(store.listWsConnections()[0].last_pong_at).toBe('2024-01-01T00:00:00.000Z')

    store.removeWsConnection(connId)
    expect(store.listWsConnections()).toHaveLength(0)
  })
})

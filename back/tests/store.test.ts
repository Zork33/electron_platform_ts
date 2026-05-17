import { beforeEach, describe, expect, test } from 'vitest'
import { store } from '../src/store.js'

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
    expect(store.consumeConfirmation(confirmation.token)?.confirm_code).toBe('123456')
    expect(store.consumeConfirmation(confirmation.token)?.token).toBe(confirmation.token)

    const user = store.ensureUserByEmail('new@example.com', { first_name: 'New' })
    const access = store.issueAccessToken(user.id)
    expect(store.getUserByAccessToken(access.token)?.id).toBe(user.id)

    const refreshed = store.refreshAccessToken(access.token)
    expect(refreshed?.user_id).toBe(user.id)
    expect(store.getUserByAccessToken(access.token)).toBeNull()
    expect(store.getUserByAccessToken(refreshed?.token ?? '')?.id).toBe(user.id)

    expect(store.revokeAccessToken(refreshed?.token ?? '')).toBe(true)
    expect(store.getUserByAccessToken(refreshed?.token ?? '')).toBeNull()
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

import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { startTestServer } from './test-helpers.js'
import { store } from '../src/store.js'

const jsonHeaders = { 'content-type': 'application/json' }

let server: Awaited<ReturnType<typeof startTestServer>> | null = null

beforeEach(async () => {
  server = await startTestServer()
})

afterEach(async () => {
  await server?.close()
  server = null
})

async function request(path: string, init?: RequestInit) {
  if (!server) throw new Error('server is not started')
  const response = await fetch(`${server.baseUrl}${path}`, init)
  const text = await response.clone().text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { response, body, text }
}

function expectObjectKeys(value: unknown, keys: string[]) {
  expect(value).toBeTruthy()
  expect(typeof value).toBe('object')
  for (const key of keys) {
    expect(value as Record<string, unknown>).toHaveProperty(key)
  }
}

describe('backend api contract', () => {
  test('health endpoint stays stable', async () => {
    const health = await request('/health')
    expect(health.response.ok).toBe(true)
    expect(health.body).toEqual({ healthy: true, service: 'electron-platform-ts' })
  })

  test('auth endpoints keep the login and registration contract', async () => {
    const loginStart = await request('/user-api/auth/login-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ auth_email: 'demo@example.com' }),
    })
    expect(loginStart.response.ok).toBe(true)
    expectObjectKeys(loginStart.body, ['confirmation_token', 'expires_at'])

    const loginToken = store.auth.confirmationTokens.get((loginStart.body as { confirmation_token: string }).confirmation_token)
    expect(loginToken?.confirm_code).toMatch(/^\d{6}$/)

    const loginFinish = await request('/user-api/auth/login-confirm-code-finish', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        confirmation_token: (loginStart.body as { confirmation_token: string }).confirmation_token,
        confirm_code: loginToken?.confirm_code,
      }),
    })
    expect(loginFinish.response.ok).toBe(true)
    expectObjectKeys(loginFinish.body, ['access_token', 'expires_at', 'session_expires_days', 'user_id', 'person_id'])

    const registrationStart = await request('/user-api/auth/registration-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        auth_email: 'new@example.com',
        first_name: 'New',
      }),
    })
    expect(registrationStart.response.ok).toBe(true)
    expectObjectKeys(registrationStart.body, ['confirmation_token', 'expires_at'])

    const registrationToken = store.auth.confirmationTokens.get(
      (registrationStart.body as { confirmation_token: string }).confirmation_token
    )
    expect(registrationToken?.confirm_code).toMatch(/^\d{6}$/)

    const registrationFinish = await request('/user-api/auth/registration-confirm-code-finish', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        confirmation_token: (registrationStart.body as { confirmation_token: string }).confirmation_token,
        confirm_code: registrationToken?.confirm_code,
      }),
    })
    expect(registrationFinish.response.ok).toBe(true)
    expectObjectKeys(registrationFinish.body, ['access_token', 'expires_at', 'session_expires_days', 'user_id', 'person_id'])

    const currentUser = await request('/user-api/user/current-user', {
      headers: {
        Authorization: `Bearer ${(loginFinish.body as { access_token: string }).access_token}`,
      },
    })
    expect(currentUser.response.ok).toBe(true)
    expectObjectKeys(currentUser.body, ['user_id', 'auth_email', 'has_access', 'auth_session_expires_at', 'is_admin', 'person'])
  })

  test('profile and crud endpoints keep the core entity contract', async () => {
    const personCreate = await request('/user-api/person', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        first_name: 'Jane',
        last_name: 'Doe',
        middle_name: null,
        birth_date: null,
        description: 'contract test',
      }),
    })
    expect(personCreate.response.ok).toBe(true)
    expectObjectKeys(personCreate.body, ['id', 'first_name', 'last_name', 'middle_name', 'birth_date', 'description', 'created_at', 'updated_at', 'deleted_at'])

    const personList = await request('/user-api/person')
    expect(personList.response.ok).toBe(true)
    expect(Array.isArray(personList.body)).toBe(true)

    const userCreate = await request('/user-api/user', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        person_id: null,
        auth_email: 'route-user@example.com',
        has_access: true,
        is_admin: false,
        session_expires_at: null,
        avatar_id: null,
        auth_telegram_id: null,
      }),
    })
    expect(userCreate.response.ok).toBe(true)
    expectObjectKeys(userCreate.body, ['id', 'person_id', 'auth_email', 'has_access', 'is_admin', 'session_expires_at', 'avatar_id', 'auth_telegram_id'])

    const contactInfoList = await request('/user-api/contact-info')
    expect(contactInfoList.response.ok).toBe(true)
    expect(Array.isArray(contactInfoList.body)).toBe(true)
  })

  test('file and websocket endpoints keep their contract shape', async () => {
    const partHealth = await request('/dev-api/file-storage/part/health/check')
    expect(partHealth.response.ok).toBe(true)
    expect(partHealth.body).toEqual({ healthy: true, service: 'file-storage-ts' })

    const objectInfo = await request('/dev-api/object-container/storage-info')
    expect(objectInfo.response.ok).toBe(true)
    expectObjectKeys(objectInfo.body, ['summary'])

    const pool = await request('/dev-api/web-socket/pool')
    expect(pool.response.ok).toBe(true)
    expectObjectKeys(pool.body, ['total_users', 'total_connections', 'ping_interval', 'ping_timeout', 'connections'])
  })
})

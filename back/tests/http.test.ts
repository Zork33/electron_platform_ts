import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import express from 'express'
import http from 'node:http'
import WebSocket from 'ws'
import { buildRouters } from '../src/routes.js'
import { startTestServer } from './test-helpers.js'
import { store } from '../src/store.js'

const jsonHeaders = { 'content-type': 'application/json' }
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2k8Q8AAAAASUVORK5CYII=',
  'base64'
)

let server: Awaited<ReturnType<typeof startTestServer>> | null = null
let currentSocket: WebSocket | null = null

beforeEach(async () => {
  server = await startTestServer()
})

afterEach(async () => {
  if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
    await new Promise<void>((resolve) => {
      currentSocket!.once('close', () => resolve())
      currentSocket!.close()
    })
  }
  currentSocket = null
  await server?.close()
  server = null
})

async function startHealthRouterServer() {
  const app = express()
  app.use(buildRouters({
    broadcast: () => {},
    sendToUser: () => {},
    sendToConnection: () => {},
  }).health)
  const httpServer = http.createServer(app)
  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => resolve())
  })
  const address = httpServer.address()
  if (address === null || typeof address === 'string') throw new Error('bad address')
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve())
      })
    },
  }
}

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

function formData(entries: Record<string, string | Blob>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    form.append(key, value)
  }
  return form
}

describe('http api', () => {
  test('health and auth flow', async () => {
    const health = await request('/health')
    expect(health.response.ok).toBe(true)
    expect(health.body).toEqual({ healthy: true, service: 'electron-platform-ts' })

    const loginStart = await request('/user-api/auth/login-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ auth_email: 'demo@example.com' }),
    })
    expect(loginStart.response.ok).toBe(true)
    expect(loginStart.body.confirmation_token).toBeTruthy()
    const loginConfirmCode = store.auth.confirmationTokens.get(loginStart.body.confirmation_token)?.confirm_code
    expect(loginConfirmCode).toMatch(/^\d{6}$/)

    const loginFinish = await request('/user-api/auth/login-confirm-code-finish', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        confirmation_token: loginStart.body.confirmation_token,
        confirm_code: loginConfirmCode,
      }),
    })
    expect(loginFinish.response.ok).toBe(true)
    expect(loginFinish.body.access_token).toBeTruthy()

    const currentUser = await request('/user-api/user/current-user', {
      headers: {
        Authorization: `Bearer ${loginFinish.body.access_token}`,
      },
    })
    expect(currentUser.response.ok).toBe(true)
    expect(currentUser.body.user_id).toBe(1)

    const refresh = await request('/user-api/auth/access-token-refresh', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${loginFinish.body.access_token}`,
      },
    })
    expect(refresh.response.ok).toBe(true)
    expect(refresh.body).toEqual({
      access_token: expect.any(String),
      expires_at: expect.any(String),
    })

    const logout = await request('/user-api/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${refresh.body.access_token}`,
      },
    })
    expect(logout.response.ok).toBe(true)

    const afterLogout = await request('/user-api/user/current-user', {
      headers: {
        Authorization: `Bearer ${refresh.body.access_token}`,
      },
    })
    expect(afterLogout.response.status).toBe(401)

    const unauthorizedCurrentUser = await request('/user-api/user/current-user')
    expect(unauthorizedCurrentUser.response.status).toBe(401)
    expect(unauthorizedCurrentUser.body.detail.error_code).toBe('UNAUTHORIZED')

    const registrationStart = await request('/user-api/auth/registration-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        auth_email: 'new@example.com',
        first_name: 'New',
      }),
    })
    expect(registrationStart.body.confirmation_token).toBeTruthy()
    const registrationConfirmCode = store.auth.confirmationTokens.get(registrationStart.body.confirmation_token)?.confirm_code
    expect(registrationConfirmCode).toMatch(/^\d{6}$/)

    const registrationFinish = await request('/user-api/auth/registration-confirm-code-finish', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        confirmation_token: registrationStart.body.confirmation_token,
        confirm_code: registrationConfirmCode,
      }),
    })
    expect(registrationFinish.body.access_token).toBeTruthy()

    const logoutAll = await request('/user-api/auth/logout-all', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registrationFinish.body.access_token}`,
      },
    })
    expect(logoutAll.body.revoked_tokens).toBeGreaterThanOrEqual(1)
  })

  test('auth start endpoints map python status codes', async () => {
    const missingLoginEmail = await request('/user-api/auth/login-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
    expect(missingLoginEmail.response.status).toBe(422)
    expect(missingLoginEmail.body.detail.error_code).toBe('VALIDATION_ERROR')

    const invalidLoginEmail = await request('/user-api/auth/login-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ auth_email: 'not-an-email' }),
    })
    expect(invalidLoginEmail.response.status).toBe(422)
    expect(invalidLoginEmail.body.detail.error_code).toBe('VALIDATION_ERROR')

    const missingLogin = await request('/user-api/auth/login-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ auth_email: 'missing@example.com' }),
    })
    expect(missingLogin.response.status).toBe(404)
    expect(missingLogin.body.detail.error_code).toBe('USER_NOT_FOUND')

    const existingRegistrationUser = await request('/user-api/auth/registration-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        auth_email: 'demo@example.com',
        first_name: 'Demo',
      }),
    })
    expect(existingRegistrationUser.response.status).toBe(409)
    expect(existingRegistrationUser.body.detail.error_code).toBe('USER_ALREADY_EXISTS')

    store.users.create({
      person_id: 1,
      auth_email: 'blocked@example.com',
      has_access: false,
      is_admin: false,
      session_expires_at: null,
      avatar_id: null,
      auth_telegram_id: null,
    })

    const blockedLogin = await request('/user-api/auth/login-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ auth_email: 'blocked@example.com' }),
    })
    expect(blockedLogin.response.status).toBe(422)
    expect(blockedLogin.body.detail.error_code).toBe('USER_ACCESS_DENIED')
  })

  test('auth finish endpoints map python status codes', async () => {
    const missingLoginFinish = await request('/user-api/auth/login-confirm-code-finish', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        confirmation_token: 'missing-token',
        confirm_code: '000000',
      }),
    })
    expect(missingLoginFinish.response.status).toBe(404)
    expect(missingLoginFinish.body.detail.error_code).toBe('CONFIRM_CODE_NOT_FOUND')

    const loginStart = await request('/user-api/auth/login-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ auth_email: 'demo@example.com' }),
    })
    const invalidLoginFinish = await request('/user-api/auth/login-confirm-code-finish', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        confirmation_token: loginStart.body.confirmation_token,
        confirm_code: '000000',
      }),
    })
    expect(invalidLoginFinish.response.status).toBe(422)
    expect(invalidLoginFinish.body.detail.error_code).toBe('INVALID_CONFIRM_CODE')

    const limitLoginStart = await request('/user-api/auth/login-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ auth_email: 'demo@example.com' }),
    })
    const limitLoginToken = store.auth.confirmationTokens.get(limitLoginStart.body.confirmation_token)
    if (!limitLoginToken) throw new Error('confirmation token missing')
    limitLoginToken.verification_attempts_count = 5

    const limitLoginFinish = await request('/user-api/auth/login-confirm-code-finish', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        confirmation_token: limitLoginStart.body.confirmation_token,
        confirm_code: limitLoginToken.confirm_code,
      }),
    })
    expect(limitLoginFinish.response.status).toBe(422)
    expect(limitLoginFinish.body.detail.error_code).toBe('VERIFICATION_ATTEMPTS_EXCEEDED')

    const repeatLoginStart = await request('/user-api/auth/login-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ auth_email: 'demo@example.com' }),
    })
    const repeatLoginCode = store.auth.confirmationTokens.get(repeatLoginStart.body.confirmation_token)?.confirm_code
    const repeatLoginFinish = await request('/user-api/auth/login-confirm-code-finish', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        confirmation_token: repeatLoginStart.body.confirmation_token,
        confirm_code: repeatLoginCode,
      }),
    })
    expect(repeatLoginFinish.response.ok).toBe(true)
    const repeatLoginFinishAgain = await request('/user-api/auth/login-confirm-code-finish', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        confirmation_token: repeatLoginStart.body.confirmation_token,
        confirm_code: repeatLoginCode,
      }),
    })
    expect(repeatLoginFinishAgain.response.status).toBe(422)
    expect(repeatLoginFinishAgain.body.detail.error_code).toBe('LOGIN_ALREADY_COMPLETED')

    const noPersonUser = store.users.create({
      person_id: null,
      auth_email: 'noperson-http@example.com',
      has_access: true,
      is_admin: false,
      session_expires_at: null,
      avatar_id: null,
      auth_telegram_id: null,
    })
    expect(noPersonUser.id).toBeTruthy()

    const noPersonLoginStart = await request('/user-api/auth/login-confirm-code-start', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ auth_email: 'noperson-http@example.com' }),
    })
    const noPersonLoginFinish = await request('/user-api/auth/login-confirm-code-finish', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        confirmation_token: noPersonLoginStart.body.confirmation_token,
        confirm_code: store.auth.confirmationTokens.get(noPersonLoginStart.body.confirmation_token)?.confirm_code,
      }),
    })
    expect(noPersonLoginFinish.response.status).toBe(404)
    expect(noPersonLoginFinish.body.detail.error_code).toBe('PERSON_NOT_FOUND')
  })

  test('crud, files and object container routes', async () => {
    const personCreate = await request('/user-api/person', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        first_name: 'Jane',
        last_name: 'Doe',
        middle_name: null,
        birth_date: null,
        description: 'created by test',
      }),
    })
    expect(personCreate.body.first_name).toBe('Jane')

    const personSearch = await request(
      `/user-api/person?filters=${encodeURIComponent(
        JSON.stringify([{ field: 'first_name', operator: 'ILIKE', value: '%Jane%' }])
      )}`
    )
    expect(personSearch.body.length).toBeGreaterThan(0)

    const personUpdate = await request(`/user-api/person/${personCreate.body.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ description: 'updated' }),
    })
    expect(personUpdate.body.description).toBe('updated')

    const personDelete = await request(`/user-api/person/${personCreate.body.id}`, { method: 'DELETE' })
    expect(personDelete.body.deleted_at).toBeTruthy()

    const personRestore = await request(`/user-api/person/${personCreate.body.id}/restore`, { method: 'POST' })
    expect(personRestore.body.deleted_at).toBeNull()

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
    expect(userCreate.body.auth_email).toBe('route-user@example.com')

    const userUpdate = await request(`/user-api/user/${userCreate.body.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ is_admin: true }),
    })
    expect(userUpdate.body.is_admin).toBe(true)

    const userDelete = await request(`/user-api/user/${userCreate.body.id}`, { method: 'DELETE' })
    expect(userDelete.body.deleted_at).toBeTruthy()

    const userRestore = await request(`/user-api/user/${userCreate.body.id}/restore`, { method: 'POST' })
    expect(userRestore.body.deleted_at).toBeNull()

    const emailOne = await request('/user-api/email', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ address: 'alpha@example.com' }),
    })
    expect(emailOne.body.address).toBe('alpha@example.com')

    const emailTwo = await request('/user-api/email', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ address: 'beta@example.com' }),
    })
    expect(emailTwo.body.address).toBe('beta@example.com')

    const emailListFirst = await request('/user-api/email?limit=1&offset=0&order_by=address&order_direction=asc')
    const emailListSecond = await request('/user-api/email?limit=1&offset=1&order_by=address&order_direction=asc')
    expect(emailListFirst.body).toHaveLength(1)
    expect(emailListSecond.body).toHaveLength(1)
    expect(emailListFirst.body[0].address).toBe('alpha@example.com')
    expect(emailListSecond.body[0].address).toBe('beta@example.com')

    const emailFilter = await request(
      `/user-api/email?filters=${encodeURIComponent(
        JSON.stringify([{ field: 'address', operator: 'ILIKE', value: '%beta%' }])
      )}&order_by=address&order_direction=asc`
    )
    expect(emailFilter.body).toHaveLength(1)
    expect(emailFilter.body[0].address).toBe('beta@example.com')

    const invalidEmailOrderDirection = await request('/user-api/email?order_direction=sideways')
    expect(invalidEmailOrderDirection.response.status).toBe(400)
    expect(invalidEmailOrderDirection.body.detail.error_message).toContain("Order direction must be 'asc' or 'desc'")

    const invalidEmailLimit = await request('/user-api/email?limit=0')
    expect(invalidEmailLimit.response.status).toBe(422)
    expect(invalidEmailLimit.body.detail.error_message).toContain('limit must be between 1 and 1000')

    const avatar = await request('/user-api/user/1/avatar/upload', {
      method: 'POST',
      body: formData({ file: new File([pngBuffer], 'avatar.png', { type: 'image/png' }) }),
    })
    expect(avatar.body.avatar.id).toBeTruthy()
    expect(avatar.body.avatar.filename).toBe('avatar_1')
    expect(avatar.body.avatar.path).toBe('user/1/avatar/avatar_1.png')

    const avatarReplace = await request('/user-api/user/1/avatar/replace', {
      method: 'PUT',
      body: formData({ file: new File([pngBuffer], 'avatar.png', { type: 'image/png' }) }),
    })
    expect(avatarReplace.body.avatar.id).toBeTruthy()
    expect(avatarReplace.body.avatar.id).toBe(avatar.body.avatar.id)

    const missingAvatarUpload = await request('/user-api/user/1/avatar/upload', {
      method: 'POST',
      body: formData({}),
    })
    expect(missingAvatarUpload.response.status).toBe(422)
    expect(missingAvatarUpload.body.detail.error_message).toBe('file is required')

    const missingAvatarReplace = await request('/user-api/user/1/avatar/replace', {
      method: 'PUT',
      body: formData({}),
    })
    expect(missingAvatarReplace.response.status).toBe(422)
    expect(missingAvatarReplace.body.detail.error_message).toBe('file is required')

    const invalidAvatarUpload = await request('/user-api/user/1/avatar/upload', {
      method: 'POST',
      body: formData({ file: new File([Buffer.from('not-a-png')], 'avatar.png', { type: 'image/png' }) }),
    })
    expect(invalidAvatarUpload.response.status).toBe(400)
    expect(invalidAvatarUpload.body.detail.error_message).toContain('Invalid avatar image content')

    if (!server) throw new Error('server is not started')
    const avatarContent = await fetch(`${server.baseUrl}/user-api/user/1/avatar/content`)
    expect(avatarContent.headers.get('content-type')).toContain('image/png')
    expect(avatarContent.headers.get('cache-control')).toContain('no-store')
    expect(Buffer.from(await avatarContent.arrayBuffer()).length).toBeGreaterThan(0)

    const avatarDelete = await request('/user-api/user/1/avatar', { method: 'DELETE' })
    expect(avatarDelete.body.avatar).toBeNull()

    const missingAvatarContent = await request('/user-api/user/1/avatar/content')
    expect(missingAvatarContent.response.status).toBe(404)
    expect(missingAvatarContent.body.detail.error_message).toBe('Avatar not found')
    expect(missingAvatarContent.body.detail.error_code).toBe('NOT_FOUND')

    const partCreate = await request('/user-api/file-storage/part/create', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name: 'archive', is_public: false }),
    })
    expect(partCreate.body.message).toBe("Part 'archive' created successfully")
    expect(partCreate.body.part).toEqual({ name: 'archive', is_public: false })

    const missingPartNameCreate = await request('/user-api/file-storage/part/create', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ is_public: false }),
    })
    expect(missingPartNameCreate.response.status).toBe(422)
    expect(missingPartNameCreate.body.detail.error_message).toBe('name is required')

    const duplicatePartCreate = await request('/user-api/file-storage/part/create', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name: 'archive', is_public: false }),
    })
    expect(duplicatePartCreate.response.status).toBe(409)
    expect(duplicatePartCreate.body.detail.error_message).toContain("Part 'archive' already exists")
    expect(duplicatePartCreate.body.detail.error_code).toBe('RESOURCE_CONFLICT')

    const missingPartLookup = await request('/user-api/file-storage/part/missing')
    expect(missingPartLookup.body.exists).toBe(false)

    const fileUpload = await request('/user-api/file-storage/file/upload', {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('hello file')], { type: 'text/plain' }),
        storage_part_name: 'archive',
        path: 'docs/readme.txt',
      }),
    })
    expect(fileUpload.body.message).toBe('File uploaded successfully')
    expect(fileUpload.body.file_path).toEqual({
      storage_part_name: 'archive',
      path: 'docs/readme.txt',
    })
    expect(fileUpload.body.size_bytes).toBe(Buffer.from('hello file').length)
    expect(fileUpload.body.etag).toBeTruthy()

    const missingStoragePartNameUpload = await request('/user-api/file-storage/file/upload', {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('hello file')], { type: 'text/plain' }),
        path: 'docs/missing-part-name.txt',
      }),
    })
    expect(missingStoragePartNameUpload.response.status).toBe(422)
    expect(missingStoragePartNameUpload.body.detail.error_message).toBe('storage_part_name is required')

    const missingStoragePartUpload = await request('/user-api/file-storage/file/upload', {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('hello file')], { type: 'text/plain' }),
        storage_part_name: 'missing',
        path: 'docs/missing.txt',
      }),
    })
    expect(missingStoragePartUpload.response.status).toBe(404)
    expect(missingStoragePartUpload.body.detail.error_message).toContain("Storage part 'missing' not found")

    const duplicateFileUpload = await request('/user-api/file-storage/file/upload', {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('hello file 2')], { type: 'text/plain' }),
        storage_part_name: 'archive',
        path: 'docs/readme.txt',
      }),
    })
    expect(duplicateFileUpload.response.status).toBe(400)
    expect(duplicateFileUpload.body.detail.error_message).toContain('File already exists at path')
    expect(duplicateFileUpload.body.detail.error_code).toBe('VALIDATION_ERROR')

    const fileInfo = await request('/user-api/file-storage/file/info?storage_part_name=archive&path=docs%2Freadme.txt')
    expect(fileInfo.body.file_info.size_bytes).toBe(10)

    const missingFileInfoPath = await request('/user-api/file-storage/file/info?storage_part_name=archive')
    expect(missingFileInfoPath.response.status).toBe(422)
    expect(missingFileInfoPath.body.detail.error_message).toBe('path is required')

    const fileDownload = await request('/user-api/file-storage/file/download?storage_part_name=archive&path=docs%2Freadme.txt')
    expect(Buffer.from(await fileDownload.response.arrayBuffer()).toString()).toBe('hello file')
    expect(fileDownload.response.headers.get('content-disposition')).toContain('attachment;')
    expect(fileDownload.response.headers.get('content-disposition')).toBe('attachment; filename=readme.txt')

    const missingFileDownloadPart = await request('/user-api/file-storage/file/download?path=docs%2Freadme.txt')
    expect(missingFileDownloadPart.response.status).toBe(422)
    expect(missingFileDownloadPart.body.detail.error_message).toBe('storage_part_name is required')

    const missingFileDeletePart = await request('/user-api/file-storage/file/delete?path=docs%2Freadme.txt', {
      method: 'DELETE',
    })
    expect(missingFileDeletePart.response.status).toBe(422)
    expect(missingFileDeletePart.body.detail.error_message).toBe('storage_part_name is required')

    const missingPresignedUrlPath = await request(
      '/user-api/file-storage/file/presigned-url?storage_part_name=archive&expires_in=60'
    )
    expect(missingPresignedUrlPath.response.status).toBe(422)
    expect(missingPresignedUrlPath.body.detail.error_message).toBe('path is required')

    const fileManagerUpload = await request('/user-api/file-manager/upload', {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('managed file')], { type: 'text/plain' }),
        storage_part_name: 'private',
        path: 'managed/file.txt',
        filename: 'file.txt',
        ext: '.TXT',
      }),
    })
    expect(fileManagerUpload.body.metadata.filename).toBe('file.txt')
    expect(fileManagerUpload.body.metadata.ext).toBe('txt')

    const fileManagerUploadReplace = await request('/user-api/file-manager/upload', {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('managed file replaced')], { type: 'text/plain' }),
        storage_part_name: 'private',
        path: 'managed/file.txt',
        filename: 'file-renamed.txt',
        ext: 'txt',
        with_replace: 'true',
      }),
    })
    expect(fileManagerUploadReplace.body.metadata.id).toBe(fileManagerUpload.body.metadata.id)
    expect(fileManagerUploadReplace.body.metadata.filename).toBe('file-renamed.txt')
    expect(fileManagerUploadReplace.body.metadata.size_bytes).toBe(Buffer.from('managed file replaced').length)

    const missingPathUpload = await request('/user-api/file-manager/upload', {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('managed file')], { type: 'text/plain' }),
        storage_part_name: 'private',
        filename: 'missing-path.txt',
        ext: 'txt',
      }),
    })
    expect(missingPathUpload.response.status).toBe(422)
    expect(missingPathUpload.body.detail.error_message).toBe('path is required')

    const missingFilenameUpload = await request('/user-api/file-manager/upload', {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('managed file')], { type: 'text/plain' }),
        storage_part_name: 'private',
        path: 'managed/missing-filename.txt',
        ext: 'txt',
      }),
    })
    expect(missingFilenameUpload.response.status).toBe(422)
    expect(missingFilenameUpload.body.detail.error_message).toBe('filename is required')

    const invalidFileManagerUpload = await request('/user-api/file-manager/upload', {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('managed file')], { type: 'text/plain' }),
        storage_part_name: 'archive',
        path: 'managed/invalid.txt',
        filename: 'invalid.txt',
        ext: 'txt',
      }),
    })
    expect(invalidFileManagerUpload.response.status).toBe(400)
    expect(invalidFileManagerUpload.body.detail.error_message).toContain('Unknown storage part')

    const fileManagerList = await request('/user-api/file-manager/list')
    expect(fileManagerList.body.items.length).toBeGreaterThan(0)

    const fileManagerListPage1 = await request('/user-api/file-manager/list?page_count=1&page_number=1')
    const fileManagerListPage2 = await request('/user-api/file-manager/list?page_count=1&page_number=2')
    expect(fileManagerListPage1.body.items).toHaveLength(1)
    expect(fileManagerListPage2.body.items).toHaveLength(1)
    expect(fileManagerListPage1.body.items[0].id).not.toBe(fileManagerListPage2.body.items[0].id)

    const fileManagerListNoPagination = await request('/user-api/file-manager/list?page_count=0&page_number=1')
    expect(fileManagerListNoPagination.body.items.length).toBeGreaterThanOrEqual(fileManagerList.body.items.length)

    const fileManagerGet = await request(`/user-api/file-manager/${fileManagerUpload.body.metadata.id}`)
    expect(fileManagerGet.body.metadata.id).toBe(fileManagerUpload.body.metadata.id)

    const missingReplaceFile = await request(`/user-api/file-manager/${fileManagerUpload.body.metadata.id}/replace`, {
      method: 'PUT',
      body: formData({}),
    })
    expect(missingReplaceFile.response.status).toBe(422)
    expect(missingReplaceFile.body.detail.error_message).toBe('file is required')

    const fileManagerReplace = await request(`/user-api/file-manager/${fileManagerUpload.body.metadata.id}/replace`, {
      method: 'PUT',
      body: formData({
        file: new Blob([Buffer.from('managed file 2')], { type: 'text/plain' }),
      }),
    })
    expect(fileManagerReplace.body.metadata.filename).toBe('file-renamed.txt')
    expect(fileManagerReplace.body.metadata.size_bytes).toBe(14)

    const fileManagerDownload = await fetch(`${server.baseUrl}/user-api/file-manager/${fileManagerUpload.body.metadata.id}/download`)
    expect(Buffer.from(await fileManagerDownload.arrayBuffer()).toString()).toBe('managed file 2')
    const expectedDownloadName = `${fileManagerReplace.body.metadata.filename}.${fileManagerReplace.body.metadata.ext}`
    expect(fileManagerDownload.headers.get('content-disposition')).toBe(
      `attachment; filename="${expectedDownloadName}"; filename*=UTF-8''${encodeURIComponent(expectedDownloadName)}`
    )

    const unicodeFileManagerUpload = await request('/user-api/file-manager/upload', {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('unicode managed file')], { type: 'text/plain' }),
        storage_part_name: 'private',
        path: 'managed/unicode.txt',
        filename: 'файл.txt',
        ext: 'txt',
      }),
    })
    const unicodeFileManagerDownload = await fetch(
      `${server.baseUrl}/user-api/file-manager/${unicodeFileManagerUpload.body.metadata.id}/download`
    )
    expect(unicodeFileManagerDownload.headers.get('content-disposition')).toBe(
      `attachment; filename="download.txt"; filename*=UTF-8''${encodeURIComponent(
        `${unicodeFileManagerUpload.body.metadata.filename}.${unicodeFileManagerUpload.body.metadata.ext}`
      )}`
    )

    const fileManagerUrl = await request(`/user-api/file-manager/${fileManagerUpload.body.metadata.id}/url?expires_in=123`)
    expect(fileManagerUrl.body.url).toContain(`/user-api/file-manager/${fileManagerUpload.body.metadata.id}/download`)

    const missingFileDownload = await request('/user-api/file-manager/999999/download')
    expect(missingFileDownload.response.status).toBe(404)

    const fileManagerDelete = await request(`/user-api/file-manager/${fileManagerUpload.body.metadata.id}`, {
      method: 'DELETE',
    })
    expect(fileManagerDelete.body.metadata.deleted_at).toBeTruthy()

    const fileManagerRestore = await request(`/user-api/file-manager/${fileManagerUpload.body.metadata.id}/restore`, {
      method: 'POST',
    })
    expect(fileManagerRestore.body.metadata.deleted_at).toBeNull()

    const hardDeleteUpload = await request('/user-api/file-manager/upload', {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('hard delete')], { type: 'text/plain' }),
        storage_part_name: 'private',
        path: 'managed/hard.txt',
        filename: 'hard.txt',
        ext: 'txt',
      }),
    })
    const hardDelete = await request(`/user-api/file-manager/${hardDeleteUpload.body.metadata.id}?hard=true`, {
      method: 'DELETE',
    })
    expect(hardDelete.body.metadata.id).toBe(hardDeleteUpload.body.metadata.id)

    const partList = await request('/dev-api/file-storage/part/')
    expect(partList.body.count).toBeGreaterThanOrEqual(3)
    expect(partList.body.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'private', name: 'private', is_public: false }),
        expect.objectContaining({ code: 'public', name: 'public', is_public: true }),
        expect.objectContaining({ code: 'trash', name: 'trash', is_public: false }),
      ])
    )

    const partUpdate = await request('/dev-api/file-storage/part/archive/public', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ is_public: true }),
    })
    expect(partUpdate.body.message).toBe("Part 'archive' public status set to true")
    expect(partUpdate.body.part).toEqual({ name: 'archive', is_public: true })

    const missingPublicFlagUpdate = await request('/dev-api/file-storage/part/archive/public', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
    expect(missingPublicFlagUpdate.response.status).toBe(422)
    expect(missingPublicFlagUpdate.body.detail.error_message).toBe('is_public is required')

    store.fileStorage.fileParts.delete('trash')
    const partSync = await request('/dev-api/file-storage/part/sync', { method: 'POST' })
    expect(partSync.response.ok).toBe(true)
    expect(partSync.body.message).toBe('Storage parts synchronized successfully')
    expect(store.fileStorage.getPart('trash')?.is_public).toBe(false)

    const partDelete = await request('/user-api/file-storage/part/archive', {
      method: 'DELETE',
    })
    expect(partDelete.body.message).toBe("Part 'archive' deleted successfully")

    const missingPartDelete = await request('/dev-api/file-storage/part/not-here', {
      method: 'DELETE',
    })
    expect(missingPartDelete.response.status).toBe(404)

    const eventCreate = await request('/user-api/event', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ title: 'Launch event', description: 'demo' }),
    })
    expect(eventCreate.body.report_gallery).toEqual([])

    const eventCreateTwo = await request('/user-api/event', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ title: 'Alpha event', description: 'demo-2' }),
    })
    expect(eventCreateTwo.body.title).toBe('Alpha event')

    const eventList = await request('/user-api/event?limit=1&offset=0&order_by=title&order_direction=asc')
    expect(eventList.response.ok).toBe(true)
    expect(eventList.body).toHaveLength(1)

    const eventFilter = await request(
      `/user-api/event?filters=${encodeURIComponent(
        JSON.stringify([{ field: 'title', operator: 'ILIKE', value: '%Launch%' }])
      )}&order_by=title&order_direction=asc`
    )
    expect(eventFilter.response.ok).toBe(true)
    expect(eventFilter.body.some((event: { title: string }) => event.title === 'Launch event')).toBe(true)

    const eventUpdate = await request(`/user-api/event/${eventCreate.body.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ description: 'updated' }),
    })
    expect(eventUpdate.body.description).toBe('updated')

    const missingGalleryUpload = await request(`/user-api/event/${eventCreate.body.id}/report_gallery/upload`, {
      method: 'POST',
      body: formData({}),
    })
    expect(missingGalleryUpload.response.status).toBe(422)
    expect(missingGalleryUpload.body.detail.error_message).toBe('file is required')

    const galleryUpload = await request(`/user-api/event/${eventCreate.body.id}/report_gallery/upload`, {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('gallery file')], { type: 'image/png' }),
      }),
    })
    expect(galleryUpload.body.metadata.filename).toBe('blob')

    const eventAfterGallery = await request(`/user-api/event/${eventCreate.body.id}`)
    expect(eventAfterGallery.body.report_gallery.length).toBe(1)

    const missingGalleryRenameFilename = await request(
      `/user-api/event/${eventCreate.body.id}/report_gallery/${galleryUpload.body.metadata.id}/rename`,
      {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({}),
      }
    )
    expect(missingGalleryRenameFilename.response.status).toBe(422)
    expect(missingGalleryRenameFilename.body.detail.error_message).toBe('filename is required')

    const galleryRename = await request(
      `/user-api/event/${eventCreate.body.id}/report_gallery/${galleryUpload.body.metadata.id}/rename`,
      {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ filename: 'renamed.png' }),
      }
    )
    expect(galleryRename.body.metadata.filename).toBe('renamed.png')

    const galleryDelete = await request(`/user-api/event/${eventCreate.body.id}/report_gallery/${galleryUpload.body.metadata.id}`, {
      method: 'DELETE',
    })
    expect(galleryDelete.response.status).toBe(204)

    const galleryReorder = await request(`/user-api/event/${eventCreate.body.id}/report_gallery/reorder`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ ordered_ids: [] }),
    })
    expect(galleryReorder.response.status).toBe(204)

    const eventDelete = await request(`/user-api/event/${eventCreate.body.id}`, {
      method: 'DELETE',
    })
    expect(eventDelete.body.deleted_at).toBeTruthy()

    const presignedUrl = await request('/user-api/file-storage/file/presigned-url?storage_part_name=archive&path=docs%2Freadme.txt&expires_in=60')
    expect(presignedUrl.body.presigned_url).toContain('/user-api/file-storage/file/download')
    expect(presignedUrl.body.file_path).toEqual({
      storage_part_name: 'archive',
      path: 'docs/readme.txt',
    })

    const fileStorageDelete = await request('/user-api/file-storage/file/delete?storage_part_name=archive&path=docs%2Freadme.txt', {
      method: 'DELETE',
    })
    expect(fileStorageDelete.body.message).toBe('File deleted successfully')
    expect(fileStorageDelete.body.file_path).toEqual({
      storage_part_name: 'archive',
      path: 'docs/readme.txt',
    })
    expect(fileStorageDelete.body.file_path.path).toBe('docs/readme.txt')

    const objectInfo = await request('/dev-api/object-container/storage-info')
    expect(objectInfo.body.summary.total_categories).toBeGreaterThan(0)

    const cleanerInfo = await request('/dev-api/object-container/cleaner-info')
    expect(cleanerInfo.body.summary.is_running).toBe(false)

    const containerInfo = await request('/dev-api/object-container/container-info')
    expect(containerInfo.body.cleaner_running).toBe(false)

    const allStatistics = await request('/dev-api/object-container/all-statistics')
    expect(allStatistics.body.storage.summary.total_objects).toBeGreaterThanOrEqual(0)

    const partHealth = await request('/dev-api/file-storage/part/health/check')
    expect(partHealth.body.healthy).toBe(true)

    const healthServer = await startHealthRouterServer()
    const directHealth = await fetch(`${healthServer.baseUrl}/health`)
    expect((await directHealth.json()).service).toBe('ts-backend')
    await healthServer.close()
  })

  test('websocket routes and live socket handler', async () => {
    const unauthorized = new WebSocket(`${server?.wsUrl ?? ''}`)
    await new Promise<void>((resolve) => {
      unauthorized.once('close', () => resolve())
    })
    expect(unauthorized.readyState === WebSocket.CLOSED).toBe(true)

    const token = store.auth.accessTokens.keys().next().value as string
    const socket = new WebSocket(`${server?.wsUrl ?? ''}?token=${token}`)
    currentSocket = socket
    const messages: string[] = []
    socket.on('message', (data) => {
      messages.push(data.toString())
    })

    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve())
      socket.once('error', reject)
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
    const pool = await request('/dev-api/web-socket/pool')
    expect(pool.body.total_connections).toBe(1)
    expect(pool.body.ping_interval).toBe(30)
    expect(pool.body.ping_timeout).toBe(10)

    socket.send('not-json')
    socket.send(JSON.stringify({ type: 'pong' }))
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(store.ws.listConnections()[0].last_pong_at).toBeTruthy()

    const sendAll = await request('/dev-api/web-socket/send-all', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ message: 'hello everyone' }),
    })
    expect(sendAll.body).toEqual({ sent: true, target: 'all' })

    const sendUser = await request('/dev-api/web-socket/send-user/1', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ message: 'hello user' }),
    })
    expect(sendUser.body).toEqual({ sent: true, target: 'user', user_id: 1 })

    const connId = store.ws.listConnections()[0].conn_id
    const sendConnection = await request(`/dev-api/web-socket/send-connection/${connId}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ message: 'hello connection' }),
    })
    expect(sendConnection.body).toEqual({ sent: true, target: 'connection', conn_id: connId })

    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(messages.some((entry) => entry.includes('connected'))).toBe(true)
    expect(messages.some((entry) => entry.includes('hello everyone'))).toBe(true)
    expect(messages.some((entry) => entry.includes('"target":"user"'))).toBe(true)
    expect(messages.some((entry) => entry.includes('"user_id":1'))).toBe(true)
    expect(messages.some((entry) => entry.includes('"target":"connection"'))).toBe(true)
    expect(messages.some((entry) => entry.includes(`"conn_id":${connId}`))).toBe(true)

    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve())
      socket.close()
    })
    currentSocket = null
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(store.ws.listConnections()).toHaveLength(0)
  })
})

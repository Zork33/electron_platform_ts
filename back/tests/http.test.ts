import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import express from 'express'
import http from 'node:http'
import WebSocket from 'ws'
import { buildRouters } from '../src/routes.js'
import { startTestServer } from './test-helpers.js'
import { store } from '../src/store.js'

const jsonHeaders = { 'content-type': 'application/json' }

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
    expect(refresh.body.access_token).toBeTruthy()

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

    const avatar = await request('/user-api/user/1/avatar/upload', {
      method: 'POST',
      body: formData({ file: new File([Buffer.from('avatar')], 'avatar.png', { type: 'image/png' }) }),
    })
    expect(avatar.body.avatar.id).toBeTruthy()
    expect(avatar.body.avatar.filename).toBe('avatar_1')
    expect(avatar.body.avatar.path).toBe('user/1/avatar/avatar_1.png')

    const avatarReplace = await request('/user-api/user/1/avatar/replace', {
      method: 'PUT',
      body: formData({ file: new File([Buffer.from('avatar-2')], 'avatar.png', { type: 'image/png' }) }),
    })
    expect(avatarReplace.body.avatar.id).toBeTruthy()
    expect(avatarReplace.body.avatar.id).toBe(avatar.body.avatar.id)

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

    const partCreate = await request('/user-api/file-storage/part/create', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name: 'archive', is_public: false }),
    })
    expect(partCreate.body.part.name).toBe('archive')

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
    expect(fileUpload.body.metadata.path).toBe('docs/readme.txt')

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

    const fileInfo = await request('/user-api/file-storage/file/info?storage_part_name=archive&path=docs%2Freadme.txt')
    expect(fileInfo.body.file_info.size_bytes).toBe(10)

    const fileDownload = await request('/user-api/file-storage/file/download?storage_part_name=archive&path=docs%2Freadme.txt')
    expect(Buffer.from(await fileDownload.response.arrayBuffer()).toString()).toBe('hello file')

    const fileManagerUpload = await request('/user-api/file-manager/upload', {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('managed file')], { type: 'text/plain' }),
        storage_part_name: 'archive',
        path: 'managed/file.txt',
        filename: 'file.txt',
        ext: 'txt',
      }),
    })
    expect(fileManagerUpload.body.metadata.filename).toBe('file.txt')

    const fileManagerList = await request('/user-api/file-manager/list')
    expect(fileManagerList.body.items.length).toBeGreaterThan(0)

    const fileManagerGet = await request(`/user-api/file-manager/${fileManagerUpload.body.metadata.id}`)
    expect(fileManagerGet.body.metadata.id).toBe(fileManagerUpload.body.metadata.id)

    const fileManagerReplace = await request(`/user-api/file-manager/${fileManagerUpload.body.metadata.id}/replace`, {
      method: 'PUT',
      body: formData({
        file: new Blob([Buffer.from('managed file 2')], { type: 'text/plain' }),
      }),
    })
    expect(fileManagerReplace.body.metadata.size_bytes).toBe(14)

    const fileManagerDownload = await fetch(`${server.baseUrl}/user-api/file-manager/${fileManagerUpload.body.metadata.id}/download`)
    expect(Buffer.from(await fileManagerDownload.arrayBuffer()).toString()).toBe('managed file 2')

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
        storage_part_name: 'archive',
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

    const partUpdate = await request('/dev-api/file-storage/part/archive/public', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ is_public: true }),
    })
    expect(partUpdate.body.part.is_public).toBe(true)

    const partDelete = await request('/user-api/file-storage/part/archive', {
      method: 'DELETE',
    })
    expect(partDelete.body.part.name).toBe('archive')

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

    const eventUpdate = await request(`/user-api/event/${eventCreate.body.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ description: 'updated' }),
    })
    expect(eventUpdate.body.description).toBe('updated')

    const galleryUpload = await request(`/user-api/event/${eventCreate.body.id}/report_gallery/upload`, {
      method: 'POST',
      body: formData({
        file: new Blob([Buffer.from('gallery file')], { type: 'image/png' }),
      }),
    })
    expect(galleryUpload.body.metadata.filename).toBe('blob')

    const eventAfterGallery = await request(`/user-api/event/${eventCreate.body.id}`)
    expect(eventAfterGallery.body.report_gallery.length).toBe(1)

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

    const fileStorageDelete = await request('/user-api/file-storage/file/delete?storage_part_name=archive&path=docs%2Freadme.txt', {
      method: 'DELETE',
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

    socket.send('not-json')
    socket.send(JSON.stringify({ type: 'pong' }))
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(store.ws.listConnections()[0].last_pong_at).toBeTruthy()

    const sendAll = await request('/dev-api/web-socket/send-all', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ message: 'hello everyone' }),
    })
    expect(sendAll.body.success).toBe(true)

    const sendUser = await request('/dev-api/web-socket/send-user/1', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ message: 'hello user' }),
    })
    expect(sendUser.body.success).toBe(true)

    const connId = store.ws.listConnections()[0].conn_id
    const sendConnection = await request(`/dev-api/web-socket/send-connection/${connId}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ message: 'hello connection' }),
    })
    expect(sendConnection.body.success).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(messages.some((entry) => entry.includes('connected'))).toBe(true)
    expect(messages.some((entry) => entry.includes('hello everyone'))).toBe(true)
    expect(messages.some((entry) => entry.includes('hello user'))).toBe(true)
    expect(messages.some((entry) => entry.includes('hello connection'))).toBe(true)

    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve())
      socket.close()
    })
    currentSocket = null
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(store.ws.listConnections()).toHaveLength(0)
  })
})

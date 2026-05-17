import type { Request, Response, Router } from 'express'
import { Router as createRouter } from 'express'
import multer from 'multer'
import { store } from './store.js'
import type { BaseRecord } from './types.js'

const upload = multer({ storage: multer.memoryStorage() })

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const parseIncludeDeleted = (value: unknown): boolean => {
  if (typeof value === 'string') return value === 'true' || value === '1'
  if (typeof value === 'boolean') return value
  return false
}

const ok = <T>(payload: T) => payload

const notFound = (res: Response, message: string) => res.status(404).json({ detail: { error_message: message } })
const badRequest = (res: Response, message: string) => res.status(400).json({ detail: { error_message: message } })
const unauthorized = (res: Response, message: string) => res.status(401).json({ detail: { error_message: message } })

const authTokenFromRequest = (req: Request): string | null => {
  const header = req.header('Authorization') || ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
}

const withCurrentUser = (req: Request) => {
  const token = authTokenFromRequest(req)
  if (!token) return null
  return store.getUserByAccessToken(token)
}

function createCrudRouter<T extends BaseRecord>(collection: {
  list: (includeDeleted?: boolean) => T[]
  get: (id: number) => T | null
  create: (data: Partial<T>) => T
  patch: (id: number, data: Partial<T>) => T | null
  softDelete: (id: number) => T | null
  restore: (id: number) => T | null
}): Router {
  const router = createRouter()

  router.get('/', (req, res) => {
    const includeDeleted = parseIncludeDeleted(req.query.include_deleted)
    res.json(ok(collection.list(includeDeleted)))
  })

  router.get('/:id', (req, res) => {
    const item = collection.get(toNumber(req.params.id))
    if (!item) return notFound(res, 'Entity not found')
    res.json(ok(item))
  })

  router.post('/', (req, res) => {
    res.json(ok(collection.create(req.body ?? {})))
  })

  router.put('/:id', (req, res) => {
    const item = collection.patch(toNumber(req.params.id), req.body ?? {})
    if (!item) return notFound(res, 'Entity not found')
    res.json(ok(item))
  })

  router.delete('/:id', (req, res) => {
    const item = collection.softDelete(toNumber(req.params.id))
    if (!item) return notFound(res, 'Entity not found')
    res.json(ok(item))
  })

  router.post('/:id/restore', (req, res) => {
    const item = collection.restore(toNumber(req.params.id))
    if (!item) return notFound(res, 'Entity not found')
    res.json(ok(item))
  })

  return router
}

function createUserApiRouter(): Router {
  const router = createRouter()

  router.post('/auth/login-confirm-code-start', (req, res) => {
    const authEmail = String(req.body?.auth_email ?? '').trim()
    if (!authEmail) return badRequest(res, 'auth_email is required')
    const token = store.createConfirmation('login', { auth_email: authEmail })
    store.markConfirmationSent(token.token, true)
    res.json({
      confirmation_token: token.token,
      expires_at: token.expires_at,
    })
  })

  router.post('/auth/registration-confirm-code-start', (req, res) => {
    const authEmail = String(req.body?.auth_email ?? '').trim()
    const firstName = String(req.body?.first_name ?? '').trim()
    if (!authEmail || !firstName) return badRequest(res, 'auth_email and first_name are required')
    const token = store.createConfirmation('register', {
      auth_email: authEmail,
      first_name: firstName,
      last_name: req.body?.last_name ? String(req.body.last_name) : null,
      middle_name: req.body?.middle_name ? String(req.body.middle_name) : null,
    })
    store.markConfirmationSent(token.token, true)
    res.json({
      confirmation_token: token.token,
      expires_at: token.expires_at,
    })
  })

  router.post('/auth/login-confirm-code-finish', (req, res) => {
    const confirmationToken = String(req.body?.confirmation_token ?? '')
    const confirmCode = String(req.body?.confirm_code ?? '')
    const verification = store.verifyConfirmation(confirmationToken, confirmCode)
    if (!verification.ok) return badRequest(res, verification.error)
    const record = verification.record

    const user = store.ensureUserByEmail(record.auth_email)
    const access = store.issueAccessToken(user.id)
    res.json({
      access_token: access.token,
      expires_at: access.expires_at,
      session_expires_days: store.sessionDays,
      user_id: user.id,
      person_id: user.person_id,
    })
  })

  router.post('/auth/registration-confirm-code-finish', (req, res) => {
    const confirmationToken = String(req.body?.confirmation_token ?? '')
    const confirmCode = String(req.body?.confirm_code ?? '')
    const verification = store.verifyConfirmation(confirmationToken, confirmCode)
    if (!verification.ok) return badRequest(res, verification.error)
    const record = verification.record

    const user = store.ensureUserByEmail(record.auth_email, {
      first_name: record.first_name,
      last_name: record.last_name,
      middle_name: record.middle_name,
    })
    const access = store.issueAccessToken(user.id)
    res.json({
      access_token: access.token,
      expires_at: access.expires_at,
      session_expires_days: store.sessionDays,
      user_id: user.id,
      person_id: user.person_id,
    })
  })

  router.post('/auth/access-token-refresh', (req, res) => {
    const token = authTokenFromRequest(req)
    if (!token) return unauthorized(res, 'Authorization header is required')
    const refreshed = store.refreshAccessToken(token)
    if (!refreshed) return unauthorized(res, 'Access token is invalid or expired')
    res.json({
      access_token: refreshed.token,
      expires_at: refreshed.expires_at,
      session_expires_days: store.sessionDays,
    })
  })

  router.post('/auth/logout', (req, res) => {
    const token = authTokenFromRequest(req)
    if (!token) return unauthorized(res, 'Authorization header is required')
    store.revokeAccessToken(token)
    res.json({ success: true })
  })

  router.post('/auth/logout-all', (req, res) => {
    const token = authTokenFromRequest(req)
    if (!token) return unauthorized(res, 'Authorization header is required')
    const user = store.getUserByAccessToken(token)
    if (!user) return unauthorized(res, 'Access token is invalid or expired')
    const removed = store.revokeAllAccessTokensForUser(user.id)
    res.json({ success: true, revoked_tokens: removed })
  })

  router.get('/user/current-user', (req, res) => {
    const user = withCurrentUser(req)
    if (!user) return unauthorized(res, 'Access token is invalid or expired')
    res.json(store.buildCurrentUser(user))
  })

  router.use('/contact-info', createCrudRouter(store.contactInfoApi))
  router.use('/phone-number', createCrudRouter(store.phoneNumberApi))
  router.use('/email', createCrudRouter(store.emailApi))
  router.use('/tg-acc', createCrudRouter(store.tgAccApi))
  router.use('/web-link', createCrudRouter(store.webLinkApi))

  router.get('/person', (req, res) => {
    const includeDeleted = parseIncludeDeleted(req.query.include_deleted)
    const orderBy = String(req.query.order_by ?? 'id')
    const orderDirection = String(req.query.order_direction ?? 'asc')
    const limit = toNumber(req.query.limit, 0)
    const offset = toNumber(req.query.offset, 0)
    res.json(store.profileService.listPersons(includeDeleted, req.query.filters, orderBy, orderDirection, limit, offset))
  })

  router.get('/person/:id', (req, res) => {
    const person = store.profileService.getPerson(toNumber(req.params.id))
    if (!person) return notFound(res, 'Person not found')
    res.json(person)
  })

  router.post('/person', (req, res) => {
    const created = store.profileService.createPerson(req.body ?? {})
    res.json(created)
  })

  router.put('/person/:id', (req, res) => {
    const updated = store.profileService.updatePerson(toNumber(req.params.id), req.body ?? {})
    if (!updated) return notFound(res, 'Person not found')
    res.json(updated)
  })

  router.delete('/person/:id', (req, res) => {
    const deleted = store.profileService.deletePerson(toNumber(req.params.id))
    if (!deleted) return notFound(res, 'Person not found')
    res.json(deleted)
  })

  router.post('/person/:id/restore', (req, res) => {
    const restored = store.profileService.restorePerson(toNumber(req.params.id))
    if (!restored) return notFound(res, 'Person not found')
    res.json(restored)
  })

  router.post('/person/vector_search', (req, res) => {
    const query = String(req.body?.query ?? '').trim().toLowerCase()
    const limit = Math.max(1, toNumber(req.body?.limit, 10))
    res.json(store.profileService.vectorSearch(query, limit))
  })

  router.get('/user', (req, res) => {
    const includeDeleted = parseIncludeDeleted(req.query.include_deleted)
    res.json(store.profileService.listUsers(includeDeleted))
  })

  router.get('/user/:id', (req, res) => {
    const user = store.profileService.getUser(toNumber(req.params.id))
    if (!user) return notFound(res, 'User not found')
    res.json(user)
  })

  router.post('/user', (req, res) => {
    res.json(store.profileService.createUser(req.body ?? {}))
  })

  router.put('/user/:id', (req, res) => {
    const updated = store.profileService.updateUser(toNumber(req.params.id), req.body ?? {})
    if (!updated) return notFound(res, 'User not found')
    res.json(updated)
  })

  router.delete('/user/:id', (req, res) => {
    const deleted = store.profileService.deleteUser(toNumber(req.params.id))
    if (!deleted) return notFound(res, 'User not found')
    res.json(deleted)
  })

  router.post('/user/:id/restore', (req, res) => {
    const restored = store.profileService.restoreUser(toNumber(req.params.id))
    if (!restored) return notFound(res, 'User not found')
    res.json(restored)
  })

  router.get('/event', (req, res) => {
    const includeDeleted = parseIncludeDeleted(req.query.include_deleted)
    res.json(store.eventService.listEvents(includeDeleted))
  })

  router.get('/event/:id', (req, res) => {
    const event = store.eventService.getEvent(toNumber(req.params.id))
    if (!event) return notFound(res, 'Event not found')
    res.json(event)
  })

  router.post('/event', (req, res) => {
    res.json(store.eventService.createEvent(req.body ?? {}))
  })

  router.put('/event/:id', (req, res) => {
    const updated = store.eventService.updateEvent(toNumber(req.params.id), req.body ?? {})
    if (!updated) return notFound(res, 'Event not found')
    res.json(updated)
  })

  router.delete('/event/:id', (req, res) => {
    const deleted = store.eventService.deleteEvent(toNumber(req.params.id))
    if (!deleted) return notFound(res, 'Event not found')
    res.json(deleted)
  })

  router.post('/event/:eventId/report_gallery/upload', upload.single('file'), (req, res) => {
    const file = req.file
    if (!file) return badRequest(res, 'file is required')
    const metadata = store.eventService.addGalleryFile(toNumber(req.params.eventId), file)
    if (!metadata) return notFound(res, 'Event not found')
    res.json({ success: true, metadata: metadata.report_gallery.at(-1) ?? null })
  })

  router.delete('/event/:eventId/report_gallery/:storedFileId', (req, res) => {
    const ok = store.eventService.removeGalleryFile(toNumber(req.params.eventId), toNumber(req.params.storedFileId))
    if (!ok) return notFound(res, 'Event not found')
    res.status(204).send()
  })

  router.put('/event/:eventId/report_gallery/reorder', (req, res) => {
    const orderedIds = Array.isArray(req.body?.ordered_ids) ? req.body.ordered_ids.map((id: unknown) => toNumber(id)) : []
    const ok = store.eventService.reorderGallery(toNumber(req.params.eventId), orderedIds)
    if (!ok) return notFound(res, 'Event not found')
    res.status(204).send()
  })

  router.patch('/event/:eventId/report_gallery/:storedFileId/rename', (req, res) => {
    const filename = String(req.body?.filename ?? '').trim()
    if (!filename) return badRequest(res, 'filename is required')
    const metadata = store.eventService.renameGalleryFile(toNumber(req.params.storedFileId), filename)
    if (!metadata) return notFound(res, 'File not found')
    res.json({ success: true, metadata })
  })

  router.post('/user/:id/avatar/upload', upload.single('file'), (req, res) => {
    const file = req.file
    if (!file) return badRequest(res, 'file is required')
    const user = store.profileService.uploadAvatar(toNumber(req.params.id), file)
    if (!user) return notFound(res, 'User not found')
    res.json(user)
  })

  router.put('/user/:id/avatar/replace', upload.single('file'), (req, res) => {
    const file = req.file
    if (!file) return badRequest(res, 'file is required')
    const user = store.profileService.replaceAvatar(toNumber(req.params.id), file)
    if (!user) return notFound(res, 'User not found')
    res.json(user)
  })

  router.delete('/user/:id/avatar', (req, res) => {
    const user = store.profileService.clearAvatar(toNumber(req.params.id))
    if (!user) return notFound(res, 'User not found')
    res.json(user)
  })

  router.get('/user/:id/avatar/content', (req, res) => {
    const avatar = store.profileService.getAvatarContent(toNumber(req.params.id))
    if (!avatar) return notFound(res, 'User not found')
    res.setHeader('Content-Type', avatar.contentType)
    res.send(avatar.content)
  })

  router.post('/file-storage/part/create', (req, res) => {
    const name = String(req.body?.name ?? '').trim()
    if (!name) return badRequest(res, 'name is required')
    const part = store.fileApiService.createPart(name, Boolean(req.body?.is_public))
    res.json({ success: true, message: 'part created', part })
  })

  router.get('/file-storage/part/:partName', (req, res) => {
    const part = store.fileApiService.getPart(req.params.partName)
    res.json({ part_name: req.params.partName, exists: !!part })
  })

  router.delete('/file-storage/part/:partName', (req, res) => {
    const exists = store.fileApiService.getPart(req.params.partName)
    if (!exists) return notFound(res, 'Part not found')
    store.fileApiService.deletePart(req.params.partName)
    res.json({ success: true, message: 'part deleted', part: exists })
  })

  router.post('/file-storage/file/upload', upload.single('file'), (req, res) => {
    const file = req.file
    if (!file) return badRequest(res, 'file is required')
    const storagePartName = String(req.body?.storage_part_name ?? 'private')
    const path = String(req.body?.path ?? '')
    if (!path) return badRequest(res, 'path is required')
    const result = store.fileApiService.uploadFile({ storagePartName, path, file })
    if (!result) return badRequest(res, 'path is required')
    res.json({ success: true, ...result })
  })

  router.get('/file-storage/file/download', (req, res) => {
    const storagePartName = String(req.query.storage_part_name ?? '')
    const path = String(req.query.path ?? '')
    const file = store.fileApiService.downloadFile(storagePartName, path)
    if (!file) return notFound(res, 'File not found')
    res.setHeader('Content-Type', file.contentType)
    res.send(file.content)
  })

  router.delete('/file-storage/file/delete', (req, res) => {
    const storagePartName = String(req.query.storage_part_name ?? '')
    const path = String(req.query.path ?? '')
    const result = store.fileApiService.deleteFile(storagePartName, path)
    if (!result) return notFound(res, 'File not found')
    res.json({ success: true, ...result })
  })

  router.get('/file-storage/file/info', (req, res) => {
    const storagePartName = String(req.query.storage_part_name ?? '')
    const path = String(req.query.path ?? '')
    const result = store.fileApiService.getFileInfo(storagePartName, path)
    if (!result) return notFound(res, 'File not found')
    res.json({ success: true, ...result })
  })

  router.get('/file-storage/file/presigned-url', (req, res) => {
    const storagePartName = String(req.query.storage_part_name ?? '')
    const path = String(req.query.path ?? '')
    const expiresIn = toNumber(req.query.expires_in, 3600)
    const result = store.fileApiService.getPresignedUrl(storagePartName, path, expiresIn)
    if (!result) return notFound(res, 'File not found')
    res.json({ success: true, ...result })
  })

  router.get('/file-manager/list', (req, res) => {
    const includeDeleted = parseIncludeDeleted(req.query.include_deleted)
    const pageCount = Math.max(1, toNumber(req.query.page_count, 20))
    const pageNumber = Math.max(1, toNumber(req.query.page_number, 1))
    res.json({ success: true, ...store.fileApiService.listFiles(includeDeleted, pageCount, pageNumber) })
  })

  router.post('/file-manager/upload', upload.single('file'), (req, res) => {
    const file = req.file
    if (!file) return badRequest(res, 'file is required')
    const storagePartName = String(req.body?.storage_part_name ?? 'private')
    const path = String(req.body?.path ?? '')
    const filename = String(req.body?.filename ?? file.originalname)
    const ext = String(req.body?.ext ?? (filename.includes('.') ? filename.split('.').pop() ?? '' : ''))
    const result = store.fileApiService.uploadManagedFile({
      storagePartName,
      path,
      file,
      filename,
      ext,
      replaceExisting: req.body?.with_replace === 'true' || req.body?.with_replace === true,
    })
    if (!result) return badRequest(res, 'path is required')
    res.json({ success: true, ...result })
  })

  router.get('/file-manager/:id', (req, res) => {
    const result = store.fileApiService.getManagedFile(toNumber(req.params.id))
    if (!result) return notFound(res, 'File not found')
    res.json({ success: true, ...result })
  })

  router.get('/file-manager/:id/download', (req, res) => {
    const file = store.fileApiService.downloadManagedFile(toNumber(req.params.id))
    if (!file) return notFound(res, 'File not found')
    res.setHeader('Content-Type', file.contentType)
    res.send(file.content)
  })

  router.get('/file-manager/:id/url', (req, res) => {
    const result = store.fileApiService.getManagedFileUrl(toNumber(req.params.id), toNumber(req.query.expires_in, 3600))
    if (!result) return notFound(res, 'File not found')
    res.json({ success: true, ...result })
  })

  router.post('/file-manager/:id/restore', (req, res) => {
    const result = store.fileApiService.restoreManagedFile(toNumber(req.params.id))
    if (!result) return notFound(res, 'File not found')
    res.json({ success: true, ...result })
  })

  router.put('/file-manager/:id/replace', upload.single('file'), (req, res) => {
    const file = req.file
    if (!file) return badRequest(res, 'file is required')
    const result = store.fileApiService.replaceManagedFile(toNumber(req.params.id), file)
    if (!result) return notFound(res, 'File not found')
    res.json({ success: true, ...result })
  })

  router.delete('/file-manager/:id', (req, res) => {
    const hard = String(req.query.hard ?? 'false') === 'true'
    const result = store.fileApiService.deleteManagedFile(toNumber(req.params.id), hard)
    if (!result) return notFound(res, 'File not found')
    res.json({ success: true, ...result })
  })

  return router
}

function createDevApiRouter(wsApi: {
  broadcast: (payload: unknown) => void
  sendToUser: (userId: number, payload: unknown) => void
  sendToConnection: (connId: number, payload: unknown) => void
}): Router {
  const router = createRouter()

  router.get('/file-storage/part/', (_req, res) => {
    res.json(store.fileApiService.listParts())
  })

  router.patch('/file-storage/part/:partName/public', (req, res) => {
    const partName = req.params.partName
    const isPublic = Boolean(req.body?.is_public)
    const part = store.fileApiService.setPartPublic(partName, isPublic)
    if (!part) return notFound(res, 'Part not found')
    res.json({ success: true, message: 'part updated', part })
  })

  router.get('/file-storage/part/health/check', (_req, res) => {
    res.json({ healthy: true, service: 'file-storage-ts' })
  })

  router.get('/object-container/storage-info', (_req, res) => {
    res.json(store.objectContainer.getStorageInfo())
  })

  router.get('/web-socket/pool', (_req, res) => {
    const connections = store.listWsConnections()
    res.json({
      total_users: new Set(connections.map((c) => c.user_id)).size,
      total_connections: connections.length,
      ping_interval: 30000,
      ping_timeout: 60000,
      connections,
    })
  })

  router.post('/web-socket/send-all', (req, res) => {
    wsApi.broadcast({ type: 'debug', target: 'all', message: String(req.body?.message ?? '') })
    res.json({ success: true })
  })

  router.post('/web-socket/send-user/:userId', (req, res) => {
    wsApi.sendToUser(toNumber(req.params.userId), {
      type: 'debug',
      target: `user:${req.params.userId}`,
      message: String(req.body?.message ?? ''),
    })
    res.json({ success: true })
  })

  router.post('/web-socket/send-connection/:connId', (req, res) => {
    wsApi.sendToConnection(toNumber(req.params.connId), {
      type: 'debug',
      target: `connection:${req.params.connId}`,
      message: String(req.body?.message ?? ''),
    })
    res.json({ success: true })
  })

  return router
}

function createWsRouter() {
  const router = createRouter()
  router.get('/health', (_req, res) => {
    res.json({ healthy: true, service: 'ts-backend' })
  })
  return router
}

export function buildRouters(wsApi: {
  broadcast: (payload: unknown) => void
  sendToUser: (userId: number, payload: unknown) => void
  sendToConnection: (connId: number, payload: unknown) => void
}) {
  return {
    userApi: createUserApiRouter(),
    devApi: createDevApiRouter(wsApi),
    health: createWsRouter(),
  }
}

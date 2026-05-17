import type { Request, Response, Router } from 'express'
import { Router as createRouter } from 'express'
import multer from 'multer'
import { store } from './store.js'
import type { BaseRecord, StoredFileMetadata } from './types.js'

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

type PersonFilter =
  | { field: 'first_name' | 'last_name'; operator: 'ILIKE'; value: string }
  | 'OR'

const normalizeLike = (value: string) => value.replace(/%/g, '').trim().toLowerCase()

const applyPersonFilters = (persons: ReturnType<typeof store.persons.list>, rawFilters: unknown) => {
  if (typeof rawFilters !== 'string' || !rawFilters.trim()) return persons
  try {
    const parsed = JSON.parse(rawFilters) as PersonFilter[]
    const normalized = parsed.filter((item): item is Exclude<PersonFilter, 'OR'> => item !== 'OR')
    if (!normalized.length) return persons
    return persons.filter((person) =>
      normalized.some((filter) => {
        const needle = normalizeLike(filter.value)
        const haystack = String(person[filter.field] ?? '').toLowerCase()
        return filter.operator === 'ILIKE' && haystack.includes(needle)
      })
    )
  } catch {
    return persons
  }
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

const serializeUserResponse = (user: ReturnType<typeof store.users.get>) => {
  if (!user) return null
  return store.serializeUser(user)
}

const serializeEventResponse = (event: ReturnType<typeof store.events.get>) => {
  if (!event) return null
  return {
    ...event,
    report_gallery: event.report_gallery_ids
      .map((id) => store.getFileById(id))
      .filter((file): file is NonNullable<ReturnType<typeof store.getFileById>> => Boolean(file))
      .map((file) => ({
        id: file.id,
        file_storage_part_id: file.file_storage_part_id,
        path: file.path,
        filename: file.filename,
        ext: file.ext,
        size_bytes: file.size_bytes,
        created_at: file.created_at,
        updated_at: file.updated_at,
        deleted_at: file.deleted_at,
      })),
  }
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

function fileMetadataResponse(file: StoredFileMetadata) {
  return {
    success: true,
    metadata: file,
  }
}

function createUserApiRouter(): Router {
  const router = createRouter()

  router.post('/auth/login-confirm-code-start', (req, res) => {
    const authEmail = String(req.body?.auth_email ?? '').trim()
    if (!authEmail) return badRequest(res, 'auth_email is required')
    const token = store.createConfirmation('login', { auth_email: authEmail })
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
    res.json({
      confirmation_token: token.token,
      expires_at: token.expires_at,
    })
  })

  router.post('/auth/login-confirm-code-finish', (req, res) => {
    const confirmationToken = String(req.body?.confirmation_token ?? '')
    const confirmCode = String(req.body?.confirm_code ?? '')
    const record = store.consumeConfirmation(confirmationToken)
    if (!record) return unauthorized(res, 'Confirmation token is invalid or expired')
    if (record.confirm_code !== confirmCode) return badRequest(res, 'Invalid confirmation code')

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
    const record = store.consumeConfirmation(confirmationToken)
    if (!record) return unauthorized(res, 'Confirmation token is invalid or expired')
    if (record.confirm_code !== confirmCode) return badRequest(res, 'Invalid confirmation code')

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

  router.get('/user/current-user', (req, res) => {
    const user = withCurrentUser(req)
    if (!user) return unauthorized(res, 'Access token is invalid or expired')
    res.json(store.buildCurrentUser(user))
  })

  router.use('/contact-info', createCrudRouter(store.contactInfos))
  router.use('/phone-number', createCrudRouter(store.phoneNumbers))
  router.use('/email', createCrudRouter(store.emails))
  router.use('/tg-acc', createCrudRouter(store.tgAccs))
  router.use('/web-link', createCrudRouter(store.webLinks))

  router.get('/person', (req, res) => {
    const includeDeleted = parseIncludeDeleted(req.query.include_deleted)
    const orderBy = String(req.query.order_by ?? 'id')
    const orderDirection = String(req.query.order_direction ?? 'asc')
    const limit = toNumber(req.query.limit, 0)
    const offset = toNumber(req.query.offset, 0)
    let persons = applyPersonFilters(store.persons.list(includeDeleted), req.query.filters)
    persons = [...persons].sort((a, b) => {
      if (orderBy !== 'id') return 0
      return orderDirection === 'desc' ? b.id - a.id : a.id - b.id
    })
    if (limit > 0) {
      persons = persons.slice(offset, offset + limit)
    } else if (offset > 0) {
      persons = persons.slice(offset)
    }
    res.json(persons)
  })

  router.get('/person/:id', (req, res) => {
    const person = store.persons.get(toNumber(req.params.id))
    if (!person) return notFound(res, 'Person not found')
    res.json(person)
  })

  router.post('/person', (req, res) => {
    const created = store.persons.create(req.body ?? {})
    res.json(created)
  })

  router.put('/person/:id', (req, res) => {
    const updated = store.persons.patch(toNumber(req.params.id), req.body ?? {})
    if (!updated) return notFound(res, 'Person not found')
    res.json(updated)
  })

  router.delete('/person/:id', (req, res) => {
    const deleted = store.persons.softDelete(toNumber(req.params.id))
    if (!deleted) return notFound(res, 'Person not found')
    res.json(deleted)
  })

  router.post('/person/:id/restore', (req, res) => {
    const restored = store.persons.restore(toNumber(req.params.id))
    if (!restored) return notFound(res, 'Person not found')
    res.json(restored)
  })

  router.post('/person/vector_search', (req, res) => {
    const query = String(req.body?.query ?? '').trim().toLowerCase()
    const limit = Math.max(1, toNumber(req.body?.limit, 10))
    const results = store.persons
      .list(false)
      .map((person) => {
        const fullName = [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ').toLowerCase()
        const score = query ? (fullName.includes(query) ? 1 : 0) : 0
        return { ...person, score }
      })
      .filter((person) => !query || person.score > 0)
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, limit)
    res.json(results)
  })

  router.get('/user', (req, res) => {
    const includeDeleted = parseIncludeDeleted(req.query.include_deleted)
    res.json(store.users.list(includeDeleted).map((user) => store.serializeUser(user)))
  })

  router.get('/user/:id', (req, res) => {
    const user = store.users.get(toNumber(req.params.id))
    if (!user) return notFound(res, 'User not found')
    res.json(store.serializeUser(user))
  })

  router.post('/user', (req, res) => {
    const created = store.users.create(req.body ?? {})
    res.json(store.serializeUser(created))
  })

  router.put('/user/:id', (req, res) => {
    const updated = store.users.patch(toNumber(req.params.id), req.body ?? {})
    if (!updated) return notFound(res, 'User not found')
    res.json(store.serializeUser(updated))
  })

  router.delete('/user/:id', (req, res) => {
    const deleted = store.users.softDelete(toNumber(req.params.id))
    if (!deleted) return notFound(res, 'User not found')
    res.json(store.serializeUser(deleted))
  })

  router.post('/user/:id/restore', (req, res) => {
    const restored = store.users.restore(toNumber(req.params.id))
    if (!restored) return notFound(res, 'User not found')
    res.json(store.serializeUser(restored))
  })

  router.get('/event', (req, res) => {
    const includeDeleted = parseIncludeDeleted(req.query.include_deleted)
    res.json(store.events.list(includeDeleted).map((event) => serializeEventResponse(event)))
  })

  router.get('/event/:id', (req, res) => {
    const event = store.events.get(toNumber(req.params.id))
    if (!event) return notFound(res, 'Event not found')
    res.json(serializeEventResponse(event))
  })

  router.post('/event', (req, res) => {
    const created = store.events.create({
      ...(req.body ?? {}),
      report_gallery_ids: [],
    })
    res.json(serializeEventResponse(created))
  })

  router.put('/event/:id', (req, res) => {
    const updated = store.events.patch(toNumber(req.params.id), req.body ?? {})
    if (!updated) return notFound(res, 'Event not found')
    res.json(serializeEventResponse(updated))
  })

  router.delete('/event/:id', (req, res) => {
    const deleted = store.events.softDelete(toNumber(req.params.id))
    if (!deleted) return notFound(res, 'Event not found')
    res.json(serializeEventResponse(deleted))
  })

  router.post('/event/:eventId/report_gallery/upload', upload.single('file'), (req, res) => {
    const event = store.events.get(toNumber(req.params.eventId))
    if (!event) return notFound(res, 'Event not found')
    const file = req.file
    if (!file) return badRequest(res, 'file is required')
    const stored = store.storeFile({
      storagePartName: 'event-gallery',
      path: `events/${event.id}/gallery/${file.originalname}`,
      filename: file.originalname,
      ext: file.originalname.includes('.') ? file.originalname.split('.').pop() ?? '' : '',
      content: file.buffer,
      contentType: file.mimetype,
    })
    const nextIds = [...event.report_gallery_ids, stored.id]
    store.events.patch(event.id, { report_gallery_ids: nextIds })
    const serialized = serializeEventResponse(store.events.get(event.id))
    res.json({ success: true, metadata: serialized?.report_gallery.at(-1) ?? null })
  })

  router.delete('/event/:eventId/report_gallery/:storedFileId', (req, res) => {
    const event = store.events.get(toNumber(req.params.eventId))
    if (!event) return notFound(res, 'Event not found')
    const storedFileId = toNumber(req.params.storedFileId)
    const nextIds = event.report_gallery_ids.filter((id) => id !== storedFileId)
    store.events.patch(event.id, { report_gallery_ids: nextIds })
    res.status(204).send()
  })

  router.put('/event/:eventId/report_gallery/reorder', (req, res) => {
    const event = store.events.get(toNumber(req.params.eventId))
    if (!event) return notFound(res, 'Event not found')
    const orderedIds = Array.isArray(req.body?.ordered_ids) ? req.body.ordered_ids.map((id: unknown) => toNumber(id)) : []
    store.events.patch(event.id, { report_gallery_ids: orderedIds })
    res.status(204).send()
  })

  router.patch('/event/:eventId/report_gallery/:storedFileId/rename', (req, res) => {
    const event = store.events.get(toNumber(req.params.eventId))
    if (!event) return notFound(res, 'Event not found')
    const storedFileId = toNumber(req.params.storedFileId)
    const file = store.getFileById(storedFileId)
    if (!file) return notFound(res, 'File not found')
    const filename = String(req.body?.filename ?? '').trim()
    if (!filename) return badRequest(res, 'filename is required')
    const updated = store.files.patch(file.id, { filename })
    if (!updated) return notFound(res, 'File not found')
    res.json({
      success: true,
      metadata: {
        id: updated.id,
        file_storage_part_id: updated.file_storage_part_id,
        path: updated.path,
        filename: updated.filename,
        ext: updated.ext,
        size_bytes: updated.size_bytes,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        deleted_at: updated.deleted_at,
      },
    })
  })

  router.post('/user/:id/avatar/upload', upload.single('file'), (req, res) => {
    const user = store.users.get(toNumber(req.params.id))
    if (!user) return notFound(res, 'User not found')
    const file = req.file
    if (!file) return badRequest(res, 'file is required')
    const stored = store.storeFile({
      storagePartName: 'avatars',
      path: `users/${user.id}/avatar/${file.originalname}`,
      filename: file.originalname,
      ext: file.originalname.includes('.') ? file.originalname.split('.').pop() ?? '' : '',
      content: file.buffer,
      contentType: file.mimetype,
    })
    store.users.patch(user.id, { avatar_id: stored.id })
    res.json(store.serializeUser(store.users.get(user.id) ?? user))
  })

  router.put('/user/:id/avatar/replace', upload.single('file'), (req, res) => {
    const user = store.users.get(toNumber(req.params.id))
    if (!user) return notFound(res, 'User not found')
    const file = req.file
    if (!file) return badRequest(res, 'file is required')
    const stored = store.storeFile({
      storagePartName: 'avatars',
      path: `users/${user.id}/avatar/${file.originalname}`,
      filename: file.originalname,
      ext: file.originalname.includes('.') ? file.originalname.split('.').pop() ?? '' : '',
      content: file.buffer,
      contentType: file.mimetype,
      replaceExisting: true,
    })
    store.users.patch(user.id, { avatar_id: stored.id })
    res.json(store.serializeUser(store.users.get(user.id) ?? user))
  })

  router.delete('/user/:id/avatar', (req, res) => {
    const user = store.users.get(toNumber(req.params.id))
    if (!user) return notFound(res, 'User not found')
    store.users.patch(user.id, { avatar_id: null })
    res.json(store.serializeUser(store.users.get(user.id) ?? user))
  })

  router.get('/user/:id/avatar/content', (req, res) => {
    const user = store.users.get(toNumber(req.params.id))
    if (!user) return notFound(res, 'User not found')
    const file = user.avatar_id ? store.getFileById(user.avatar_id) : null
    const content = file?.content ?? store.getDefaultImage()
    res.setHeader('Content-Type', file?.content_type || 'image/png')
    res.send(content)
  })

  router.post('/file-storage/part/create', (req, res) => {
    const name = String(req.body?.name ?? '').trim()
    if (!name) return badRequest(res, 'name is required')
    const part = store.setPart(name, Boolean(req.body?.is_public))
    res.json({ success: true, message: 'part created', part })
  })

  router.get('/file-storage/part/:partName', (req, res) => {
    const part = store.getPart(req.params.partName)
    res.json({ part_name: req.params.partName, exists: !!part })
  })

  router.delete('/file-storage/part/:partName', (req, res) => {
    const exists = store.getPart(req.params.partName)
    if (!exists) return notFound(res, 'Part not found')
    store.fileParts.delete(req.params.partName)
    res.json({ success: true, message: 'part deleted', part: exists })
  })

  router.post('/file-storage/file/upload', upload.single('file'), (req, res) => {
    const file = req.file
    if (!file) return badRequest(res, 'file is required')
    const storagePartName = String(req.body?.storage_part_name ?? 'private')
    const path = String(req.body?.path ?? '')
    if (!path) return badRequest(res, 'path is required')
    const filename = file.originalname
    const ext = filename.includes('.') ? filename.split('.').pop() ?? '' : ''
    const stored = store.storeFile({
      storagePartName,
      path,
      filename,
      ext,
      content: file.buffer,
      contentType: file.mimetype,
    })
    const { content: _content, ...metadata } = stored
    res.json({
      success: true,
      file_path: { storage_part_name: storagePartName, path },
      metadata,
    })
  })

  router.get('/file-storage/file/download', (req, res) => {
    const storagePartName = String(req.query.storage_part_name ?? '')
    const path = String(req.query.path ?? '')
    const file = store.getFileByPath(storagePartName, path)
    if (!file) return notFound(res, 'File not found')
    res.setHeader('Content-Type', file.content_type || 'application/octet-stream')
    res.send(file.content)
  })

  router.delete('/file-storage/file/delete', (req, res) => {
    const storagePartName = String(req.query.storage_part_name ?? '')
    const path = String(req.query.path ?? '')
    const file = store.deleteFileByPath(storagePartName, path)
    if (!file) return notFound(res, 'File not found')
    res.json({
      success: true,
      file_path: { storage_part_name: storagePartName, path },
    })
  })

  router.get('/file-storage/file/info', (req, res) => {
    const storagePartName = String(req.query.storage_part_name ?? '')
    const path = String(req.query.path ?? '')
    const file = store.getFileByPath(storagePartName, path)
    if (!file) return notFound(res, 'File not found')
    res.json({
      success: true,
      file_info: {
        storage_part_name: storagePartName,
        path,
        size_bytes: file.size_bytes,
        content_type: file.content_type,
        last_modified: file.last_modified,
        etag: file.etag,
      },
    })
  })

  router.get('/file-storage/file/presigned-url', (req, res) => {
    const storagePartName = String(req.query.storage_part_name ?? '')
    const path = String(req.query.path ?? '')
    const expiresIn = toNumber(req.query.expires_in, 3600)
    const file = store.getFileByPath(storagePartName, path)
    if (!file) return notFound(res, 'File not found')
    res.json({
      success: true,
      presigned_url: `/user-api/file-storage/file/download?storage_part_name=${encodeURIComponent(storagePartName)}&path=${encodeURIComponent(path)}`,
      expires_in: expiresIn,
    })
  })

  router.get('/file-manager/list', (req, res) => {
    const includeDeleted = parseIncludeDeleted(req.query.include_deleted)
    const pageCount = Math.max(1, toNumber(req.query.page_count, 20))
    const pageNumber = Math.max(1, toNumber(req.query.page_number, 1))
    const items = store
      .files
      .list(includeDeleted)
      .slice((pageNumber - 1) * pageCount, pageNumber * pageCount)
      .map(({ content: _content, ...metadata }) => metadata)
    res.json({ success: true, items })
  })

  router.post('/file-manager/upload', upload.single('file'), (req, res) => {
    const file = req.file
    if (!file) return badRequest(res, 'file is required')
    const storagePartName = String(req.body?.storage_part_name ?? 'private')
    const path = String(req.body?.path ?? '')
    const filename = String(req.body?.filename ?? file.originalname)
    const ext = String(req.body?.ext ?? (filename.includes('.') ? filename.split('.').pop() ?? '' : ''))
    const stored = store.storeFile({
      storagePartName,
      path,
      filename,
      ext,
      content: file.buffer,
      contentType: file.mimetype,
      replaceExisting: req.body?.with_replace === 'true' || req.body?.with_replace === true,
    })
    const { content: _content, ...metadata } = stored
    res.json({ success: true, metadata })
  })

  router.get('/file-manager/:id', (req, res) => {
    const file = store.getFileById(toNumber(req.params.id))
    if (!file) return notFound(res, 'File not found')
    const { content: _content, ...metadata } = file
    res.json({ success: true, metadata })
  })

  router.get('/file-manager/:id/download', (req, res) => {
    const file = store.getFileById(toNumber(req.params.id))
    if (!file) return notFound(res, 'File not found')
    res.setHeader('Content-Type', file.content_type || 'application/octet-stream')
    res.send(file.content)
  })

  router.get('/file-manager/:id/url', (req, res) => {
    const file = store.getFileById(toNumber(req.params.id))
    if (!file) return notFound(res, 'File not found')
    res.json({
      success: true,
      url: `/user-api/file-manager/${file.id}/download`,
      expires_in: toNumber(req.query.expires_in, 3600),
    })
  })

  router.post('/file-manager/:id/restore', (req, res) => {
    const file = store.files.restore(toNumber(req.params.id))
    if (!file) return notFound(res, 'File not found')
    const { content: _content, ...metadata } = file
    res.json({ success: true, metadata })
  })

  router.put('/file-manager/:id/replace', upload.single('file'), (req, res) => {
    const existing = store.getFileById(toNumber(req.params.id))
    if (!existing) return notFound(res, 'File not found')
    const file = req.file
    if (!file) return badRequest(res, 'file is required')
    const stored = store.storeFile({
      storagePartName: existing.storage_part_name,
      path: existing.path,
      filename: file.originalname,
      ext: existing.ext,
      content: file.buffer,
      contentType: file.mimetype,
      replaceExisting: true,
    })
    const { content: _content, ...metadata } = stored
    res.json({ success: true, metadata })
  })

  router.delete('/file-manager/:id', (req, res) => {
    const hard = String(req.query.hard ?? 'false') === 'true'
    const file = store.deleteFileById(toNumber(req.params.id), hard)
    if (!file) return notFound(res, 'File not found')
    const { content: _content, ...metadata } = file
    res.json({ success: true, metadata })
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
    res.json({ parts: store.getPartNames(), count: store.getPartNames().length })
  })

  router.patch('/file-storage/part/:partName/public', (req, res) => {
    const partName = req.params.partName
    const exists = store.getPart(partName)
    if (!exists) return notFound(res, 'Part not found')
    const isPublic = Boolean(req.body?.is_public)
    const part = store.setPart(partName, isPublic)
    res.json({ success: true, message: 'part updated', part })
  })

  router.get('/file-storage/part/health/check', (_req, res) => {
    res.json({ healthy: true, service: 'file-storage-ts' })
  })

  router.get('/object-container/storage-info', (_req, res) => {
    const objectList = store.getPartNames().map((category) => {
      const objects = store
        .files
        .list(true)
        .filter((file) => file.storage_part_name === category)
        .map((file) => ({
          id: String(file.id),
          created_at: file.created_at,
          last_accessed: file.updated_at,
          ttl_seconds: 86400,
          expires_at: file.deleted_at ? file.deleted_at : null,
        }))
      return {
        category,
        object_count: objects.length,
        objects,
      }
    })
    res.json({
      summary: {
        total_categories: objectList.length,
        total_objects: objectList.reduce((sum, category) => sum + category.object_count, 0),
      },
      object_list: objectList,
    })
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

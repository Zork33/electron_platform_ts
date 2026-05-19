import type { Request, Response, Router } from 'express'
import { Router as createRouter } from 'express'
import multer from 'multer'
import { badRequest, conflict, notFound, unauthorized, validationError } from './api-errors.js'
import { store } from './store.js'
import type { BaseRecord } from './types.js'
import type { WsConnectionInfo } from './types.js'

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

const authTokenFromRequest = (req: Request): string | null => {
  const header = req.header('Authorization') || ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
}

const buildManagedDownloadDisposition = (filename: string, ext: string): string => {
  const downloadFilename = `${filename}.${ext}`
  const asciiFilename = /^[\x00-\x7F]+$/.test(downloadFilename) ? downloadFilename : `download.${ext}`
  const encodedFilename = encodeURIComponent(downloadFilename)
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`
}

const isEmailAddress = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const buildPathDownloadFilename = (path: string): string => {
  const segments = path.split('/')
  return segments.length > 0 ? segments[segments.length - 1] || path : path
}

type CrudFilterPredicate = (item: Record<string, unknown>) => boolean

const compareCrudValues = (left: unknown, right: unknown): number => {
  if (left === right) return 0
  if (left === null || left === undefined) return -1
  if (right === null || right === undefined) return 1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right)
  return String(left).localeCompare(String(right))
}

const resolveCrudFieldValue = (item: Record<string, unknown>, field: string): unknown => item[field]

const buildCrudFilter = (filter: { field: string; operator: string; value: unknown }): CrudFilterPredicate => {
  const operator = filter.operator.toUpperCase()
  return (item) => {
    const left = resolveCrudFieldValue(item, filter.field)
    const right = filter.value

    switch (operator) {
      case '=':
        return left === right
      case '>':
        return compareCrudValues(left, right) > 0
      case '<':
        return compareCrudValues(left, right) < 0
      case '>=':
        return compareCrudValues(left, right) >= 0
      case '<=':
        return compareCrudValues(left, right) <= 0
      case '!=':
      case '<>':
        return left !== right
      case 'LIKE':
      case 'ILIKE': {
        const needle = String(right ?? '').replace(/%/g, '')
        const haystack = String(left ?? '')
        return operator === 'ILIKE'
          ? haystack.toLowerCase().includes(needle.toLowerCase())
          : haystack.includes(needle)
      }
      case 'IN':
        return Array.isArray(right) ? right.some((value) => value === left) : false
      case 'NOT IN':
        return Array.isArray(right) ? !right.some((value) => value === left) : false
      case 'IS':
        return right === null ? left === null || left === undefined : left === right
      case 'IS NOT':
        return right === null ? !(left === null || left === undefined) : left !== right
      default:
        return false
    }
  }
}

const parseCrudFilters = (value: unknown): CrudFilterPredicate[] | null => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = JSON.parse(value) as Array<unknown>
    if (!Array.isArray(parsed)) return null
    const predicates: CrudFilterPredicate[] = []
    for (const item of parsed) {
      if (item === 'AND' || item === 'OR') continue
      if (!item || typeof item !== 'object') return null
      const candidate = item as { field?: unknown; operator?: unknown; value?: unknown }
      if (typeof candidate.field !== 'string' || typeof candidate.operator !== 'string') return null
      predicates.push(buildCrudFilter({ field: candidate.field, operator: candidate.operator, value: candidate.value }))
    }
    return predicates
  } catch {
    return null
  }
}

const withCurrentUser = (req: Request) => {
  const token = authTokenFromRequest(req)
  if (!token) return null
  return store.auth.getUserByAccessToken(token)
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
    const limitRaw = req.query.limit
    const offsetRaw = req.query.offset
    const orderBy = req.query.order_by ? String(req.query.order_by) : null
    const orderDirection = String(req.query.order_direction ?? 'asc').toLowerCase()
    if (orderDirection !== 'asc' && orderDirection !== 'desc') {
      return badRequest(res, "Order direction must be 'asc' or 'desc'")
    }

    const limit = limitRaw === undefined ? 100 : toNumber(limitRaw, NaN)
    const offset = offsetRaw === undefined ? 0 : toNumber(offsetRaw, NaN)
    if (!Number.isFinite(limit) || limit < 1 || limit > 1000) {
      return validationError(res, 'limit must be between 1 and 1000', 'VALIDATION_ERROR')
    }
    if (!Number.isFinite(offset) || offset < 0) {
      return validationError(res, 'offset must be greater than or equal to 0', 'VALIDATION_ERROR')
    }

    const parsedFilters = parseCrudFilters(req.query.filters)
    if (req.query.filters && parsedFilters === null) {
      return badRequest(res, 'Filters must be a JSON array')
    }

    let items = collection.list(includeDeleted)
    if (parsedFilters && parsedFilters.length) {
      items = items.filter((item) => parsedFilters.every((predicate) => predicate(item as unknown as Record<string, unknown>)))
    }

    items = [...items].sort((left, right) => {
      if (!orderBy) return left.id - right.id
      return orderDirection === 'desc'
        ? compareCrudValues(
            resolveCrudFieldValue(right as unknown as Record<string, unknown>, orderBy),
            resolveCrudFieldValue(left as unknown as Record<string, unknown>, orderBy)
          )
        : compareCrudValues(
            resolveCrudFieldValue(left as unknown as Record<string, unknown>, orderBy),
            resolveCrudFieldValue(right as unknown as Record<string, unknown>, orderBy)
          )
    })

    if (limit > 0) {
      items = items.slice(offset, offset + limit)
    }
    res.json(ok(items))
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

  router.post('/auth/login-confirm-code-start', async (req, res) => {
    const authEmail = String(req.body?.auth_email ?? '').trim()
    if (!authEmail) return validationError(res, 'auth_email is required', 'VALIDATION_ERROR')
    if (!isEmailAddress(authEmail)) return validationError(res, 'auth_email is invalid', 'VALIDATION_ERROR')
    const result = await store.authApiService.startLogin(authEmail)
    if (!result.ok) {
      if (result.status === 404) return notFound(res, result.error, 'USER_NOT_FOUND')
      return validationError(res, result.error, result.status === 422 ? 'USER_ACCESS_DENIED' : 'VALIDATION_ERROR')
    }
    res.json(result)
  })

  router.post('/auth/registration-confirm-code-start', async (req, res) => {
    const authEmail = String(req.body?.auth_email ?? '').trim()
    const firstName = String(req.body?.first_name ?? '').trim()
    if (!authEmail) return validationError(res, 'auth_email is required', 'VALIDATION_ERROR')
    if (!firstName) return validationError(res, 'first_name is required', 'VALIDATION_ERROR')
    if (!isEmailAddress(authEmail)) return validationError(res, 'auth_email is invalid', 'VALIDATION_ERROR')
    const result = await store.authApiService.startRegistration({
      auth_email: authEmail,
      first_name: firstName,
      last_name: req.body?.last_name ? String(req.body.last_name) : null,
      middle_name: req.body?.middle_name ? String(req.body.middle_name) : null,
    })
    if (!result.ok) {
      return result.status === 409 ? conflict(res, result.error, 'USER_ALREADY_EXISTS') : badRequest(res, result.error)
    }
    res.json(result)
  })

  router.post('/auth/login-confirm-code-finish', (req, res) => {
    const confirmationToken = String(req.body?.confirmation_token ?? '')
    const confirmCode = String(req.body?.confirm_code ?? '')
    const result = store.authApiService.finishLogin(confirmationToken, confirmCode)
    if (!result || 'ok' in result) {
      const error = result && 'error' in result ? result.error ?? 'Invalid confirmation code' : 'Invalid confirmation code'
      const errorCode = result && 'error_code' in result ? result.error_code : 'VALIDATION_ERROR'
      return result && 'status' in result && result.status === 404 ? notFound(res, error, errorCode) : validationError(res, error, errorCode)
    }
    res.json(result)
  })

  router.post('/auth/registration-confirm-code-finish', (req, res) => {
    const confirmationToken = String(req.body?.confirmation_token ?? '')
    const confirmCode = String(req.body?.confirm_code ?? '')
    const result = store.authApiService.finishRegistration(confirmationToken, confirmCode)
    if (!result || 'ok' in result) {
      const error = result && 'error' in result ? result.error ?? 'Invalid confirmation code' : 'Invalid confirmation code'
      const errorCode = result && 'error_code' in result ? result.error_code : 'VALIDATION_ERROR'
      return result && 'status' in result && result.status === 404 ? notFound(res, error, errorCode) : validationError(res, error, errorCode)
    }
    res.json(result)
  })

  router.post('/auth/access-token-refresh', (req, res) => {
    const token = authTokenFromRequest(req)
    if (!token) return unauthorized(res, 'Authorization header is required')
    const refreshed = store.authApiService.refreshAccessToken(token)
    if (!refreshed) return unauthorized(res, 'Access token is invalid or expired')
    res.json(refreshed)
  })

  router.post('/auth/logout', (req, res) => {
    const token = authTokenFromRequest(req)
    if (!token) return unauthorized(res, 'Authorization header is required')
    store.authApiService.logout(token)
    res.json({ success: true })
  })

  router.post('/auth/logout-all', (req, res) => {
    const token = authTokenFromRequest(req)
    if (!token) return unauthorized(res, 'Authorization header is required')
    const result = store.authApiService.logoutAll(token)
    if (!result) return unauthorized(res, 'Access token is invalid or expired')
    res.json({ success: true, revoked_tokens: result.revoked_tokens })
  })

  router.get('/user/current-user', (req, res) => {
    const user = withCurrentUser(req)
    if (!user) return unauthorized(res, 'Access token is invalid or expired', 'UNAUTHORIZED')
    res.json(store.profileService.getCurrentUser(user))
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
    const rawScoreThreshold = req.body?.score_threshold ?? req.query.score_threshold
    const parsedScoreThreshold = Number(rawScoreThreshold)
    const scoreThreshold = Number.isFinite(parsedScoreThreshold) ? parsedScoreThreshold : null
    res.json(
      store.profileService.vectorSearch(query, limit, scoreThreshold).map((person) => ({
        ...person,
        score: Number(person.score.toFixed(4)),
      }))
    )
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
    const limitRaw = req.query.limit
    const offsetRaw = req.query.offset
    const orderBy = req.query.order_by ? String(req.query.order_by) : null
    const orderDirection = String(req.query.order_direction ?? 'asc').toLowerCase()
    if (orderDirection !== 'asc' && orderDirection !== 'desc') {
      return badRequest(res, "Order direction must be 'asc' or 'desc'")
    }

    const limit = limitRaw === undefined ? 100 : toNumber(limitRaw, NaN)
    const offset = offsetRaw === undefined ? 0 : toNumber(offsetRaw, NaN)
    if (!Number.isFinite(limit) || limit < 1 || limit > 1000) {
      return validationError(res, 'limit must be between 1 and 1000', 'VALIDATION_ERROR')
    }
    if (!Number.isFinite(offset) || offset < 0) {
      return validationError(res, 'offset must be greater than or equal to 0', 'VALIDATION_ERROR')
    }

    const parsedFilters = parseCrudFilters(req.query.filters)
    if (req.query.filters && parsedFilters === null) {
      return badRequest(res, 'Filters must be a JSON array')
    }

    let items = store.eventService.listEvents(includeDeleted)
    if (parsedFilters && parsedFilters.length) {
      items = items.filter((item) => parsedFilters.every((predicate) => predicate(item as unknown as Record<string, unknown>)))
    }

    items = [...items].sort((left, right) => {
      if (!orderBy) return left.id - right.id
      return orderDirection === 'desc'
        ? compareCrudValues(
            resolveCrudFieldValue(right as unknown as Record<string, unknown>, orderBy),
            resolveCrudFieldValue(left as unknown as Record<string, unknown>, orderBy)
          )
        : compareCrudValues(
            resolveCrudFieldValue(left as unknown as Record<string, unknown>, orderBy),
            resolveCrudFieldValue(right as unknown as Record<string, unknown>, orderBy)
          )
    })

    if (limit > 0) {
      items = items.slice(offset, offset + limit)
    }
    res.json(items)
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
    if (!file) return validationError(res, 'file is required', 'VALIDATION_ERROR')
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
    if (!filename) return validationError(res, 'filename is required', 'VALIDATION_ERROR')
    const metadata = store.eventService.renameGalleryFile(toNumber(req.params.storedFileId), filename)
    if (!metadata) return notFound(res, 'File not found')
    res.json({ success: true, metadata })
  })

  router.post('/user/:id/avatar/upload', upload.single('file'), (req, res) => {
    const file = req.file
    if (!file) return validationError(res, 'file is required', 'VALIDATION_ERROR')
    try {
      const user = store.profileService.uploadAvatar(toNumber(req.params.id), file)
      if (!user) return notFound(res, 'User not found')
      res.json(user)
    } catch (error) {
      return badRequest(res, error instanceof Error ? error.message : 'Invalid avatar file')
    }
  })

  router.put('/user/:id/avatar/replace', upload.single('file'), (req, res) => {
    const file = req.file
    if (!file) return validationError(res, 'file is required', 'VALIDATION_ERROR')
    try {
      const user = store.profileService.replaceAvatar(toNumber(req.params.id), file)
      if (!user) return notFound(res, 'User not found')
      res.json(user)
    } catch (error) {
      return badRequest(res, error instanceof Error ? error.message : 'Invalid avatar file')
    }
  })

  router.delete('/user/:id/avatar', (req, res) => {
    const user = store.profileService.clearAvatar(toNumber(req.params.id))
    if (!user) return notFound(res, 'User not found')
    res.json(user)
  })

  router.get('/user/:id/avatar/content', (req, res) => {
    const user = store.profileService.getUser(toNumber(req.params.id))
    if (!user) return notFound(res, 'User not found')
    const avatar = store.profileService.getAvatarContent(user.id)
    if (!avatar) return notFound(res, 'Avatar not found')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', avatar.contentType)
    res.send(avatar.content)
  })

  router.post('/file-storage/part/create', (req, res) => {
    const name = String(req.body?.name ?? '').trim()
    if (!name) return validationError(res, 'name is required', 'VALIDATION_ERROR')
    const part = store.fileApiService.createPart(name, Boolean(req.body?.is_public))
    if (!part) return conflict(res, `Part '${name}' already exists`)
    res.json({
      success: true,
      message: `Part '${name}' created successfully`,
      part: {
        name: part.name,
        is_public: part.is_public,
      },
    })
  })

  router.get('/file-storage/part/:partName', (req, res) => {
    const part = store.fileApiService.getPart(req.params.partName)
    res.json({ part_name: req.params.partName, exists: !!part })
  })

  router.delete('/file-storage/part/:partName', (req, res) => {
    const exists = store.fileApiService.getPart(req.params.partName)
    if (!exists) return notFound(res, 'Part not found')
    store.fileApiService.deletePart(req.params.partName)
    res.json({
      success: true,
      message: `Part '${req.params.partName}' deleted successfully`,
    })
  })

  router.post('/file-storage/file/upload', upload.single('file'), (req, res) => {
    const file = req.file
    if (!file) return validationError(res, 'file is required', 'VALIDATION_ERROR')
    const storagePartName = String(req.body?.storage_part_name ?? '')
    if (!storagePartName) return validationError(res, 'storage_part_name is required', 'VALIDATION_ERROR')
    const path = String(req.body?.path ?? '')
    if (!path) return validationError(res, 'path is required', 'VALIDATION_ERROR')
    if (!store.fileApiService.getPart(storagePartName)) return notFound(res, `Storage part '${storagePartName}' not found`)
    try {
      const result = store.fileApiService.uploadFile({ storagePartName, path, file })
      if (!result) return badRequest(res, 'path is required')
      res.json({
        success: true,
        message: 'File uploaded successfully',
        file_path: result.file_path,
        size_bytes: result.metadata.size_bytes,
        etag: result.metadata.etag,
      })
    } catch (error) {
      return badRequest(res, error instanceof Error ? error.message : 'Invalid file upload')
    }
  })

  router.get('/file-storage/file/download', (req, res) => {
    const storagePartName = String(req.query.storage_part_name ?? '')
    const path = String(req.query.path ?? '')
    if (!storagePartName) return validationError(res, 'storage_part_name is required', 'VALIDATION_ERROR')
    if (!path) return validationError(res, 'path is required', 'VALIDATION_ERROR')
    const file = store.fileApiService.downloadFile(storagePartName, path)
    if (!file) return notFound(res, 'File not found')
    const filename = buildPathDownloadFilename(path)
    res.setHeader('Content-Type', file.contentType)
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
    res.send(file.content)
  })

  router.delete('/file-storage/file/delete', (req, res) => {
    const storagePartName = String(req.query.storage_part_name ?? '')
    const path = String(req.query.path ?? '')
    if (!storagePartName) return validationError(res, 'storage_part_name is required', 'VALIDATION_ERROR')
    if (!path) return validationError(res, 'path is required', 'VALIDATION_ERROR')
    const result = store.fileApiService.deleteFile(storagePartName, path)
    if (!result) return notFound(res, 'File not found')
    res.json({
      success: true,
      message: 'File deleted successfully',
      ...result,
    })
  })

  router.get('/file-storage/file/info', (req, res) => {
    const storagePartName = String(req.query.storage_part_name ?? '')
    const path = String(req.query.path ?? '')
    if (!storagePartName) return validationError(res, 'storage_part_name is required', 'VALIDATION_ERROR')
    if (!path) return validationError(res, 'path is required', 'VALIDATION_ERROR')
    const result = store.fileApiService.getFileInfo(storagePartName, path)
    if (!result) return notFound(res, 'File not found')
    res.json({ success: true, ...result })
  })

  router.get('/file-storage/file/presigned-url', (req, res) => {
    const storagePartName = String(req.query.storage_part_name ?? '')
    const path = String(req.query.path ?? '')
    const expiresIn = toNumber(req.query.expires_in, 3600)
    if (!storagePartName) return validationError(res, 'storage_part_name is required', 'VALIDATION_ERROR')
    if (!path) return validationError(res, 'path is required', 'VALIDATION_ERROR')
    const result = store.fileApiService.getPresignedUrl(storagePartName, path, expiresIn)
    if (!result) return notFound(res, 'File not found')
    res.json({
      success: true,
      ...result,
      file_path: {
        storage_part_name: storagePartName,
        path,
      },
    })
  })

  router.get('/file-manager/list', (req, res) => {
    const includeDeleted = parseIncludeDeleted(req.query.include_deleted)
    const pageCount = toNumber(req.query.page_count, 20)
    const pageNumber = toNumber(req.query.page_number, 1)
    if (pageCount < 0) return validationError(res, 'page_count must be greater than or equal to 0', 'VALIDATION_ERROR')
    if (pageNumber <= 0) return validationError(res, 'page_number must be greater than 0', 'VALIDATION_ERROR')
    res.json({ success: true, ...store.fileApiService.listFiles(includeDeleted, pageCount, pageNumber) })
  })

  router.post('/file-manager/upload', upload.single('file'), (req, res) => {
    const file = req.file
    if (!file) return validationError(res, 'file is required', 'VALIDATION_ERROR')
    const storagePartName = String(req.body?.storage_part_name ?? 'private').toLowerCase()
    const path = String(req.body?.path ?? '')
    const filename = String(req.body?.filename ?? '')
    const ext = String(req.body?.ext ?? '')
    if (!filename) return validationError(res, 'filename is required', 'VALIDATION_ERROR')
    if (!ext) return validationError(res, 'ext is required', 'VALIDATION_ERROR')
    if (!['private', 'public'].includes(storagePartName))
      return badRequest(res, `Unknown storage part: ${storagePartName}`)
    if (!path) return validationError(res, 'path is required', 'VALIDATION_ERROR')
    try {
      const result = store.fileApiService.uploadManagedFile({
        storagePartName,
        path,
        file,
        filename,
        ext,
        replaceExisting: req.body?.with_replace === 'true' || req.body?.with_replace === true,
      })
      if (!result) return validationError(res, 'path is required', 'VALIDATION_ERROR')
      res.json({ success: true, ...result })
    } catch (error) {
      return badRequest(res, error instanceof Error ? error.message : 'Invalid file upload')
    }
  })

  router.get('/file-manager/:id', (req, res) => {
    const result = store.fileApiService.getManagedFile(toNumber(req.params.id))
    if (!result) return notFound(res, 'File not found')
    res.json({ success: true, ...result })
  })

  router.get('/file-manager/:id/download', (req, res) => {
    const metadata = store.fileApiService.getManagedFile(toNumber(req.params.id))
    if (!metadata) return notFound(res, 'File not found')
    const file = store.fileApiService.downloadManagedFile(toNumber(req.params.id))
    if (!file) return notFound(res, 'File not found in storage')
    res.setHeader('Content-Type', file.contentType)
    res.setHeader(
      'Content-Disposition',
      buildManagedDownloadDisposition(metadata.metadata.filename, metadata.metadata.ext)
    )
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
    if (!file) return validationError(res, 'file is required', 'VALIDATION_ERROR')
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
    if (typeof req.body?.is_public !== 'boolean') {
      return validationError(res, 'is_public is required', 'VALIDATION_ERROR')
    }
    const isPublic = req.body.is_public
    const part = store.fileApiService.setPartPublic(partName, isPublic)
    if (!part) return notFound(res, 'Part not found')
    res.json({
      success: true,
      message: `Part '${partName}' public status set to ${isPublic}`,
      part: {
        name: part.name,
        is_public: part.is_public,
      },
    })
  })

  router.get('/file-storage/part/health/check', (_req, res) => {
    res.json({ healthy: true, service: 'file_storage' })
  })

  router.post('/file-storage/part/sync', (_req, res) => {
    store.fileStorage.ensureSystemParts()
    res.json({ success: true, message: 'Storage parts synchronized successfully' })
  })

  router.get('/object-container/storage-info', (_req, res) => {
    res.json(store.objectContainer.getStorageInfo())
  })

  router.get('/object-container/cleaner-info', (_req, res) => {
    res.json(store.objectContainer.getCleanerInfo())
  })

  router.get('/object-container/container-info', (_req, res) => {
    res.json(store.objectContainer.getContainerInfo())
  })

  router.get('/object-container/all-statistics', (_req, res) => {
    res.json(store.objectContainer.getAllStatistics())
  })

  router.get('/web-socket/pool', (_req, res) => {
    const connections = store.ws.listConnections()
    res.json({
      total_users: new Set(connections.map((c: WsConnectionInfo) => c.user_id)).size,
      total_connections: connections.length,
      ping_interval: 30,
      ping_timeout: 10,
      connections,
    })
  })

  router.post('/web-socket/send-all', (req, res) => {
    const message = String(req.body?.message ?? '')
    wsApi.broadcast({ type: 'debug', target: 'all', message })
    res.json({ sent: true, target: 'all' })
  })

  router.post('/web-socket/send-user/:userId', (req, res) => {
    const userId = toNumber(req.params.userId)
    const message = String(req.body?.message ?? '')
    wsApi.sendToUser(toNumber(req.params.userId), {
      type: 'debug',
      target: 'user',
      user_id: userId,
      message,
    })
    res.json({ sent: true, target: 'user', user_id: userId })
  })

  router.post('/web-socket/send-connection/:connId', (req, res) => {
    const connId = toNumber(req.params.connId)
    const message = String(req.body?.message ?? '')
    wsApi.sendToConnection(toNumber(req.params.connId), {
      type: 'debug',
      target: 'connection',
      conn_id: connId,
      message,
    })
    res.json({ sent: true, target: 'connection', conn_id: connId })
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

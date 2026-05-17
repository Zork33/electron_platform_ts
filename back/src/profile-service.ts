import type { CrudCollection } from './record-collection.js'
import type { FileStorageService } from './file-storage.js'
import type { CurrentUserResponse, Person, StoredFileRecord, User } from './types.js'

export interface AvatarMetadata {
  id: number
  file_storage_part_id: number
  storage_part_name: string
  path: string
  filename: string
  ext: string
  size_bytes: number
  content_type: string | null
  last_modified: string | null
  etag: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ProfileServiceDeps {
  persons: CrudCollection<Person>
  users: CrudCollection<User>
  fileStorage: FileStorageService
  sessionTtlHours?: number
}

export class ProfileService {
  constructor(private readonly deps: ProfileServiceDeps) {}

  listPersons(includeDeleted = false, filters?: unknown, orderBy = 'id', orderDirection = 'asc', limit = 0, offset = 0) {
    const parsed = this.applyPersonFilters(this.deps.persons.list(includeDeleted), filters)
    const sorted = [...parsed].sort((a, b) => {
      if (orderBy !== 'id') return 0
      return orderDirection === 'desc' ? b.id - a.id : a.id - b.id
    })
    if (limit > 0) return sorted.slice(offset, offset + limit)
    if (offset > 0) return sorted.slice(offset)
    return sorted
  }

  getPerson(id: number) {
    return this.deps.persons.get(id)
  }

  createPerson(data: Partial<Person>) {
    return this.deps.persons.create(data)
  }

  updatePerson(id: number, data: Partial<Person>) {
    return this.deps.persons.patch(id, data)
  }

  deletePerson(id: number) {
    return this.deps.persons.softDelete(id)
  }

  restorePerson(id: number) {
    return this.deps.persons.restore(id)
  }

  vectorSearch(query: string, limit = 10, scoreThreshold?: number | null) {
    const normalizedQuery = query.trim().toLowerCase()
    return this.deps.persons
      .list(false)
      .map((person) => {
        const haystack = [person.last_name, person.first_name, person.middle_name, person.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        const score = normalizedQuery ? this.scoreText(normalizedQuery, haystack) : 0
        return { ...person, score }
      })
      .filter((person) => {
        if (!normalizedQuery) return true
        if (typeof scoreThreshold === 'number' && Number.isFinite(scoreThreshold)) {
          return person.score >= scoreThreshold
        }
        return person.score > 0
      })
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, Math.max(1, limit))
  }

  private scoreText(query: string, text: string): number {
    const queryVector = this.buildVector(query)
    const textVector = this.buildVector(text)
    let dot = 0
    let queryNorm = 0
    let textNorm = 0
    for (const [token, weight] of queryVector.entries()) {
      queryNorm += weight * weight
      const textWeight = textVector.get(token) ?? 0
      dot += weight * textWeight
    }
    for (const weight of textVector.values()) {
      textNorm += weight * weight
    }
    if (!dot || !queryNorm || !textNorm) return 0
    return dot / (Math.sqrt(queryNorm) * Math.sqrt(textNorm))
  }

  private buildVector(text: string): Map<string, number> {
    const normalized = text.replace(/\s+/g, ' ').trim()
    const vector = new Map<string, number>()
    if (!normalized) return vector
    const padded = `  ${normalized}  `
    for (let index = 0; index < padded.length - 2; index += 1) {
      const token = padded.slice(index, index + 3)
      vector.set(token, (vector.get(token) ?? 0) + 1)
    }
    return vector
  }

  listUsers(includeDeleted = false) {
    return this.deps.users.list(includeDeleted).map((user) => this.serializeUser(user))
  }

  getUser(id: number) {
    const user = this.deps.users.get(id)
    return user ? this.serializeUser(user) : null
  }

  findUserByEmail(authEmail: string) {
    const user = this.deps.users.all().find((candidate) => candidate.auth_email === authEmail)
    return user ? this.serializeUser(user) : null
  }

  createUser(data: Partial<User>) {
    return this.serializeUser(this.deps.users.create(data))
  }

  updateUser(id: number, data: Partial<User>) {
    const updated = this.deps.users.patch(id, data)
    return updated ? this.serializeUser(updated) : null
  }

  deleteUser(id: number) {
    const deleted = this.deps.users.softDelete(id)
    return deleted ? this.serializeUser(deleted) : null
  }

  restoreUser(id: number) {
    const restored = this.deps.users.restore(id)
    return restored ? this.serializeUser(restored) : null
  }

  ensureUserByEmail(
    authEmail: string,
    personData?: { first_name?: string | null; last_name?: string | null; middle_name?: string | null }
  ): User {
    const existing = this.deps.users.all().find((user) => user.auth_email === authEmail)
    if (existing) return existing

    const person = this.deps.persons.create({
      first_name: personData?.first_name ?? authEmail.split('@')[0] ?? 'User',
      last_name: personData?.last_name ?? null,
      middle_name: personData?.middle_name ?? null,
      birth_date: null,
      description: null,
    })

    return this.deps.users.create({
      person_id: person.id,
      auth_email: authEmail,
      has_access: true,
      is_admin: false,
      session_expires_at: new Date(Date.now() + (this.deps.sessionTtlHours ?? 24 * 7) * 60 * 60 * 1000).toISOString(),
      avatar_id: null,
      auth_telegram_id: null,
    })
  }

  getCurrentUser(user: User): CurrentUserResponse {
    const person = user.person_id ? this.deps.persons.get(user.person_id) : null
    return {
      user_id: user.id,
      auth_email: user.auth_email,
      auth_telegram_id: user.auth_telegram_id,
      has_access: user.has_access,
      auth_session_expires_at: user.session_expires_at,
      is_admin: user.is_admin,
      person: person
        ? {
            person_id: person.id,
            first_name: person.first_name,
            last_name: person.last_name,
            middle_name: person.middle_name,
            birth_date: person.birth_date,
          }
        : null,
    }
  }

  uploadAvatar(userId: number, file: { originalname: string; buffer: Buffer; mimetype: string }) {
    const user = this.deps.users.get(userId)
    if (!user) return null
    const stored = this.deps.fileStorage.storeFile({
      storagePartName: 'avatars',
      path: `users/${user.id}/avatar/${file.originalname}`,
      filename: file.originalname,
      ext: file.originalname.includes('.') ? file.originalname.split('.').pop() ?? '' : '',
      content: file.buffer,
      contentType: file.mimetype,
    })
    this.deps.users.patch(user.id, { avatar_id: stored.id })
    return this.serializeUser(this.deps.users.get(user.id) ?? user)
  }

  replaceAvatar(userId: number, file: { originalname: string; buffer: Buffer; mimetype: string }) {
    const user = this.deps.users.get(userId)
    if (!user) return null
    const stored = this.deps.fileStorage.storeFile({
      storagePartName: 'avatars',
      path: `users/${user.id}/avatar/${file.originalname}`,
      filename: file.originalname,
      ext: file.originalname.includes('.') ? file.originalname.split('.').pop() ?? '' : '',
      content: file.buffer,
      contentType: file.mimetype,
      replaceExisting: true,
    })
    this.deps.users.patch(user.id, { avatar_id: stored.id })
    return this.serializeUser(this.deps.users.get(user.id) ?? user)
  }

  clearAvatar(userId: number) {
    const user = this.deps.users.get(userId)
    if (!user) return null
    this.deps.users.patch(user.id, { avatar_id: null })
    return this.serializeUser(this.deps.users.get(user.id) ?? user)
  }

  getAvatarContent(userId: number): { content: Buffer; contentType: string } | null {
    const user = this.deps.users.get(userId)
    if (!user) return null
    const file = user.avatar_id ? this.deps.fileStorage.getFileById(user.avatar_id) : null
    return {
      content: file?.content ?? this.deps.fileStorage.getDefaultImage(),
      contentType: file?.content_type || 'image/png',
    }
  }

  serializeUser(user: User): User & { avatar: AvatarMetadata | null } {
    return {
      ...user,
      avatar: user.avatar_id ? this.serializeAvatarMetadata(this.deps.fileStorage.getFileById(user.avatar_id)) : null,
    }
  }

  private serializeAvatarMetadata(file: StoredFileRecord | null): AvatarMetadata | null {
    return file
      ? {
          id: file.id,
          file_storage_part_id: file.file_storage_part_id,
          storage_part_name: file.storage_part_name,
          path: file.path,
          filename: file.filename,
          ext: file.ext,
          size_bytes: file.size_bytes,
          content_type: file.content_type,
          last_modified: file.last_modified,
          etag: file.etag,
          created_at: file.created_at,
          updated_at: file.updated_at,
          deleted_at: file.deleted_at,
        }
      : null
  }

  private applyPersonFilters(persons: Person[], rawFilters: unknown) {
    if (typeof rawFilters !== 'string' || !rawFilters.trim()) return persons
    try {
      const parsed = JSON.parse(rawFilters) as Array<{ field: 'first_name' | 'last_name'; operator: 'ILIKE'; value: string } | 'OR'>
      const normalized = parsed.filter((item): item is Exclude<typeof item, 'OR'> => item !== 'OR')
      if (!normalized.length) return persons
      return persons.filter((person) =>
        normalized.some((filter) => {
          const needle = filter.value.replace(/%/g, '').trim().toLowerCase()
          const haystack = String(person[filter.field] ?? '').toLowerCase()
          return filter.operator === 'ILIKE' && haystack.includes(needle)
        })
      )
    } catch {
      return persons
    }
  }
}

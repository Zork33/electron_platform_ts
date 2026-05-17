import crypto from 'node:crypto'
import type {
  AccessTokenRecord,
  ConfirmationTokenRecord,
  ContactInfo,
  Email,
  FilePart,
  LoungeEvent,
  Person,
  PhoneNumber,
  StoredFileRecord,
  TgAcc,
  User,
  WebLink,
  WsConnectionInfo,
} from './types.js'

const DEFAULT_CONFIRM_CODE = '123456'
const DEFAULT_SESSION_DAYS = 7
const CONFIRM_TTL_MINUTES = 10
const ACCESS_TTL_HOURS = 24 * DEFAULT_SESSION_DAYS
const DEFAULT_IMAGE =
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2k8Q8AAAAASUVORK5CYII=',
    'base64'
  )

export const nowIso = (): string => new Date().toISOString()
export const hoursFromNow = (hours: number): string =>
  new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
export const minutesFromNow = (minutes: number): string =>
  new Date(Date.now() + minutes * 60 * 1000).toISOString()

export const toFileMetadata = (file: StoredFileRecord | null) =>
  file
    ? {
        id: file.id,
        file_storage_part_id: file.file_storage_part_id,
        path: file.path,
        filename: file.filename,
        ext: file.ext,
        size_bytes: file.size_bytes,
        created_at: file.created_at,
        updated_at: file.updated_at,
        deleted_at: file.deleted_at,
      }
    : null

class CrudCollection<T extends { id: number; created_at: string; updated_at: string; deleted_at: string | null }> {
  private items = new Map<number, T>()
  private nextId = 1

  constructor(private readonly makeDefaults: () => Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) {}

  list(includeDeleted = false): T[] {
    return [...this.items.values()]
      .filter((item) => includeDeleted || item.deleted_at === null)
      .sort((a, b) => a.id - b.id)
  }

  all(): T[] {
    return this.list(true)
  }

  get(id: number): T | null {
    return this.items.get(id) ?? null
  }

  create(data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): T {
    const record = {
      ...this.makeDefaults(),
      ...data,
      id: this.nextId++,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
    } as T
    this.items.set(record.id, record)
    return record
  }

  patch(id: number, data: Partial<T>): T | null {
    const current = this.items.get(id)
    if (!current) return null
    const updated = {
      ...current,
      ...data,
      id: current.id,
      created_at: current.created_at,
      updated_at: nowIso(),
    } as T
    this.items.set(id, updated)
    return updated
  }

  softDelete(id: number): T | null {
    return this.patch(id, { deleted_at: nowIso() } as Partial<T>)
  }

  restore(id: number): T | null {
    return this.patch(id, { deleted_at: null } as Partial<T>)
  }

  remove(id: number): T | null {
    const item = this.items.get(id) ?? null
    if (!item) return null
    this.items.delete(id)
    return item
  }
}

class AppStore {
  readonly persons = new CrudCollection<Person>(() => ({
    first_name: '',
    last_name: null,
    middle_name: null,
    birth_date: null,
    description: null,
  }))

  readonly users = new CrudCollection<User>(() => ({
    person_id: null,
    auth_email: null,
    has_access: true,
    is_admin: false,
    session_expires_at: null,
    avatar_id: null,
    auth_telegram_id: null,
  }))

  readonly contactInfos = new CrudCollection<ContactInfo>(() => ({
    person_id: null,
    phone_number_id: null,
    tg_acc_id: null,
    email_id: null,
    web_link_id: null,
    description: null,
    is_primary: false,
  }))

  readonly phoneNumbers = new CrudCollection<PhoneNumber>(() => ({
    phone_pattern_id: null,
    number: null,
    full_number: null,
  }))

  readonly emails = new CrudCollection<Email>(() => ({
    address: '',
  }))

  readonly tgAccs = new CrudCollection<TgAcc>(() => ({
    user_id: null,
    username: null,
    first_name: null,
    last_name: null,
    phone_number_id: null,
  }))

  readonly webLinks = new CrudCollection<WebLink>(() => ({
    title: null,
    type_id: 1,
    custom_type_name: null,
    url: '',
    description: null,
  }))

  readonly events = new CrudCollection<LoungeEvent>(() => ({
    title: '',
    description: null,
    event_type_id: 1,
    location_id: 1,
    starts_at: null,
    ends_at: null,
    report_gallery_ids: [],
  }))

  readonly fileParts = new Map<string, FilePart>()
  readonly files = new CrudCollection<StoredFileRecord>(() => ({
    file_storage_part_id: 0,
    storage_part_name: 'private',
    path: '',
    filename: '',
    ext: '',
    size_bytes: 0,
    content_type: null,
    last_modified: null,
    etag: null,
    content: Buffer.alloc(0),
  }))

  readonly confirmationTokens = new Map<string, ConfirmationTokenRecord>()
  readonly accessTokens = new Map<string, AccessTokenRecord>()
  readonly wsConnections = new Map<number, WsConnectionInfo>()
  readonly wsSockets = new Map<number, { send: (data: string) => void; close: () => void }>()
  private nextWsConnId = 1

  readonly sessionDays = DEFAULT_SESSION_DAYS

  constructor() {
    this.fileParts.set('private', { name: 'private', is_public: false })
    this.fileParts.set('public', { name: 'public', is_public: true })

    const person = this.persons.create({
      first_name: 'Alexey',
      last_name: 'Zorkaltsev',
      middle_name: null,
      birth_date: null,
      description: 'Seed person',
    })
    const user = this.users.create({
      person_id: person.id,
      auth_email: 'demo@example.com',
      has_access: true,
      is_admin: true,
      session_expires_at: hoursFromNow(ACCESS_TTL_HOURS),
      avatar_id: null,
      auth_telegram_id: null,
    })
    this.issueAccessToken(user.id)
  }

  private getOrCreatePart(name: string): FilePart {
    const part = this.fileParts.get(name)
    if (part) return part
    const created = { name, is_public: false }
    this.fileParts.set(name, created)
    return created
  }

  createConfirmation(kind: 'login' | 'register', payload: {
    auth_email: string
    first_name?: string | null
    last_name?: string | null
    middle_name?: string | null
  }): ConfirmationTokenRecord {
    const token = crypto.randomUUID()
    const record: ConfirmationTokenRecord = {
      token,
      kind,
      auth_email: payload.auth_email,
      first_name: payload.first_name ?? null,
      last_name: payload.last_name ?? null,
      middle_name: payload.middle_name ?? null,
      confirm_code: DEFAULT_CONFIRM_CODE,
      expires_at: minutesFromNow(CONFIRM_TTL_MINUTES),
    }
    this.confirmationTokens.set(token, record)
    return record
  }

  consumeConfirmation(token: string): ConfirmationTokenRecord | null {
    const record = this.confirmationTokens.get(token)
    if (!record) return null
    if (new Date(record.expires_at).getTime() <= Date.now()) {
      this.confirmationTokens.delete(token)
      return null
    }
    return record
  }

  issueAccessToken(userId: number): AccessTokenRecord {
    const token = crypto.randomUUID()
    const record: AccessTokenRecord = {
      token,
      user_id: userId,
      expires_at: hoursFromNow(ACCESS_TTL_HOURS),
    }
    this.accessTokens.set(token, record)
    const user = this.users.get(userId)
    if (user) {
      this.users.patch(userId, { session_expires_at: record.expires_at })
    }
    return record
  }

  refreshAccessToken(oldToken: string): AccessTokenRecord | null {
    const existing = this.accessTokens.get(oldToken)
    if (!existing) return null
    if (new Date(existing.expires_at).getTime() <= Date.now()) {
      this.accessTokens.delete(oldToken)
      return null
    }
    this.accessTokens.delete(oldToken)
    return this.issueAccessToken(existing.user_id)
  }

  revokeAccessToken(token: string): boolean {
    return this.accessTokens.delete(token)
  }

  revokeAllAccessTokensForUser(userId: number): number {
    let removed = 0
    for (const [token, record] of this.accessTokens.entries()) {
      if (record.user_id === userId) {
        this.accessTokens.delete(token)
        removed += 1
      }
    }
    const user = this.users.get(userId)
    if (user) {
      this.users.patch(userId, { session_expires_at: null })
    }
    return removed
  }

  getUserByAccessToken(token: string): User | null {
    const record = this.accessTokens.get(token)
    if (!record) return null
    if (new Date(record.expires_at).getTime() <= Date.now()) {
      this.accessTokens.delete(token)
      return null
    }
    const user = this.users.get(record.user_id)
    if (!user || user.deleted_at !== null) return null
    return user
  }

  ensureUserByEmail(
    authEmail: string,
    personData?: { first_name?: string | null; last_name?: string | null; middle_name?: string | null }
  ): User {
    const existing = this.users.all().find((user) => user.auth_email === authEmail)
    if (existing) return existing

    const person = this.persons.create({
      first_name: personData?.first_name ?? authEmail.split('@')[0] ?? 'User',
      last_name: personData?.last_name ?? null,
      middle_name: personData?.middle_name ?? null,
      birth_date: null,
      description: null,
    })

    return this.users.create({
      person_id: person.id,
      auth_email: authEmail,
      has_access: true,
      is_admin: false,
      session_expires_at: hoursFromNow(ACCESS_TTL_HOURS),
      avatar_id: null,
      auth_telegram_id: null,
    })
  }

  buildCurrentUser(user: User): import('./types.js').CurrentUserResponse {
    const person = user.person_id ? this.persons.get(user.person_id) : null
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

  serializeUser(user: User): User & { avatar: ReturnType<typeof toFileMetadata> } {
    return {
      ...user,
      avatar: user.avatar_id ? toFileMetadata(this.files.get(user.avatar_id)) : null,
    }
  }

  storeFile(input: {
    storagePartName: string
    path: string
    filename: string
    ext: string
    content: Buffer
    contentType?: string | null
    replaceExisting?: boolean
  }): StoredFileRecord {
    const part = this.getOrCreatePart(input.storagePartName)
    const now = nowIso()
    const existing = this.files
      .all()
      .find(
        (file) =>
          file.storage_part_name === input.storagePartName &&
          file.path === input.path &&
          file.deleted_at === null
      )

    if (existing && input.replaceExisting) {
      const updated = this.files.patch(existing.id, {
        file_storage_part_id: existing.file_storage_part_id || 1,
        storage_part_name: input.storagePartName,
        path: input.path,
        filename: input.filename,
        ext: input.ext,
        size_bytes: input.content.length,
        content_type: input.contentType ?? existing.content_type,
        last_modified: now,
        etag: crypto.createHash('sha1').update(input.content).digest('hex'),
        content: input.content,
      } as Partial<StoredFileRecord>)
      return updated ?? existing
    }

    return this.files.create({
      file_storage_part_id: part.name.length,
      storage_part_name: input.storagePartName,
      path: input.path,
      filename: input.filename,
      ext: input.ext,
      size_bytes: input.content.length,
      content_type: input.contentType ?? null,
      last_modified: now,
      etag: crypto.createHash('sha1').update(input.content).digest('hex'),
      content: input.content,
    })
  }

  getFileByPath(storagePartName: string, path: string): StoredFileRecord | null {
    return (
      this.files
        .all()
        .find((file) => file.storage_part_name === storagePartName && file.path === path && file.deleted_at === null) ?? null
    )
  }

  getFileById(id: number): StoredFileRecord | null {
    return this.files.get(id)
  }

  deleteFileByPath(storagePartName: string, path: string): StoredFileRecord | null {
    const file = this.getFileByPath(storagePartName, path)
    if (!file) return null
    return this.files.softDelete(file.id)
  }

  deleteFileById(id: number, hard = false): StoredFileRecord | null {
    const file = this.files.get(id)
    if (!file) return null
    if (hard) {
      this.files.remove(id)
      return file
    }
    return this.files.softDelete(id)
  }

  listWsConnections(): WsConnectionInfo[] {
    return [...this.wsConnections.values()].sort((a, b) => a.conn_id - b.conn_id)
  }

  registerWsConnection(meta: {
    userId: number
    clientIp: string | null
    userAgent: string | null
  }): number {
    const connId = this.nextWsConnId++
    this.wsConnections.set(connId, {
      conn_id: connId,
      user_id: meta.userId,
      connected_at: nowIso(),
      client_ip: meta.clientIp,
      user_agent: meta.userAgent,
      last_ping_at: nowIso(),
      last_pong_at: nowIso(),
    })
    return connId
  }

  updateWsConnection(connId: number, patch: Partial<WsConnectionInfo>): void {
    const current = this.wsConnections.get(connId)
    if (!current) return
    this.wsConnections.set(connId, { ...current, ...patch })
  }

  removeWsConnection(connId: number): void {
    this.wsConnections.delete(connId)
    this.wsSockets.delete(connId)
  }

  seedDemoData() {
    const phone = this.phoneNumbers.create({
      phone_pattern_id: null,
      number: '0000000000',
      full_number: '+0 (000) 000-00-00',
    })
    const email = this.emails.create({ address: 'contact@example.com' })
    const tg = this.tgAccs.create({
      user_id: null,
      username: 'demo',
      first_name: 'Demo',
      last_name: 'Account',
      phone_number_id: phone.id,
    })
    const link = this.webLinks.create({
      title: 'Homepage',
      type_id: 1,
      custom_type_name: null,
      url: 'https://example.com',
      description: 'Seed link',
    })
    this.contactInfos.create({
      person_id: 1,
      phone_number_id: phone.id,
      tg_acc_id: tg.id,
      email_id: email.id,
      web_link_id: link.id,
      description: 'Seed contact',
      is_primary: true,
    })
    this.events.create({
      title: 'Seed event',
      description: 'Demo event',
      event_type_id: 1,
      location_id: 1,
      starts_at: null,
      ends_at: null,
      report_gallery_ids: [],
    })
  }

  getPartNames(): string[] {
    return [...this.fileParts.keys()].sort()
  }

  getPart(name: string): FilePart | null {
    return this.fileParts.get(name) ?? null
  }

  setPart(name: string, isPublic: boolean): FilePart {
    const part = { name, is_public: isPublic }
    this.fileParts.set(name, part)
    return part
  }

  getDefaultImage(): Buffer {
    return DEFAULT_IMAGE
  }
}

export const store = new AppStore()
store.seedDemoData()

export type AppStoreType = AppStore

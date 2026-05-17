import crypto from 'node:crypto'
import type {
  AccessTokenRecord,
  ConfirmationTokenRecord,
  ConfirmationHistoryEntry,
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
import { FileStorageService, serializeStoredFileMetadata, type StoreFileInput } from './file-storage.js'
import { CrudCollection } from './record-collection.js'
import { hoursFromNow, minutesFromNow, nowIso } from './time.js'
import { ObjectContainerService } from './object-container.js'

const DEFAULT_CONFIRM_CODE = '123456'
const DEFAULT_SESSION_DAYS = 7
const CONFIRM_TTL_MINUTES = 10
const ACCESS_TTL_HOURS = 24 * DEFAULT_SESSION_DAYS

export const toFileMetadata = (file: StoredFileRecord | null) => serializeStoredFileMetadata(file)

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

  readonly fileStorage = new FileStorageService()
  readonly objectContainer = new ObjectContainerService(this.fileStorage)
  readonly confirmationTokens = new Map<string, ConfirmationTokenRecord>()
  readonly accessTokens = new Map<string, AccessTokenRecord>()
  readonly wsConnections = new Map<number, WsConnectionInfo>()
  readonly wsSockets = new Map<number, { send: (data: string) => void; close: () => void }>()
  private nextWsConnId = 1

  readonly sessionDays = DEFAULT_SESSION_DAYS

  constructor() {
    this.reset()
  }

  reset(): void {
    this.persons.clear()
    this.users.clear()
    this.contactInfos.clear()
    this.phoneNumbers.clear()
    this.emails.clear()
    this.tgAccs.clear()
    this.webLinks.clear()
    this.events.clear()
    this.fileStorage.reset()
    this.confirmationTokens.clear()
    this.accessTokens.clear()
    this.wsConnections.clear()
    this.wsSockets.clear()
    this.nextWsConnId = 1

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
      is_sent: false,
      sending_attempts_count: 0,
      sending_error: null,
      is_verified: false,
      verification_attempts_count: 0,
      verification_error: null,
      history: [
        {
          action: 'create',
          timestamp: nowIso(),
          ok: true,
          error_message: null,
        },
      ],
    }
    this.confirmationTokens.set(token, record)
    return record
  }

  private appendConfirmationHistory(
    record: ConfirmationTokenRecord,
    action: ConfirmationHistoryEntry['action'],
    ok: boolean,
    error_message: string | null = null
  ): ConfirmationTokenRecord {
    record.history = [
      ...record.history,
      {
        action,
        timestamp: nowIso(),
        ok,
        error_message,
      },
    ]
    return record
  }

  getConfirmation(token: string): ConfirmationTokenRecord | null {
    const record = this.confirmationTokens.get(token)
    if (!record) return null
    if (new Date(record.expires_at).getTime() <= Date.now()) {
      this.confirmationTokens.delete(token)
      return null
    }
    return record
  }

  consumeConfirmation(token: string): ConfirmationTokenRecord | null {
    return this.getConfirmation(token)
  }

  markConfirmationSent(token: string, ok: boolean, error_message: string | null = null): ConfirmationTokenRecord | null {
    const record = this.getConfirmation(token)
    if (!record) return null
    record.is_sent = ok
    record.sending_attempts_count += 1
    record.sending_error = error_message
    return this.appendConfirmationHistory(record, 'send', ok, error_message)
  }

  verifyConfirmation(token: string, receivedCode: string): { ok: true; record: ConfirmationTokenRecord } | { ok: false; error: string } {
    const record = this.getConfirmation(token)
    if (!record) {
      return { ok: false, error: 'Confirmation token is invalid or expired' }
    }

    record.verification_attempts_count += 1
    if (record.confirm_code !== receivedCode.trim()) {
      record.is_verified = false
      record.verification_error = 'Invalid confirmation code'
      this.appendConfirmationHistory(record, 'verify', false, record.verification_error)
      return { ok: false, error: record.verification_error }
    }

    record.is_verified = true
    record.verification_error = null
    this.appendConfirmationHistory(record, 'verify', true, null)
    return { ok: true, record }
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
      avatar: user.avatar_id ? toFileMetadata(this.fileStorage.getFileById(user.avatar_id)) : null,
    }
  }

  storeFile(input: StoreFileInput): StoredFileRecord {
    return this.fileStorage.storeFile(input)
  }

  getFileByPath(storagePartName: string, path: string): StoredFileRecord | null {
    return this.fileStorage.getFileByPath(storagePartName, path)
  }

  getFileById(id: number): StoredFileRecord | null {
    return this.fileStorage.getFileById(id)
  }

  deleteFileByPath(storagePartName: string, path: string): StoredFileRecord | null {
    return this.fileStorage.deleteFileByPath(storagePartName, path)
  }

  deleteFileById(id: number, hard = false): StoredFileRecord | null {
    return this.fileStorage.deleteFileById(id, hard)
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
    return this.fileStorage.getPartNames()
  }

  getPart(name: string): FilePart | null {
    return this.fileStorage.getPart(name)
  }

  setPart(name: string, isPublic: boolean): FilePart {
    return this.fileStorage.setPart(name, isPublic)
  }

  deletePart(name: string): FilePart | null {
    return this.fileStorage.deletePart(name)
  }

  getDefaultImage(): Buffer {
    return this.fileStorage.getDefaultImage()
  }
}

export const store = new AppStore()
store.seedDemoData()

export type AppStoreType = AppStore

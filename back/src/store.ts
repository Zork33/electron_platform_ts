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
import { AuthService } from './auth-service.js'
import { CollectionCrudApiService } from './crud-api-service.js'
import { FileApiService } from './file-api-service.js'
import { EventService } from './event-service.js'
import { FileStorageService, serializeStoredFileMetadata, type StoreFileInput } from './file-storage.js'
import { CrudCollection } from './record-collection.js'
import { ProfileService } from './profile-service.js'
import { hoursFromNow, minutesFromNow, nowIso } from './time.js'
import { ObjectContainerService } from './object-container.js'
import { WebSocketService } from './ws-service.js'
const DEFAULT_SESSION_DAYS = 7
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
  readonly contactInfoApi = new CollectionCrudApiService(this.contactInfos)
  readonly phoneNumberApi = new CollectionCrudApiService(this.phoneNumbers)
  readonly emailApi = new CollectionCrudApiService(this.emails)
  readonly tgAccApi = new CollectionCrudApiService(this.tgAccs)
  readonly webLinkApi = new CollectionCrudApiService(this.webLinks)
  readonly fileApiService = new FileApiService(this.fileStorage)
  readonly objectContainer = new ObjectContainerService(this.fileStorage)
  readonly eventService = new EventService({ events: this.events, fileStorage: this.fileStorage })
  readonly profileService = new ProfileService({
    persons: this.persons,
    users: this.users,
    fileStorage: this.fileStorage,
    sessionTtlHours: ACCESS_TTL_HOURS,
  })
  readonly auth = new AuthService({
    getUserById: (userId) => this.users.get(userId),
    patchUser: (userId, patch) => {
      this.users.patch(userId, patch)
    },
  })
  readonly ws = new WebSocketService()

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
    this.auth.reset()
    this.ws.reset()

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
    return this.auth.createConfirmation(kind, payload)
  }

  getConfirmation(token: string): ConfirmationTokenRecord | null {
    return this.auth.getConfirmation(token)
  }

  consumeConfirmation(token: string): ConfirmationTokenRecord | null {
    return this.auth.consumeConfirmation(token)
  }

  markConfirmationSent(token: string, ok: boolean, error_message: string | null = null): ConfirmationTokenRecord | null {
    return this.auth.markConfirmationSent(token, ok, error_message)
  }

  verifyConfirmation(token: string, receivedCode: string): { ok: true; record: ConfirmationTokenRecord } | { ok: false; error: string } {
    return this.auth.verifyConfirmation(token, receivedCode)
  }

  issueAccessToken(userId: number): AccessTokenRecord {
    return this.auth.issueAccessToken(userId)
  }

  refreshAccessToken(oldToken: string): AccessTokenRecord | null {
    return this.auth.refreshAccessToken(oldToken)
  }

  revokeAccessToken(token: string): boolean {
    return this.auth.revokeAccessToken(token)
  }

  revokeAllAccessTokensForUser(userId: number): number {
    return this.auth.revokeAllAccessTokensForUser(userId)
  }

  getUserByAccessToken(token: string): User | null {
    return this.auth.getUserByAccessToken(token)
  }

  ensureUserByEmail(
    authEmail: string,
    personData?: { first_name?: string | null; last_name?: string | null; middle_name?: string | null }
  ): User {
    return this.profileService.ensureUserByEmail(authEmail, personData)
  }

  buildCurrentUser(user: User): import('./types.js').CurrentUserResponse {
    return this.profileService.getCurrentUser(user)
  }

  serializeUser(user: User): User & { avatar: ReturnType<typeof toFileMetadata> } {
    return this.profileService.serializeUser(user)
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
    return this.ws.listConnections()
  }

  registerWsConnection(meta: {
    userId: number
    clientIp: string | null
    userAgent: string | null
  }): number {
    return this.ws.registerConnection(meta)
  }

  updateWsConnection(connId: number, patch: Partial<WsConnectionInfo>): void {
    this.ws.updateConnection(connId, patch)
  }

  removeWsConnection(connId: number): void {
    this.ws.removeConnection(connId)
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

  get confirmationTokens() {
    return this.auth.confirmationTokens
  }

  get accessTokens() {
    return this.auth.accessTokens
  }

  get wsConnections() {
    return this.ws.connections
  }

  get wsSockets() {
    return this.ws.sockets
  }
}

export const store = new AppStore()
store.seedDemoData()

export type AppStoreType = AppStore

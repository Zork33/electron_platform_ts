import type {
  ContactInfo,
  Email,
  LoungeEvent,
  Person,
  PhoneNumber,
  StoredFileRecord,
  TgAcc,
  User,
  WebLink,
} from './types.js'
import { Pool } from 'pg'
import { AuthApiService } from './auth-api-service.js'
import { AuthService } from './auth-service.js'
import { NoopEmailSender, SmtpEmailSender, type EmailSender } from './email-sender.js'
import { MemoryBlobStore, MinioBlobStore } from './blob-store.js'
import { CollectionCrudApiService } from './crud-api-service.js'
import { EventService } from './event-service.js'
import { FileApiService } from './file-api-service.js'
import { FileStorageService, serializeStoredFileMetadata } from './file-storage.js'
import { JsonAppStateStore, PostgresAppStateStore, type AppStateRepository, type PersistedAppState } from './persistent-state.js'
import { DomainTableSync } from './domain-table-sync.js'
import { ConfirmationTokenSync } from './confirmation-sync.js'
import { SqlCollectionSyncGroup } from './sql-collection-sync.js'
import { CrudCollection } from './record-collection.js'
import { hoursFromNow } from './time.js'
import { ObjectContainerService } from './object-container.js'
import { ProfileService } from './profile-service.js'
import { NoopTelegramNotifier, TelegramBotApiNotifier, type TelegramNotifier } from './telegram-notifier.js'
import { ConfirmCodeSettingsService } from './confirm-code-settings.js'
import { WebSocketService } from './logic/process/web_socket/pool.js'

const DEFAULT_SESSION_DAYS = 7
const ACCESS_TTL_HOURS = 24 * DEFAULT_SESSION_DAYS
const DEFAULT_CONFIRM_CODE_LENGTH = 6
const DEFAULT_CONFIRM_CODE_ALPHABET = '0123456789'
const DEFAULT_CONFIRM_TTL_MINUTES = 10
const DEFAULT_CONFIRM_SENDING_MAX_ATTEMPTS = 3
const DEFAULT_CONFIRM_VERIFICATION_MAX_ATTEMPTS = 5

export const toFileMetadata = (file: StoredFileRecord | null) => serializeStoredFileMetadata(file)

const createStateRepository = (): AppStateRepository => {
  if (process.env.DB_HOST) {
    return new PostgresAppStateStore({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? 'main_db',
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
    })
  }
  return new JsonAppStateStore()
}

const createDomainTableSync = (): DomainTableSync | null => {
  if (!process.env.DB_HOST) return null
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'main_db',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
  })
  return new DomainTableSync({
    query: (sql, params) => pool.query({ text: sql, values: params as unknown[] | undefined }),
  })
}

const createSqlCollectionSyncGroup = (): SqlCollectionSyncGroup | null => {
  if (!process.env.DB_HOST) return null
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'main_db',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
  })
  return new SqlCollectionSyncGroup({
    query: (sql, params) => pool.query({ text: sql, values: params as unknown[] | undefined }),
  })
}

const createConfirmationSync = (): ConfirmationTokenSync | null => {
  if (!process.env.DB_HOST) return null
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'main_db',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
  })
  return new ConfirmationTokenSync({
    query: (sql, params) => pool.query({ text: sql, values: params as unknown[] | undefined }),
  })
}

const createBlobStore = () => {
  if (process.env.FILE_STORAGE_HOST) {
    return new MinioBlobStore({
      endPoint: process.env.FILE_STORAGE_HOST,
      port: Number(process.env.FILE_STORAGE_PORT ?? 9000),
      useSSL: String(process.env.FILE_STORAGE_USE_SSL ?? 'false') === 'true',
      accessKey: process.env.FILE_STORAGE_CLIENT_LOGIN ?? 'admin',
      secretKey: process.env.FILE_STORAGE_CLIENT_PASSWORD ?? 'FilestoragePass123',
      bucketName: process.env.FILE_STORAGE_BUCKET_NAME ?? 'electron-platform-files',
    })
  }
  return new MemoryBlobStore()
}

const createEmailSender = (): EmailSender => {
  const host = process.env.EMAIL_SMTP_HOST ?? ''
  const fromEmail = process.env.EMAIL_FROM ?? ''
  if (!host || !fromEmail) return new NoopEmailSender()
  return new SmtpEmailSender({
    host,
    port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
    secure: String(process.env.EMAIL_SMTP_SECURE ?? 'false') === 'true',
    authUser: process.env.EMAIL_SMTP_USER,
    authPass: process.env.EMAIL_SMTP_PASSWORD,
    fromEmail,
  })
}

const createTelegramNotifier = (): TelegramNotifier => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? ''
  if (!botToken) return new NoopTelegramNotifier()
  return new TelegramBotApiNotifier({
    botToken,
    apiUrl: process.env.TELEGRAM_API_URL,
  })
}

const createConfirmCodeSettings = () =>
  new ConfirmCodeSettingsService({
    login: {
      confirm_code_length: Number(process.env.CONFIRM_CODE_LENGTH ?? DEFAULT_CONFIRM_CODE_LENGTH),
      confirm_code_alphabet: process.env.CONFIRM_CODE_ALPHABET ?? DEFAULT_CONFIRM_CODE_ALPHABET,
      confirm_code_ttl_minutes: Number(process.env.CONFIRM_TTL_MINUTES ?? DEFAULT_CONFIRM_TTL_MINUTES),
      sending_max_attempts_count: Number(process.env.CONFIRM_SENDING_MAX_ATTEMPTS ?? DEFAULT_CONFIRM_SENDING_MAX_ATTEMPTS),
      verification_max_attempts_count: Number(process.env.CONFIRM_VERIFICATION_MAX_ATTEMPTS ?? DEFAULT_CONFIRM_VERIFICATION_MAX_ATTEMPTS),
    },
    registration: {
      confirm_code_length: Number(process.env.CONFIRM_CODE_LENGTH ?? DEFAULT_CONFIRM_CODE_LENGTH),
      confirm_code_alphabet: process.env.CONFIRM_CODE_ALPHABET ?? DEFAULT_CONFIRM_CODE_ALPHABET,
      confirm_code_ttl_minutes: Number(process.env.CONFIRM_TTL_MINUTES ?? DEFAULT_CONFIRM_TTL_MINUTES),
      sending_max_attempts_count: Number(process.env.CONFIRM_SENDING_MAX_ATTEMPTS ?? DEFAULT_CONFIRM_SENDING_MAX_ATTEMPTS),
      verification_max_attempts_count: Number(process.env.CONFIRM_VERIFICATION_MAX_ATTEMPTS ?? DEFAULT_CONFIRM_VERIFICATION_MAX_ATTEMPTS),
    },
  })

class AppStore {
  private readonly persistence = createStateRepository()
  private readonly domainTableSync = createDomainTableSync()
  private readonly sqlCollectionSync = createSqlCollectionSyncGroup()
  private readonly confirmationSync = createConfirmationSync()
  private persistenceMuted = false

  readonly persons = new CrudCollection<Person>(
    () => ({
      first_name: '',
      last_name: null,
      middle_name: null,
      birth_date: null,
      description: null,
      gender_id: null,
      vector_db_record_id: null,
      is_vector_synced: false,
    }),
    () => void this.persist()
  )

  readonly users = new CrudCollection<User>(
    () => ({
      person_id: null,
      auth_email: null,
      has_access: true,
      is_admin: false,
      session_expires_at: null,
      auth_session_expires_at: null,
      avatar_id: null,
      auth_telegram_id: null,
    }),
    () => void this.persist()
  )

  readonly contactInfos = new CrudCollection<ContactInfo>(
    () => ({
      person_id: null,
      phone_number_id: null,
      tg_acc_id: null,
      email_id: null,
      web_link_id: null,
      description: null,
      is_primary: false,
    }),
    () => void this.persist()
  )

  readonly phoneNumbers = new CrudCollection<PhoneNumber>(
    () => ({
      phone_pattern_id: null,
      number: null,
      full_number: null,
    }),
    () => void this.persist()
  )

  readonly emails = new CrudCollection<Email>(
    () => ({
      address: '',
    }),
    () => void this.persist()
  )

  readonly tgAccs = new CrudCollection<TgAcc>(
    () => ({
      user_id: null,
      username: null,
      first_name: null,
      last_name: null,
      phone_number_id: null,
    }),
    () => void this.persist()
  )

  readonly webLinks = new CrudCollection<WebLink>(
    () => ({
      title: null,
      type_id: 1,
      custom_type_name: null,
      url: '',
      description: null,
    }),
    () => void this.persist()
  )

  readonly events = new CrudCollection<LoungeEvent>(
    () => ({
      title: '',
      description: null,
      event_type_id: 1,
      location_id: 1,
      starts_at: null,
      ends_at: null,
      report_gallery_ids: [],
    }),
    () => void this.persist()
  )

  readonly sessionDays = DEFAULT_SESSION_DAYS
  readonly fileStorage = new FileStorageService({ onChange: () => void this.persist(), blobStore: createBlobStore() })
  readonly emailSender = createEmailSender()
  readonly telegramNotifier = createTelegramNotifier()
  readonly confirmCodeSettings = createConfirmCodeSettings()
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
    onChange: () => void this.persist(),
    sessionDays: Number(process.env.AUTH_SESSION_DAYS ?? DEFAULT_SESSION_DAYS),
    confirmCodeSettings: this.confirmCodeSettings,
  })
  readonly authApiService = new AuthApiService({
    auth: this.auth,
    profile: this.profileService,
    confirmCodeSettings: this.confirmCodeSettings,
    emailSender: this.emailSender,
    telegramNotifier: this.telegramNotifier,
    sessionDays: this.sessionDays,
  })
  readonly ws = new WebSocketService({ onChange: () => void this.persist() })

  constructor() {
    this.reset(false)
  }

  async init(): Promise<void> {
    const loaded = await this.persistence.load()
    if (loaded) {
      await this.hydrateState(loaded)
    }
    if (this.domainTableSync) {
      const domainState = await this.domainTableSync.load()
      this.persistenceMuted = true
      if (domainState.persons.length > 0) {
        this.persons.hydrate(domainState.persons)
      }
      if (domainState.users.length > 0) {
        this.users.hydrate(domainState.users)
      }
      this.persistenceMuted = false
    }
    if (this.sqlCollectionSync) {
      const sync = this.sqlCollectionSync
      const [contactInfos, phoneNumbers, emails, tgAccs, webLinks] = await Promise.all([
        sync.create({
          tableName: 'contact_info',
          columns: [
            { dbColumn: 'id', value: (record: ContactInfo) => record.id },
            { dbColumn: 'person_id', value: (record: ContactInfo) => record.person_id },
            { dbColumn: 'phone_number_id', value: (record: ContactInfo) => record.phone_number_id },
            { dbColumn: 'tg_acc_id', value: (record: ContactInfo) => record.tg_acc_id },
            { dbColumn: 'email_id', value: (record: ContactInfo) => record.email_id },
            { dbColumn: 'web_link_id', value: (record: ContactInfo) => record.web_link_id },
            { dbColumn: 'description', value: (record: ContactInfo) => record.description },
            { dbColumn: 'is_primary', value: (record: ContactInfo) => record.is_primary },
            { dbColumn: 'created_at', value: (record: ContactInfo) => record.created_at },
            { dbColumn: 'updated_at', value: (record: ContactInfo) => record.updated_at },
            { dbColumn: 'deleted_at', value: (record: ContactInfo) => record.deleted_at },
          ],
          fromRow: (row: {
            id: number
            person_id: number | null
            phone_number_id: number | null
            tg_acc_id: number | null
            email_id: number | null
            web_link_id: number | null
            description: string | null
            is_primary: boolean
            created_at: string
            updated_at: string
            deleted_at: string | null
          }) => row,
        }).loadAll(),
        sync.create({
          tableName: 'phone_number',
          columns: [
            { dbColumn: 'id', value: (record: PhoneNumber) => record.id },
            { dbColumn: 'phone_pattern_id', value: (record: PhoneNumber) => record.phone_pattern_id },
            { dbColumn: 'number', value: (record: PhoneNumber) => record.number },
            { dbColumn: 'full_number', value: (record: PhoneNumber) => record.full_number },
            { dbColumn: 'created_at', value: (record: PhoneNumber) => record.created_at },
            { dbColumn: 'updated_at', value: (record: PhoneNumber) => record.updated_at },
            { dbColumn: 'deleted_at', value: (record: PhoneNumber) => record.deleted_at },
          ],
          fromRow: (row: {
            id: number
            phone_pattern_id: number | null
            number: string | null
            full_number: string | null
            created_at: string
            updated_at: string
            deleted_at: string | null
          }) => row,
        }).loadAll(),
        sync.create({
          tableName: 'email',
          columns: [
            { dbColumn: 'id', value: (record: Email) => record.id },
            { dbColumn: 'address', value: (record: Email) => record.address },
            { dbColumn: 'created_at', value: (record: Email) => record.created_at },
            { dbColumn: 'updated_at', value: (record: Email) => record.updated_at },
            { dbColumn: 'deleted_at', value: (record: Email) => record.deleted_at },
          ],
          fromRow: (row: { id: number; address: string; created_at: string; updated_at: string; deleted_at: string | null }) => row,
        }).loadAll(),
        sync.create({
          tableName: 'tg_acc',
          columns: [
            { dbColumn: 'id', value: (record: TgAcc) => record.id },
            { dbColumn: 'user_id', value: (record: TgAcc) => record.user_id },
            { dbColumn: 'username', value: (record: TgAcc) => record.username },
            { dbColumn: 'first_name', value: (record: TgAcc) => record.first_name },
            { dbColumn: 'last_name', value: (record: TgAcc) => record.last_name },
            { dbColumn: 'phone_number_id', value: (record: TgAcc) => record.phone_number_id },
            { dbColumn: 'created_at', value: (record: TgAcc) => record.created_at },
            { dbColumn: 'updated_at', value: (record: TgAcc) => record.updated_at },
            { dbColumn: 'deleted_at', value: (record: TgAcc) => record.deleted_at },
          ],
          fromRow: (row: {
            id: number
            user_id: number | null
            username: string | null
            first_name: string | null
            last_name: string | null
            phone_number_id: number | null
            created_at: string
            updated_at: string
            deleted_at: string | null
          }) => row,
        }).loadAll(),
        sync.create({
          tableName: 'web_link',
          columns: [
            { dbColumn: 'id', value: (record: WebLink) => record.id },
            { dbColumn: 'title', value: (record: WebLink) => record.title },
            { dbColumn: 'type_id', value: (record: WebLink) => record.type_id },
            { dbColumn: 'custom_type_name', value: (record: WebLink) => record.custom_type_name },
            { dbColumn: 'url', value: (record: WebLink) => record.url },
            { dbColumn: 'description', value: (record: WebLink) => record.description },
            { dbColumn: 'created_at', value: (record: WebLink) => record.created_at },
            { dbColumn: 'updated_at', value: (record: WebLink) => record.updated_at },
            { dbColumn: 'deleted_at', value: (record: WebLink) => record.deleted_at },
          ],
          fromRow: (row: {
            id: number
            title: string | null
            type_id: number
            custom_type_name: string | null
            url: string
            description: string | null
            created_at: string
            updated_at: string
            deleted_at: string | null
          }) => row,
        }).loadAll(),
      ])
      this.persistenceMuted = true
      if (contactInfos.length > 0) this.contactInfos.hydrate(contactInfos)
      if (phoneNumbers.length > 0) this.phoneNumbers.hydrate(phoneNumbers)
      if (emails.length > 0) this.emails.hydrate(emails)
      if (tgAccs.length > 0) this.tgAccs.hydrate(tgAccs)
      if (webLinks.length > 0) this.webLinks.hydrate(webLinks)
      this.persistenceMuted = false
    }
    if (this.confirmationSync) {
      const confirmationTokens = await this.confirmationSync.loadAll()
      this.persistenceMuted = true
      this.auth.confirmationTokens.clear()
      for (const record of confirmationTokens) {
        this.auth.confirmationTokens.set(record.token, { ...record })
      }
      this.persistenceMuted = false
    }
    await this.persist()
  }

  reset(persist = true): void {
    this.persistenceMuted = true
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
    this.seedCoreData()
    this.seedDemoData()
    this.persistenceMuted = false
    if (persist) void this.persist()
  }

  private seedCoreData(): void {
    const person = this.persons.create({
      first_name: 'Alexey',
      last_name: 'Zorkaltsev',
      middle_name: null,
      birth_date: null,
      description: 'Seed person',
      gender_id: null,
      vector_db_record_id: null,
      is_vector_synced: false,
    })
    const sessionExpiresAt = hoursFromNow(ACCESS_TTL_HOURS)
    const user = this.users.create({
      person_id: person.id,
      auth_email: 'demo@example.com',
      has_access: true,
      is_admin: true,
      session_expires_at: sessionExpiresAt,
      auth_session_expires_at: sessionExpiresAt,
      avatar_id: null,
      auth_telegram_id: null,
    })
    this.auth.issueAccessToken(user.id)
  }

  private seedDemoData(): void {
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

  private async hydrateState(state: PersistedAppState): Promise<void> {
    this.persistenceMuted = true
    this.persons.hydrate(state.persons)
    this.users.hydrate(state.users)
    this.contactInfos.hydrate(state.contactInfos)
    this.phoneNumbers.hydrate(state.phoneNumbers)
    this.emails.hydrate(state.emails)
    this.tgAccs.hydrate(state.tgAccs)
    this.webLinks.hydrate(state.webLinks)
    this.events.hydrate(state.events)
    await this.fileStorage.hydrate({ fileParts: state.fileParts, files: state.files })
    this.auth.reset()
    for (const record of state.confirmationTokens) {
      this.auth.confirmationTokens.set(record.token, { ...record })
    }
    for (const record of state.accessTokens) {
      this.auth.accessTokens.set(record.token, { ...record })
    }
    this.ws.hydrate(state.wsConnections ?? [])
    this.persistenceMuted = false
  }

  private exportState(): PersistedAppState {
    const fileStorageState = this.fileStorage.snapshot()
    return {
      version: 1,
      persons: this.persons.snapshot(),
      users: this.users.snapshot(),
      contactInfos: this.contactInfos.snapshot(),
      phoneNumbers: this.phoneNumbers.snapshot(),
      emails: this.emails.snapshot(),
      tgAccs: this.tgAccs.snapshot(),
      webLinks: this.webLinks.snapshot(),
      events: this.events.snapshot(),
      fileParts: fileStorageState.fileParts,
      files: fileStorageState.files,
      confirmationTokens: [...this.auth.confirmationTokens.values()].map((record) => ({ ...record, history: [...record.history] })),
      accessTokens: [...this.auth.accessTokens.values()].map((record) => ({ ...record })),
      wsConnections: this.ws.snapshot(),
    }
  }

  private async persist(): Promise<void> {
    if (this.persistenceMuted) return
    const state = this.exportState()
    await this.persistence.save(state)
    if (this.domainTableSync) {
      await this.domainTableSync.save(state.persons, state.users)
    }
    if (this.sqlCollectionSync) {
      const sync = this.sqlCollectionSync
      await Promise.all([
        sync.create({
          tableName: 'contact_info',
          columns: [
            { dbColumn: 'id', value: (record: ContactInfo) => record.id },
            { dbColumn: 'person_id', value: (record: ContactInfo) => record.person_id },
            { dbColumn: 'phone_number_id', value: (record: ContactInfo) => record.phone_number_id },
            { dbColumn: 'tg_acc_id', value: (record: ContactInfo) => record.tg_acc_id },
            { dbColumn: 'email_id', value: (record: ContactInfo) => record.email_id },
            { dbColumn: 'web_link_id', value: (record: ContactInfo) => record.web_link_id },
            { dbColumn: 'description', value: (record: ContactInfo) => record.description },
            { dbColumn: 'is_primary', value: (record: ContactInfo) => record.is_primary },
            { dbColumn: 'created_at', value: (record: ContactInfo) => record.created_at },
            { dbColumn: 'updated_at', value: (record: ContactInfo) => record.updated_at },
            { dbColumn: 'deleted_at', value: (record: ContactInfo) => record.deleted_at },
          ],
          fromRow: (row: any) => row,
        }).replaceAll(state.contactInfos),
        sync.create({
          tableName: 'phone_number',
          columns: [
            { dbColumn: 'id', value: (record: PhoneNumber) => record.id },
            { dbColumn: 'phone_pattern_id', value: (record: PhoneNumber) => record.phone_pattern_id },
            { dbColumn: 'number', value: (record: PhoneNumber) => record.number },
            { dbColumn: 'full_number', value: (record: PhoneNumber) => record.full_number },
            { dbColumn: 'created_at', value: (record: PhoneNumber) => record.created_at },
            { dbColumn: 'updated_at', value: (record: PhoneNumber) => record.updated_at },
            { dbColumn: 'deleted_at', value: (record: PhoneNumber) => record.deleted_at },
          ],
          fromRow: (row: any) => row,
        }).replaceAll(state.phoneNumbers),
        sync.create({
          tableName: 'email',
          columns: [
            { dbColumn: 'id', value: (record: Email) => record.id },
            { dbColumn: 'address', value: (record: Email) => record.address },
            { dbColumn: 'created_at', value: (record: Email) => record.created_at },
            { dbColumn: 'updated_at', value: (record: Email) => record.updated_at },
            { dbColumn: 'deleted_at', value: (record: Email) => record.deleted_at },
          ],
          fromRow: (row: any) => row,
        }).replaceAll(state.emails),
        sync.create({
          tableName: 'tg_acc',
          columns: [
            { dbColumn: 'id', value: (record: TgAcc) => record.id },
            { dbColumn: 'user_id', value: (record: TgAcc) => record.user_id },
            { dbColumn: 'username', value: (record: TgAcc) => record.username },
            { dbColumn: 'first_name', value: (record: TgAcc) => record.first_name },
            { dbColumn: 'last_name', value: (record: TgAcc) => record.last_name },
            { dbColumn: 'phone_number_id', value: (record: TgAcc) => record.phone_number_id },
            { dbColumn: 'created_at', value: (record: TgAcc) => record.created_at },
            { dbColumn: 'updated_at', value: (record: TgAcc) => record.updated_at },
            { dbColumn: 'deleted_at', value: (record: TgAcc) => record.deleted_at },
          ],
          fromRow: (row: any) => row,
        }).replaceAll(state.tgAccs),
        sync.create({
          tableName: 'web_link',
          columns: [
            { dbColumn: 'id', value: (record: WebLink) => record.id },
            { dbColumn: 'title', value: (record: WebLink) => record.title },
            { dbColumn: 'type_id', value: (record: WebLink) => record.type_id },
            { dbColumn: 'custom_type_name', value: (record: WebLink) => record.custom_type_name },
            { dbColumn: 'url', value: (record: WebLink) => record.url },
            { dbColumn: 'description', value: (record: WebLink) => record.description },
            { dbColumn: 'created_at', value: (record: WebLink) => record.created_at },
            { dbColumn: 'updated_at', value: (record: WebLink) => record.updated_at },
            { dbColumn: 'deleted_at', value: (record: WebLink) => record.deleted_at },
          ],
          fromRow: (row: any) => row,
        }).replaceAll(state.webLinks),
      ])
    }
    if (this.confirmationSync) {
      await this.confirmationSync.replaceAll([...this.auth.confirmationTokens.values()])
    }
  }

  snapshot() {
    return this.exportState()
  }
}

export const store = new AppStore()

export type AppStoreType = AppStore

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
import { AuthApiService } from './auth-api-service.js'
import { AuthService } from './auth-service.js'
import { NoopEmailSender, SmtpEmailSender, type EmailSender } from './email-sender.js'
import { MemoryBlobStore, MinioBlobStore } from './blob-store.js'
import { CollectionCrudApiService } from './crud-api-service.js'
import { EventService } from './event-service.js'
import { FileApiService } from './file-api-service.js'
import { FileStorageService, serializeStoredFileMetadata } from './file-storage.js'
import { JsonAppStateStore, PostgresAppStateStore, type AppStateRepository, type PersistedAppState } from './persistent-state.js'
import { CrudCollection } from './record-collection.js'
import { hoursFromNow } from './time.js'
import { ObjectContainerService } from './object-container.js'
import { ProfileService } from './profile-service.js'
import { NoopTelegramNotifier, TelegramBotApiNotifier, type TelegramNotifier } from './telegram-notifier.js'
import { WebSocketService } from './ws-service.js'

const DEFAULT_SESSION_DAYS = 7
const ACCESS_TTL_HOURS = 24 * DEFAULT_SESSION_DAYS

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

class AppStore {
  private readonly persistence = createStateRepository()
  private persistenceMuted = false

  readonly persons = new CrudCollection<Person>(
    () => ({
      first_name: '',
      last_name: null,
      middle_name: null,
      birth_date: null,
      description: null,
    }),
    () => this.persist()
  )

  readonly users = new CrudCollection<User>(
    () => ({
      person_id: null,
      auth_email: null,
      has_access: true,
      is_admin: false,
      session_expires_at: null,
      avatar_id: null,
      auth_telegram_id: null,
    }),
    () => this.persist()
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
    () => this.persist()
  )

  readonly phoneNumbers = new CrudCollection<PhoneNumber>(
    () => ({
      phone_pattern_id: null,
      number: null,
      full_number: null,
    }),
    () => this.persist()
  )

  readonly emails = new CrudCollection<Email>(
    () => ({
      address: '',
    }),
    () => this.persist()
  )

  readonly tgAccs = new CrudCollection<TgAcc>(
    () => ({
      user_id: null,
      username: null,
      first_name: null,
      last_name: null,
      phone_number_id: null,
    }),
    () => this.persist()
  )

  readonly webLinks = new CrudCollection<WebLink>(
    () => ({
      title: null,
      type_id: 1,
      custom_type_name: null,
      url: '',
      description: null,
    }),
    () => this.persist()
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
    () => this.persist()
  )

  readonly sessionDays = DEFAULT_SESSION_DAYS
  readonly fileStorage = new FileStorageService({ onChange: () => this.persist(), blobStore: createBlobStore() })
  readonly emailSender = createEmailSender()
  readonly telegramNotifier = createTelegramNotifier()
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
    onChange: () => this.persist(),
  })
  readonly authApiService = new AuthApiService({
    auth: this.auth,
    profile: this.profileService,
    emailSender: this.emailSender,
    telegramNotifier: this.telegramNotifier,
    sessionDays: this.sessionDays,
  })
  readonly ws = new WebSocketService()

  constructor() {
    this.reset(false)
  }

  async init(): Promise<void> {
    const loaded = await this.persistence.load()
    if (loaded) {
      await this.hydrateState(loaded)
      return
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
    if (persist) this.persist()
  }

  private seedCoreData(): void {
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
    this.ws.reset()
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
    }
  }

  private persist(): void {
    if (this.persistenceMuted) return
    void this.persistence.save(this.exportState())
  }

  snapshot() {
    return this.exportState()
  }
}

export const store = new AppStore()

export type AppStoreType = AppStore

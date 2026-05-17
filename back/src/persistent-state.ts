import { dirname, resolve } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { Pool, type PoolConfig } from 'pg'
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
} from './types.js'

export interface PersistedStoredFileRecord extends Omit<StoredFileRecord, 'content'> {
  content_base64?: string
}

export interface PersistedAppState {
  version: 1
  persons: Person[]
  users: User[]
  contactInfos: ContactInfo[]
  phoneNumbers: PhoneNumber[]
  emails: Email[]
  tgAccs: TgAcc[]
  webLinks: WebLink[]
  events: LoungeEvent[]
  fileParts: FilePart[]
  files: PersistedStoredFileRecord[]
  confirmationTokens: ConfirmationTokenRecord[]
  accessTokens: AccessTokenRecord[]
}

export interface AppStateRepository {
  load(): Promise<PersistedAppState | null> | PersistedAppState | null
  save(state: PersistedAppState): Promise<void> | void
  clear(): Promise<void> | void
}

const EMPTY_STATE: PersistedAppState = {
  version: 1,
  persons: [],
  users: [],
  contactInfos: [],
  phoneNumbers: [],
  emails: [],
  tgAccs: [],
  webLinks: [],
  events: [],
  fileParts: [],
  files: [],
  confirmationTokens: [],
  accessTokens: [],
}

export class JsonAppStateStore implements AppStateRepository {
  constructor(private readonly filePath = resolve(process.cwd(), 'data', 'state.json')) {}

  load(): PersistedAppState | null {
    if (!existsSync(this.filePath)) return null
    try {
      const raw = readFileSync(this.filePath, 'utf8')
      if (!raw.trim()) return null
      const parsed = JSON.parse(raw) as Partial<PersistedAppState>
      return this.normalize(parsed)
    } catch {
      return null
    }
  }

  save(state: PersistedAppState): void {
    const targetDir = dirname(this.filePath)
    mkdirSync(targetDir, { recursive: true })
    writeFileSync(this.filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  }

  clear(): void {
    try {
      writeFileSync(this.filePath, '', 'utf8')
    } catch {
      // ignore
    }
  }

  private normalize(parsed: Partial<PersistedAppState>): PersistedAppState {
    return {
      ...EMPTY_STATE,
      ...parsed,
      version: 1,
      persons: parsed.persons ?? [],
      users: parsed.users ?? [],
      contactInfos: parsed.contactInfos ?? [],
      phoneNumbers: parsed.phoneNumbers ?? [],
      emails: parsed.emails ?? [],
      tgAccs: parsed.tgAccs ?? [],
      webLinks: parsed.webLinks ?? [],
      events: parsed.events ?? [],
      fileParts: parsed.fileParts ?? [],
      files: parsed.files ?? [],
      confirmationTokens: parsed.confirmationTokens ?? [],
      accessTokens: parsed.accessTokens ?? [],
    }
  }
}

export interface PostgresAppStateStoreConfig extends PoolConfig {
  tableName?: string
}

export class PostgresAppStateStore implements AppStateRepository {
  private readonly pool: Pool
  private readonly tableName: string

  constructor(config: PostgresAppStateStoreConfig) {
    this.pool = new Pool(config)
    this.tableName = config.tableName ?? 'app_state'
  }

  async init(): Promise<void> {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id integer PRIMARY KEY,
        state jsonb NOT NULL
      )`
    )
  }

  async load(): Promise<PersistedAppState | null> {
    await this.init()
    const result = await this.pool.query<{ state: PersistedAppState }>(
      `SELECT state FROM ${this.tableName} WHERE id = 1 LIMIT 1`
    )
    return result.rows[0]?.state ?? null
  }

  async save(state: PersistedAppState): Promise<void> {
    await this.init()
    await this.pool.query(
      `INSERT INTO ${this.tableName} (id, state) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state`,
      [state]
    )
  }

  async clear(): Promise<void> {
    await this.init()
    await this.pool.query(`DELETE FROM ${this.tableName} WHERE id = 1`)
  }
}

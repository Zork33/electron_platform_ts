import { dirname, resolve } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  content_base64: string
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

export class JsonAppStateStore {
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

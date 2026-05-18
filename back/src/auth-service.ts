import crypto from 'node:crypto'
import type {
  AccessTokenRecord,
  ConfirmationHistoryEntry,
  ConfirmationTokenRecord,
  User,
} from './types.js'
import { ConfirmCodeSettingsService } from './logic/process/auth/confirm_code/settings.js'
import { hoursFromNow, minutesFromNow, nowIso } from './time.js'
import { JwtAuthError, UserAuthJwtManager } from './user-auth-jwt-manager.js'

const DEFAULT_SESSION_DAYS = 7
const DEFAULT_JWT_SECRET = 'electron_platform_ts_dev_secret'
const LOGIN_REASON_ID = 2
const REGISTRATION_REASON_ID = 1

export interface AuthServiceDeps {
  getUserById: (userId: number) => User | null
  patchUser: (userId: number, patch: Partial<User>) => void
  onChange?: () => void
  jwtSecret?: string
  sessionDays?: number
  confirmCodeSettings?: ConfirmCodeSettingsService
}

export class AuthService {
  readonly confirmationTokens = new Map<string, ConfirmationTokenRecord>()
  readonly accessTokens = new Map<string, AccessTokenRecord>()
  private readonly jwtSecret: string
  private readonly sessionDays: number
  private readonly confirmCodeSettings: ConfirmCodeSettingsService
  private readonly jwtManager: UserAuthJwtManager

  constructor(private readonly deps: AuthServiceDeps) {
    this.jwtSecret = deps.jwtSecret ?? process.env.AUTH_JWT_SECRET ?? DEFAULT_JWT_SECRET
    this.sessionDays = deps.sessionDays ?? Number(process.env.AUTH_SESSION_DAYS ?? DEFAULT_SESSION_DAYS)
    this.jwtManager = new UserAuthJwtManager({
      secretKey: this.jwtSecret,
      accessTokenExpireMinutes: 24 * 60 * this.sessionDays,
    })
    this.confirmCodeSettings =
      deps.confirmCodeSettings ??
      new ConfirmCodeSettingsService({
        login: {
          confirm_code_length: Number(process.env.CONFIRM_CODE_LENGTH ?? 6),
          confirm_code_alphabet: process.env.CONFIRM_CODE_ALPHABET ?? '0123456789',
          confirm_code_ttl_minutes: Number(process.env.CONFIRM_TTL_MINUTES ?? 10),
          sending_max_attempts_count: Number(process.env.CONFIRM_SENDING_MAX_ATTEMPTS ?? 3),
          sending_cooldown_seconds: Number(process.env.CONFIRM_SENDING_COOLDOWN_SECONDS ?? 0),
          verification_max_attempts_count: Number(process.env.CONFIRM_VERIFICATION_MAX_ATTEMPTS ?? 5),
        },
        registration: {
          confirm_code_length: Number(process.env.CONFIRM_CODE_LENGTH ?? 6),
          confirm_code_alphabet: process.env.CONFIRM_CODE_ALPHABET ?? '0123456789',
          confirm_code_ttl_minutes: Number(process.env.CONFIRM_TTL_MINUTES ?? 10),
          sending_max_attempts_count: Number(process.env.CONFIRM_SENDING_MAX_ATTEMPTS ?? 3),
          sending_cooldown_seconds: Number(process.env.CONFIRM_SENDING_COOLDOWN_SECONDS ?? 0),
          verification_max_attempts_count: Number(process.env.CONFIRM_VERIFICATION_MAX_ATTEMPTS ?? 5),
        },
      })
  }

  reset(): void {
    this.confirmationTokens.clear()
    this.accessTokens.clear()
    this.deps.onChange?.()
  }

  createConfirmation(
    kind: 'login' | 'register',
    payload: {
      auth_email: string
      first_name?: string | null
      last_name?: string | null
      middle_name?: string | null
    }
  ): ConfirmationTokenRecord {
    const settings = this.confirmCodeSettings.getByReasonCode(kind === 'login' ? 'LOGIN' : 'REGISTRATION')
    const token = crypto.randomUUID()
    const record: ConfirmationTokenRecord = {
      token,
      kind,
      auth_email: payload.auth_email,
      reason_id: kind === 'login' ? LOGIN_REASON_ID : REGISTRATION_REASON_ID,
      user_id: null,
      first_name: payload.first_name ?? null,
      last_name: payload.last_name ?? null,
      middle_name: payload.middle_name ?? null,
      confirm_code: this.generateConfirmCode(settings.confirm_code_length, settings.confirm_code_alphabet),
      expires_at: minutesFromNow(settings.confirm_code_ttl_minutes),
      sending_at: null,
      is_sent: false,
      sending_attempts_count: 0,
      sending_error: null,
      verification_at: null,
      is_verified: false,
      verification_attempts_count: 0,
      verification_error: null,
      user_creation_at: null,
      is_user_created: false,
      user_creation_error: null,
      access_token_created_at: null,
      is_access_token_created: false,
      access_token_error: null,
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
    this.deps.onChange?.()
    return record
  }

  private generateConfirmCode(length = 6, alphabet = '0123456789'): string {
    const effectiveAlphabet = alphabet.length > 0 ? alphabet : '0123456789'
    const effectiveLength = Number.isFinite(length) && length > 0 ? length : 6
    return Array.from({ length: effectiveLength }, () => effectiveAlphabet[crypto.randomInt(0, effectiveAlphabet.length)]).join('')
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
    this.deps.onChange?.()
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
    const settings = this.confirmCodeSettings.getByReasonCode(record.kind === 'login' ? 'LOGIN' : 'REGISTRATION')
    if (record.sending_attempts_count >= settings.sending_max_attempts_count) {
      record.sending_error = 'Sending attempts exceeded'
      return this.appendConfirmationHistory(record, 'send', false, record.sending_error)
    }
    record.is_sent = ok
    record.sending_attempts_count += 1
    record.sending_at = nowIso()
    record.sending_error = error_message
    return this.appendConfirmationHistory(record, 'send', ok, error_message)
  }

  verifyConfirmation(token: string, receivedCode: string): { ok: true; record: ConfirmationTokenRecord } | { ok: false; error: string } {
    const record = this.getConfirmation(token)
    if (!record) {
      return { ok: false, error: 'Confirmation token is invalid or expired' }
    }

    const settings = this.confirmCodeSettings.getByReasonCode(record.kind === 'login' ? 'LOGIN' : 'REGISTRATION')
    if (record.verification_attempts_count >= settings.verification_max_attempts_count) {
      record.verification_error = 'Verification attempts exceeded'
      this.appendConfirmationHistory(record, 'verify', false, record.verification_error)
      return { ok: false, error: record.verification_error }
    }

    record.verification_attempts_count += 1
    record.verification_at = nowIso()
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

  markConfirmationUserCreated(token: string, userId: number): ConfirmationTokenRecord | null {
    const record = this.getConfirmation(token)
    if (!record) return null
    record.user_id = userId
    record.user_creation_at = nowIso()
    record.is_user_created = true
    record.user_creation_error = null
    return this.appendConfirmationHistory(record, 'user_creation', true, null)
  }

  markConfirmationUserCreationFailed(token: string, error: string): ConfirmationTokenRecord | null {
    const record = this.getConfirmation(token)
    if (!record) return null
    record.user_creation_at = nowIso()
    record.is_user_created = false
    record.user_creation_error = error
    return this.appendConfirmationHistory(record, 'user_creation', false, error)
  }

  markConfirmationAccessTokenCreated(token: string, ok: boolean, error: string | null = null): ConfirmationTokenRecord | null {
    const record = this.getConfirmation(token)
    if (!record) return null
    record.access_token_created_at = nowIso()
    record.is_access_token_created = ok
    record.access_token_error = error
    return this.appendConfirmationHistory(record, 'access_token_creation', ok, error)
  }

  markConfirmationAccessTokenCreationFailed(token: string, error: string): ConfirmationTokenRecord | null {
    return this.markConfirmationAccessTokenCreated(token, false, error)
  }

  issueAccessToken(userId: number): AccessTokenRecord {
    const { token, expires_at } = this.jwtManager.createAccessToken(userId)
    const record: AccessTokenRecord = {
      token,
      user_id: userId,
      expires_at,
    }
    this.accessTokens.set(token, record)
    this.deps.patchUser(userId, {
      session_expires_at: record.expires_at,
      auth_session_expires_at: record.expires_at,
    })
    this.deps.onChange?.()
    return record
  }

  refreshAccessToken(oldToken: string): AccessTokenRecord | null {
    let payload
    try {
      payload = this.jwtManager.validateAccessToken(`Bearer ${oldToken}`)
      this.jwtManager.checkTokenExpiry(payload)
    } catch (error) {
      if (error instanceof JwtAuthError) return null
      return null
    }
    const existing = this.accessTokens.get(oldToken)
    if (!existing) return null
    const user = this.validateUserSession(this.deps.getUserById(existing.user_id))
    if (!user || new Date(existing.expires_at).getTime() <= Date.now() || payload.user_id !== existing.user_id) {
      this.accessTokens.delete(oldToken)
      this.deps.onChange?.()
      return null
    }
    this.accessTokens.delete(oldToken)
    const refreshed = this.issueAccessToken(existing.user_id)
    this.deps.onChange?.()
    return refreshed
  }

  revokeAccessToken(token: string): boolean {
    const removed = this.accessTokens.delete(token)
    if (removed) this.deps.onChange?.()
    return removed
  }

  revokeAllAccessTokensForUser(userId: number): number {
    let removed = 0
    for (const [token, record] of this.accessTokens.entries()) {
      if (record.user_id === userId) {
        this.accessTokens.delete(token)
        removed += 1
      }
    }
    this.deps.patchUser(userId, { session_expires_at: null, auth_session_expires_at: null })
    this.deps.onChange?.()
    return removed
  }

  getUserByAccessToken(token: string): User | null {
    let payload
    try {
      payload = this.jwtManager.validateAccessToken(`Bearer ${token}`)
      this.jwtManager.checkTokenExpiry(payload)
    } catch (error) {
      if (error instanceof JwtAuthError) return null
      return null
    }
    const record = this.accessTokens.get(token)
    if (!record) return null
    if (new Date(record.expires_at).getTime() <= Date.now() || payload.user_id !== record.user_id) {
      this.accessTokens.delete(token)
      return null
    }
    const user = this.deps.getUserById(record.user_id)
    return this.validateUserSession(user)
  }

  validateUserSession(user: User | null): User | null {
    if (!user || user.deleted_at !== null) return null
    if (!user.has_access) return null
    const sessionExpiresAt = user.session_expires_at ?? user.auth_session_expires_at ?? null
    if (sessionExpiresAt && new Date(sessionExpiresAt).getTime() <= Date.now()) return null
    return user
  }
}

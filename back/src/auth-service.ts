import crypto from 'node:crypto'
import type {
  AccessTokenRecord,
  ConfirmationHistoryEntry,
  ConfirmationTokenRecord,
  User,
} from './types.js'
import { createJwt, verifyJwt } from './jwt.js'
import { hoursFromNow, minutesFromNow, nowIso } from './time.js'

const DEFAULT_SESSION_DAYS = 7
const DEFAULT_JWT_SECRET = 'electron_platform_ts_dev_secret'
const DEFAULT_CONFIRM_CODE_LENGTH = 6
const DEFAULT_CONFIRM_CODE_ALPHABET = '0123456789'
const DEFAULT_CONFIRM_TTL_MINUTES = 10
const DEFAULT_CONFIRM_SENDING_MAX_ATTEMPTS = 3
const DEFAULT_CONFIRM_VERIFICATION_MAX_ATTEMPTS = 5

export interface AuthServiceDeps {
  getUserById: (userId: number) => User | null
  patchUser: (userId: number, patch: Partial<User>) => void
  onChange?: () => void
  jwtSecret?: string
  sessionDays?: number
  confirmCodeLength?: number
  confirmCodeAlphabet?: string
  confirmTtlMinutes?: number
  confirmSendingMaxAttempts?: number
  confirmVerificationMaxAttempts?: number
}

export class AuthService {
  readonly confirmationTokens = new Map<string, ConfirmationTokenRecord>()
  readonly accessTokens = new Map<string, AccessTokenRecord>()
  private readonly jwtSecret: string
  private readonly sessionDays: number
  private readonly confirmCodeLength: number
  private readonly confirmCodeAlphabet: string
  private readonly confirmTtlMinutes: number
  private readonly confirmSendingMaxAttempts: number
  private readonly confirmVerificationMaxAttempts: number

  constructor(private readonly deps: AuthServiceDeps) {
    this.jwtSecret = deps.jwtSecret ?? process.env.AUTH_JWT_SECRET ?? DEFAULT_JWT_SECRET
    this.sessionDays = deps.sessionDays ?? Number(process.env.AUTH_SESSION_DAYS ?? DEFAULT_SESSION_DAYS)
    this.confirmCodeLength = deps.confirmCodeLength ?? Number(process.env.CONFIRM_CODE_LENGTH ?? DEFAULT_CONFIRM_CODE_LENGTH)
    this.confirmCodeAlphabet = deps.confirmCodeAlphabet ?? process.env.CONFIRM_CODE_ALPHABET ?? DEFAULT_CONFIRM_CODE_ALPHABET
    this.confirmTtlMinutes = deps.confirmTtlMinutes ?? Number(process.env.CONFIRM_TTL_MINUTES ?? DEFAULT_CONFIRM_TTL_MINUTES)
    this.confirmSendingMaxAttempts = deps.confirmSendingMaxAttempts ?? Number(
      process.env.CONFIRM_SENDING_MAX_ATTEMPTS ?? DEFAULT_CONFIRM_SENDING_MAX_ATTEMPTS
    )
    this.confirmVerificationMaxAttempts = deps.confirmVerificationMaxAttempts ?? Number(
      process.env.CONFIRM_VERIFICATION_MAX_ATTEMPTS ?? DEFAULT_CONFIRM_VERIFICATION_MAX_ATTEMPTS
    )
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
    const token = crypto.randomUUID()
    const record: ConfirmationTokenRecord = {
      token,
      kind,
      auth_email: payload.auth_email,
      first_name: payload.first_name ?? null,
      last_name: payload.last_name ?? null,
      middle_name: payload.middle_name ?? null,
      confirm_code: this.generateConfirmCode(),
      expires_at: minutesFromNow(this.confirmTtlMinutes),
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
    this.deps.onChange?.()
    return record
  }

  private generateConfirmCode(length = 6): string {
    const alphabet = this.confirmCodeAlphabet.length > 0 ? this.confirmCodeAlphabet : DEFAULT_CONFIRM_CODE_ALPHABET
    const effectiveLength = Number.isFinite(length) && length > 0 ? length : this.confirmCodeLength
    return Array.from({ length: effectiveLength }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('')
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

    if (record.verification_attempts_count >= this.confirmVerificationMaxAttempts) {
      return { ok: false, error: 'Verification attempts exceeded' }
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
    const expires_at = hoursFromNow(24 * this.sessionDays)
    const token = createJwt(
      {
        user_id: userId,
        created_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(new Date(expires_at).getTime() / 1000),
        jti: crypto.randomUUID(),
      },
      this.jwtSecret
    )
    const record: AccessTokenRecord = {
      token,
      user_id: userId,
      expires_at,
    }
    this.accessTokens.set(token, record)
    this.deps.patchUser(userId, { session_expires_at: record.expires_at })
    this.deps.onChange?.()
    return record
  }

  refreshAccessToken(oldToken: string): AccessTokenRecord | null {
    const payload = verifyJwt(oldToken, this.jwtSecret)
    if (!payload) return null
    const existing = this.accessTokens.get(oldToken)
    if (!existing) return null
    const user = this.validateUserSession(this.deps.getUserById(existing.user_id))
    if (!user || new Date(existing.expires_at).getTime() <= Date.now() || new Date(payload.expires_at * 1000).getTime() <= Date.now()) {
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
    this.deps.patchUser(userId, { session_expires_at: null })
    this.deps.onChange?.()
    return removed
  }

  getUserByAccessToken(token: string): User | null {
    const payload = verifyJwt(token, this.jwtSecret)
    if (!payload) return null
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
    if (user.session_expires_at && new Date(user.session_expires_at).getTime() <= Date.now()) return null
    return user
  }

  hasConfirmationLimitReached(token: string): boolean {
    const record = this.confirmationTokens.get(token)
    if (!record) return true
    return record.sending_attempts_count >= this.confirmSendingMaxAttempts
  }
}

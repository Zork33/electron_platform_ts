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
const CONFIRM_TTL_MINUTES = 10
const ACCESS_TTL_HOURS = 24 * DEFAULT_SESSION_DAYS
const DEFAULT_JWT_SECRET = 'electron_platform_ts_dev_secret'

export interface AuthServiceDeps {
  getUserById: (userId: number) => User | null
  patchUser: (userId: number, patch: Partial<User>) => void
  onChange?: () => void
  jwtSecret?: string
}

export class AuthService {
  readonly confirmationTokens = new Map<string, ConfirmationTokenRecord>()
  readonly accessTokens = new Map<string, AccessTokenRecord>()
  private readonly jwtSecret: string

  constructor(private readonly deps: AuthServiceDeps) {
    this.jwtSecret = deps.jwtSecret ?? process.env.AUTH_JWT_SECRET ?? DEFAULT_JWT_SECRET
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
    this.deps.onChange?.()
    return record
  }

  private generateConfirmCode(length = 6): string {
    const digits = Array.from({ length }, () => crypto.randomInt(0, 10).toString())
    return digits.join('')
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
    const expires_at = hoursFromNow(ACCESS_TTL_HOURS)
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
    if (new Date(existing.expires_at).getTime() <= Date.now() || new Date(payload.expires_at * 1000).getTime() <= Date.now()) {
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
    if (!user || user.deleted_at !== null) return null
    return user
  }
}

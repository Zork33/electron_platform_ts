import type { AuthService } from './auth-service.js'
import type { ConfirmCodeSettingsService } from './confirm-code-settings.js'
import type { EmailSender } from './email-sender.js'
import type { ProfileService } from './profile-service.js'
import type { TelegramNotifier } from './telegram-notifier.js'

export interface AuthApiServiceDeps {
  auth: AuthService
  profile: ProfileService
  confirmCodeSettings: ConfirmCodeSettingsService
  emailSender: EmailSender
  telegramNotifier: TelegramNotifier
  sessionDays: number
}

type StartAuthResult =
  | { ok: true; confirmation_token: string; expires_at: string }
  | { ok: false; error: string }

export class AuthApiService {
  constructor(private readonly deps: AuthApiServiceDeps) {}

  async startLogin(authEmail: string): Promise<StartAuthResult> {
    const existingUser = this.deps.profile.findUserByEmail(authEmail)
    if (!existingUser) return { ok: false, error: 'User not found' }
    const token = this.deps.auth.createConfirmation('login', { auth_email: authEmail })
    await this.sendConfirmationEmail(token.token, token.kind, token.auth_email, token.confirm_code)
    await this.sendConfirmationTelegram(token.token, token.auth_email, token.confirm_code)
    return {
      ok: true,
      confirmation_token: token.token,
      expires_at: token.expires_at,
    }
  }

  async startRegistration(payload: {
    auth_email: string
    first_name: string
    last_name?: string | null
    middle_name?: string | null
    }): Promise<StartAuthResult> {
    const existingUser = this.deps.profile.findUserByEmail(payload.auth_email)
    if (existingUser) return { ok: false, error: 'User already exists' }
    const token = this.deps.auth.createConfirmation('register', payload)
    await this.sendConfirmationEmail(token.token, token.kind, token.auth_email, token.confirm_code)
    await this.sendConfirmationTelegram(token.token, token.auth_email, token.confirm_code)
    return {
      ok: true,
      confirmation_token: token.token,
      expires_at: token.expires_at,
    }
  }

  finishLogin(confirmationToken: string, confirmCode: string) {
    const verification = this.deps.auth.verifyConfirmation(confirmationToken, confirmCode)
    if (!verification.ok) return verification
    const user = this.deps.profile.findUserByEmail(verification.record.auth_email)
    if (!user) return { ok: false, error: 'User not found' }
    this.deps.auth.markConfirmationUserCreated(confirmationToken, user.id)
    const access = this.deps.auth.issueAccessToken(user.id)
    this.deps.auth.markConfirmationAccessTokenCreated(confirmationToken, true)
    return {
      access_token: access.token,
      expires_at: access.expires_at,
      session_expires_days: this.deps.sessionDays,
      user_id: user.id,
      person_id: user.person_id,
    }
  }

  finishRegistration(confirmationToken: string, confirmCode: string) {
    const verification = this.deps.auth.verifyConfirmation(confirmationToken, confirmCode)
    if (!verification.ok) return verification
    const existingUser = this.deps.profile.findUserByEmail(verification.record.auth_email)
    if (existingUser) return { ok: false, error: 'User already exists' }
    const user = this.deps.profile.ensureUserByEmail(verification.record.auth_email, {
      first_name: verification.record.first_name,
      last_name: verification.record.last_name,
      middle_name: verification.record.middle_name,
    })
    this.deps.auth.markConfirmationUserCreated(confirmationToken, user.id)
    const access = this.deps.auth.issueAccessToken(user.id)
    this.deps.auth.markConfirmationAccessTokenCreated(confirmationToken, true)
    return {
      access_token: access.token,
      expires_at: access.expires_at,
      session_expires_days: this.deps.sessionDays,
      user_id: user.id,
      person_id: user.person_id,
    }
  }

  refreshAccessToken(token: string) {
    const refreshed = this.deps.auth.refreshAccessToken(token)
    if (!refreshed) return null
    return {
      access_token: refreshed.token,
      expires_at: refreshed.expires_at,
      session_expires_days: this.deps.sessionDays,
    }
  }

  logout(token: string) {
    return this.deps.auth.revokeAccessToken(token)
  }

  logoutAll(token: string) {
    const user = this.deps.auth.getUserByAccessToken(token)
    if (!user) return null
    const removed = this.deps.auth.revokeAllAccessTokensForUser(user.id)
    return { revoked_tokens: removed, user }
  }

  private async sendConfirmationEmail(
    token: string,
    kind: 'login' | 'register',
    authEmail: string,
    confirmCode: string
  ): Promise<void> {
    const settings = this.deps.confirmCodeSettings.getByReasonCode(kind === 'login' ? 'LOGIN' : 'REGISTRATION')
    const subject = settings.sending_subject
    const htmlBody = `<p>Your confirmation code: <strong>${confirmCode}</strong></p>`
    try {
      const ok = await this.deps.emailSender.sendHtmlEmail([authEmail], subject, htmlBody)
      this.deps.auth.markConfirmationSent(token, ok)
    } catch (error) {
      this.deps.auth.markConfirmationSent(token, false, error instanceof Error ? error.message : 'Failed to send confirmation email')
    }
  }

  private async sendConfirmationTelegram(token: string, authEmail: string, confirmCode: string): Promise<void> {
    const user = this.deps.profile.findUserByEmail(authEmail)
    if (!user?.auth_telegram_id) return

    const text = `Your confirmation code: ${confirmCode}`
    try {
      await this.deps.telegramNotifier.sendMessage(user.auth_telegram_id, text)
    } catch (error) {
      this.deps.auth.markConfirmationSent(token, false, error instanceof Error ? error.message : 'Failed to send confirmation telegram message')
    }
  }
}

import type { AuthService } from './auth-service.js'
import type { EmailSender } from './email-sender.js'
import type { ProfileService } from './profile-service.js'

export interface AuthApiServiceDeps {
  auth: AuthService
  profile: ProfileService
  emailSender: EmailSender
  sessionDays: number
}

export class AuthApiService {
  constructor(private readonly deps: AuthApiServiceDeps) {}

  async startLogin(authEmail: string) {
    const token = this.deps.auth.createConfirmation('login', { auth_email: authEmail })
    await this.sendConfirmationEmail(token.token, token.auth_email, token.confirm_code)
    return {
      confirmation_token: token.token,
      expires_at: token.expires_at,
    }
  }

  async startRegistration(payload: {
    auth_email: string
    first_name: string
    last_name?: string | null
    middle_name?: string | null
  }) {
    const token = this.deps.auth.createConfirmation('register', payload)
    await this.sendConfirmationEmail(token.token, token.auth_email, token.confirm_code)
    return {
      confirmation_token: token.token,
      expires_at: token.expires_at,
    }
  }

  finishLogin(confirmationToken: string, confirmCode: string) {
    const verification = this.deps.auth.verifyConfirmation(confirmationToken, confirmCode)
    if (!verification.ok) return verification
    const user = this.deps.profile.ensureUserByEmail(verification.record.auth_email)
    const access = this.deps.auth.issueAccessToken(user.id)
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
    const user = this.deps.profile.ensureUserByEmail(verification.record.auth_email, {
      first_name: verification.record.first_name,
      last_name: verification.record.last_name,
      middle_name: verification.record.middle_name,
    })
    const access = this.deps.auth.issueAccessToken(user.id)
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

  private async sendConfirmationEmail(token: string, authEmail: string, confirmCode: string): Promise<void> {
    const subject = 'Confirmation code'
    const htmlBody = `<p>Your confirmation code: <strong>${confirmCode}</strong></p>`
    try {
      const ok = await this.deps.emailSender.sendHtmlEmail([authEmail], subject, htmlBody)
      this.deps.auth.markConfirmationSent(token, ok)
    } catch (error) {
      this.deps.auth.markConfirmationSent(token, false, error instanceof Error ? error.message : 'Failed to send confirmation email')
    }
  }
}

import type { AuthService } from './auth-service.js'
import type { ProfileService } from './profile-service.js'

export interface AuthApiServiceDeps {
  auth: AuthService
  profile: ProfileService
  sessionDays: number
}

export class AuthApiService {
  constructor(private readonly deps: AuthApiServiceDeps) {}

  startLogin(authEmail: string) {
    const token = this.deps.auth.createConfirmation('login', { auth_email: authEmail })
    this.deps.auth.markConfirmationSent(token.token, true)
    return {
      confirmation_token: token.token,
      expires_at: token.expires_at,
    }
  }

  startRegistration(payload: {
    auth_email: string
    first_name: string
    last_name?: string | null
    middle_name?: string | null
  }) {
    const token = this.deps.auth.createConfirmation('register', payload)
    this.deps.auth.markConfirmationSent(token.token, true)
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
}

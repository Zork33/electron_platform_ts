import crypto from 'node:crypto'
import { createJwt, verifyJwt, type JwtClaims } from './jwt.js'
import { minutesFromNow, nowIso } from './time.js'

export type JwtAuthErrorCode =
  | 'TOKEN_NOT_FOUND'
  | 'INVALID_TOKEN_FORMAT'
  | 'INVALID_TOKEN'
  | 'TOKEN_MISSING_EXPIRY'
  | 'TOKEN_MISSING_USER_ID'
  | 'TOKEN_EXPIRED'

export class JwtAuthError extends Error {
  constructor(
    public readonly code: JwtAuthErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'JwtAuthError'
  }
}

export interface AccessTokenPayload extends JwtClaims {
  jti: string
}

export interface UserAuthJwtManagerConfig {
  secretKey: string
  accessTokenExpireMinutes: number
}

export class UserAuthJwtManager {
  constructor(private readonly config: UserAuthJwtManagerConfig) {}

  createAccessToken(userId: number): { token: string; expires_at: string } {
    const now = nowIso()
    const expiresAt = minutesFromNow(this.config.accessTokenExpireMinutes)
    const token = createJwt(
      {
        user_id: userId,
        created_at: Math.floor(new Date(now).getTime() / 1000),
        expires_at: Math.floor(new Date(expiresAt).getTime() / 1000),
        jti: crypto.randomUUID(),
      },
      this.config.secretKey
    )
    return { token, expires_at: expiresAt }
  }

  validateAccessToken(authorization: string | null | undefined): AccessTokenPayload {
    if (!authorization) {
      throw new JwtAuthError('TOKEN_NOT_FOUND', 'Token authorization not found')
    }

    const [scheme, token, ...rest] = authorization.trim().split(/\s+/)
    if (!scheme || !token || rest.length > 0 || scheme.toLowerCase() !== 'bearer') {
      throw new JwtAuthError('INVALID_TOKEN_FORMAT', 'Invalid authorization token format')
    }

    const payload = verifyJwt(token, this.config.secretKey)
    if (!payload) {
      throw new JwtAuthError('INVALID_TOKEN', 'Invalid token')
    }
    if (typeof payload.expires_at !== 'number') {
      throw new JwtAuthError('TOKEN_MISSING_EXPIRY', 'Token missing expiry')
    }
    if (typeof payload.user_id !== 'number') {
      throw new JwtAuthError('TOKEN_MISSING_USER_ID', 'Token missing user id')
    }

    return payload as AccessTokenPayload
  }

  checkTokenExpiry(payload: Pick<AccessTokenPayload, 'expires_at'>): void {
    if (Date.now() >= payload.expires_at * 1000) {
      throw new JwtAuthError('TOKEN_EXPIRED', 'Token expired')
    }
  }
}

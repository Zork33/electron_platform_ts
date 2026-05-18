import { describe, expect, test } from 'vitest'
import { UserAuthJwtManager, JwtAuthError } from '../src/user-auth-jwt-manager.js'

describe('user auth jwt manager', () => {
  test('creates and validates bearer tokens', () => {
    const manager = new UserAuthJwtManager({
      secretKey: 'secret',
      accessTokenExpireMinutes: 10,
    })

    const created = manager.createAccessToken(42)
    const payload = manager.validateAccessToken(`Bearer ${created.token}`)

    expect(payload.user_id).toBe(42)
    expect(payload.expires_at).toBeGreaterThan(payload.created_at)
    expect(() => manager.checkTokenExpiry(payload)).not.toThrow()
  })

  test('raises python-like errors for invalid auth headers', () => {
    const manager = new UserAuthJwtManager({
      secretKey: 'secret',
      accessTokenExpireMinutes: 10,
    })

    expect(() => manager.validateAccessToken(null)).toThrow(JwtAuthError)
    expect(() => manager.validateAccessToken('Token abc.def.ghi')).toThrow(/Invalid authorization token format/)
    expect(() => manager.validateAccessToken('Bearer invalid.token')).toThrow(/Invalid token/)

    const payload = manager.createAccessToken(42)
    const decoded = manager.validateAccessToken(`Bearer ${payload.token}`)
    expect(() => manager.checkTokenExpiry({ ...decoded, expires_at: 0 })).toThrow(/Token expired/)
  })
})

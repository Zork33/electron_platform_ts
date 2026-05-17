import crypto from 'node:crypto'

export interface JwtClaims {
  user_id: number
  created_at: number
  expires_at: number
  [key: string]: unknown
}

const base64UrlEncode = (input: Buffer | string): string => {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

const base64UrlDecode = (input: string): Buffer => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const normalized = padded.padEnd(Math.ceil(padded.length / 4) * 4, '=')
  return Buffer.from(normalized, 'base64')
}

export const createJwt = (claims: JwtClaims, secret: string): string => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(claims))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest()
  return `${signingInput}.${base64UrlEncode(signature)}`
}

export const verifyJwt = (token: string, secret: string): JwtClaims | null => {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader).toString('utf8')) as { alg?: string; typ?: string }
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null

    const signingInput = `${encodedHeader}.${encodedPayload}`
    const expectedSignature = crypto.createHmac('sha256', secret).update(signingInput).digest()
    const actualSignature = base64UrlDecode(encodedSignature)
    if (actualSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(actualSignature, expectedSignature)) {
      return null
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as JwtClaims
    if (typeof payload.user_id !== 'number' || typeof payload.created_at !== 'number' || typeof payload.expires_at !== 'number') {
      return null
    }
    return payload
  } catch {
    return null
  }
}

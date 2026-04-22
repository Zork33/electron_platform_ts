/**
 * Утилиты для работы с cookies и sessionStorage
 */

// Ключи для хранения
const ACCESS_TOKEN_KEY = 'access_token'
const ACCESS_TOKEN_EXPIRES_AT_KEY = 'access_token_expires_at'
const CONFIRMATION_TOKEN_KEY = 'confirmation_token'
const CONFIRMATION_EXPIRES_AT_KEY = 'confirmation_expires_at'

/**
 * Устанавливает cookie
 */
function setCookie(name: string, value: string, days: number = 7): void {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`
}

/**
 * Получает значение cookie по имени
 */
function getCookie(name: string): string | null {
  const nameEQ = name + '='
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    if (!c) continue
    while (c.charAt(0) === ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
  }
  return null
}

/**
 * Удаляет cookie
 */
function deleteCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
}

// Access Token (в cookies)
export function setAccessToken(token: string, days: number = 7): void {
  setCookie(ACCESS_TOKEN_KEY, token, days)
}

export function getAccessToken(): string | null {
  return getCookie(ACCESS_TOKEN_KEY)
}

export function removeAccessToken(): void {
  deleteCookie(ACCESS_TOKEN_KEY)
}

// Access Token Expires At (в cookies)
export function setAccessTokenExpiresAt(expiresAt: string, days: number = 7): void {
  setCookie(ACCESS_TOKEN_EXPIRES_AT_KEY, expiresAt, days)
}

export function getAccessTokenExpiresAt(): string | null {
  return getCookie(ACCESS_TOKEN_EXPIRES_AT_KEY)
}

export function removeAccessTokenExpiresAt(): void {
  deleteCookie(ACCESS_TOKEN_EXPIRES_AT_KEY)
}

/**
 * Проверяет, истекает ли токен в ближайшее время (по умолчанию 5 минут)
 */
export function isTokenExpiringSoon(minutesThreshold: number = 5): boolean {
  const expiresAt = getAccessTokenExpiresAt()
  if (!expiresAt) return true
  
  const expiresDate = new Date(expiresAt)
  const now = new Date()
  const thresholdMs = minutesThreshold * 60 * 1000
  const thresholdTime = new Date(now.getTime() + thresholdMs)
  
  return expiresDate <= thresholdTime
}

/**
 * Проверяет, истёк ли токен
 */
export function isTokenExpired(): boolean {
  const expiresAt = getAccessTokenExpiresAt()
  if (!expiresAt) return true
  
  const expiresDate = new Date(expiresAt)
  const now = new Date()
  return now >= expiresDate
}

// Confirmation Token (в sessionStorage для временного хранения во время процесса авторизации)
export function setConfirmationToken(token: string): void {
  sessionStorage.setItem(CONFIRMATION_TOKEN_KEY, token)
}

export function getConfirmationToken(): string | null {
  return sessionStorage.getItem(CONFIRMATION_TOKEN_KEY)
}

export function removeConfirmationToken(): void {
  sessionStorage.removeItem(CONFIRMATION_TOKEN_KEY)
}

// Confirmation Expires At (в sessionStorage)
export function setConfirmationExpiresAt(expiresAt: string): void {
  sessionStorage.setItem(CONFIRMATION_EXPIRES_AT_KEY, expiresAt)
}

export function getConfirmationExpiresAt(): string | null {
  return sessionStorage.getItem(CONFIRMATION_EXPIRES_AT_KEY)
}

export function removeConfirmationExpiresAt(): void {
  sessionStorage.removeItem(CONFIRMATION_EXPIRES_AT_KEY)
}

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getAccessToken,
  setAccessToken,
  removeAccessToken,
  getAccessTokenExpiresAt,
  setAccessTokenExpiresAt,
  removeAccessTokenExpiresAt,
  getConfirmationToken,
  setConfirmationToken,
  removeConfirmationToken,
  getConfirmationExpiresAt,
  setConfirmationExpiresAt,
  removeConfirmationExpiresAt,
  isTokenExpiringSoon as checkTokenExpiringSoon,
  isTokenExpired as checkTokenExpired
} from '../lib/cookies'

export interface PersonInfo {
  person_id: number
  first_name: string
  last_name?: string | null
  middle_name?: string | null
  birth_date?: string | null
}

export interface User {
  id: number
  auth_email: string | null
  auth_telegram_id?: string | null | undefined
  has_access: boolean
  auth_session_expires_at?: string | null
  is_admin: boolean
  person: PersonInfo | null
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const currentUser = ref<User | null>(null)
  const isLoading = ref(false)
  // Confirmation token для процесса регистрации/логина (хранится в sessionStorage)
  const confirmationToken = ref<string | null>(getConfirmationToken())
  const confirmationExpiresAt = ref<string | null>(getConfirmationExpiresAt())

  // Getters
  // Access token всегда читаем из cookies (не храним в state)
  const accessToken = computed(() => getAccessToken())
  const accessTokenExpiresAt = computed(() => getAccessTokenExpiresAt())
  
  // Проверяем наличие access токена в cookies
  const isAuthenticated = computed(() => !!accessToken.value)

  // Проверка истечения токена
  const isTokenExpired = computed(() => checkTokenExpired())

  // Проверка, истекает ли токен в ближайшее время (меньше 5 минут)
  const isTokenExpiringSoon = computed(() => checkTokenExpiringSoon(5))

  // Actions
  function saveAccessToken(token: string, expiresAt: string, sessionExpiresDays: number = 7) {
    setAccessToken(token, sessionExpiresDays)
    setAccessTokenExpiresAt(expiresAt, sessionExpiresDays)
  }

  function saveConfirmationToken(token: string, expiresAt: string) {
    confirmationToken.value = token
    confirmationExpiresAt.value = expiresAt
    setConfirmationToken(token)
    setConfirmationExpiresAt(expiresAt)
  }

  function setUser(user: User) {
    currentUser.value = user
  }

  function clearAuth() {
    currentUser.value = null
    removeAccessToken()
    removeAccessTokenExpiresAt()
    clearConfirmation()
  }

  function clearConfirmation() {
    confirmationToken.value = null
    confirmationExpiresAt.value = null
    removeConfirmationToken()
    removeConfirmationExpiresAt()
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  // Восстановление состояния из storage (только confirmation token, т.к. access token читается через геттер)
  function initFromStorage() {
    confirmationToken.value = getConfirmationToken()
    confirmationExpiresAt.value = getConfirmationExpiresAt()
  }

  return {
    // State
    currentUser,
    isLoading,
    confirmationToken,
    confirmationExpiresAt,

    // Getters
    accessToken,
    accessTokenExpiresAt,
    isAuthenticated,
    isTokenExpired,
    isTokenExpiringSoon,

    // Actions
    saveAccessToken,
    saveConfirmationToken,
    setUser,
    clearAuth,
    clearConfirmation,
    setLoading,
    initFromStorage
  }
})


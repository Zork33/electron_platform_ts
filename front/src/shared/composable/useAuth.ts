import { computed } from 'vue'
import { api } from '@/boot/axios'
import { useRouter, useRoute } from 'vue-router'
import { Notify } from 'quasar'
import { useAuthStore, type User } from '../stores/authStore'

export interface LoginStartRequest {
  auth_email: string
}

export interface LoginFinishRequest {
  confirmation_token: string
  confirm_code: string
}

export interface RegisterStartRequest {
  auth_email: string
  first_name: string
  last_name?: string
  middle_name?: string
}

export interface RegisterFinishRequest {
  confirmation_token: string
  confirm_code: string
}

export interface PersonInfo {
  person_id: number
  first_name: string
  last_name?: string | null
  middle_name?: string | null
  birth_date?: string | null
}

export interface CurrentUserResponse {
  user_id: number
  auth_email: string | null
  auth_telegram_id?: string | null
  has_access: boolean
  auth_session_expires_at: string | null
  is_admin: boolean
  person: PersonInfo | null
}

export function useAuth() {
  const router = useRouter()
  const route = useRoute()
  const authStore = useAuthStore()

  // Все состояние берём из store
  const currentUser = computed(() => authStore.currentUser)
  const isAuthenticated = computed(() => authStore.isAuthenticated)
  const isLoading = computed(() => authStore.isLoading)
  const confirmationToken = computed(() => authStore.confirmationToken)
  const confirmationExpiresAt = computed(() => authStore.confirmationExpiresAt)
  const isAdmin = computed(() => authStore.currentUser?.is_admin ?? false)

  /**
   * Загружает данные текущего пользователя с сервера
   * Используется после логина и при восстановлении сессии
   */
  const fetchCurrentUser = async (): Promise<User | null> => {
    try {
      const response = await api.get<CurrentUserResponse>('/user/current-user')
      const userData: User = {
        id: response.data.user_id,
        auth_email: response.data.auth_email,
        auth_telegram_id: response.data.auth_telegram_id,
        has_access: response.data.has_access,
        auth_session_expires_at: response.data.auth_session_expires_at,
        is_admin: response.data.is_admin,
        person: response.data.person
      }
      authStore.setUser(userData)
      return userData
    } catch (error) {
      console.error('Failed to fetch current user:', error)
      return null
    }
  }

  /**
   * Инициализация авторизации при старте приложения
   * Если есть валидный токен — загружает данные пользователя
   */
  const initAuth = async (): Promise<void> => {
    if (authStore.isAuthenticated && !authStore.isTokenExpired) {
      await fetchCurrentUser()
    }
  }

  const startLogin = async (email: string) => {
    authStore.setLoading(true)
    try {
      const response = await api.post('/auth/login-confirm-code-start', {
        auth_email: email
      } as LoginStartRequest)
      
      // Сохраняем confirmation token в sessionStorage через store
      authStore.saveConfirmationToken(
        response.data.confirmation_token,
        response.data.expires_at
      )
      
      Notify.create({
        type: 'positive',
        message: 'Код подтверждения отправлен на email',
        position: 'top'
      })
      
      return response.data
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: { error_message?: string } } } }
      const message = axiosError.response?.data?.detail?.error_message || 'Ошибка при отправке кода'
      Notify.create({
        type: 'negative',
        message,
        position: 'top'
      })
      throw error
    } finally {
      authStore.setLoading(false)
    }
  }

  const finishLogin = async (confirmCode: string) => {
    if (!authStore.confirmationToken) {
      throw new Error('Токен подтверждения не найден')
    }

    authStore.setLoading(true)
    try {
      const response = await api.post('/auth/login-confirm-code-finish', {
        confirmation_token: authStore.confirmationToken,
        confirm_code: confirmCode
      } as LoginFinishRequest)

      // Сохраняем access_token и expires_at в cookies через store
      if (response.data.access_token) {
        authStore.saveAccessToken(
          response.data.access_token,
          response.data.expires_at,
          response.data.session_expires_days || 7
        )
      }

      // Очищаем confirmation token
      authStore.clearConfirmation()

      // Загружаем полные данные пользователя с сервера
      await fetchCurrentUser()

      Notify.create({
        type: 'positive',
        message: 'Успешный вход в систему!',
        position: 'top'
      })

      // Редирект на сохранённый путь или на главную
      const redirectPath = route.query.redirect as string
      await router.push(redirectPath || '/')
      
      return response.data
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: { error_message?: string } } } }
      const message = axiosError.response?.data?.detail?.error_message || 'Ошибка при подтверждении кода'
      Notify.create({
        type: 'negative',
        message,
        position: 'top'
      })
      throw error
    } finally {
      authStore.setLoading(false)
    }
  }

  const startRegister = async (data: RegisterStartRequest) => {
    authStore.setLoading(true)
    try {
      const response = await api.post('/auth/registration-confirm-code-start', data)
      
      // Сохраняем confirmation token в sessionStorage через store
      authStore.saveConfirmationToken(
        response.data.confirmation_token,
        response.data.expires_at
      )
      
      Notify.create({
        type: 'positive',
        message: 'Код подтверждения отправлен на email',
        position: 'top'
      })
      
      return response.data
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: { error_message?: string } } } }
      const message = axiosError.response?.data?.detail?.error_message || 'Ошибка при регистрации'
      Notify.create({
        type: 'negative',
        message,
        position: 'top'
      })
      throw error
    } finally {
      authStore.setLoading(false)
    }
  }

  const finishRegister = async (confirmCode: string) => {
    if (!authStore.confirmationToken) {
      throw new Error('Токен подтверждения не найден')
    }

    authStore.setLoading(true)
    try {
      const response = await api.post('/auth/registration-confirm-code-finish', {
        confirmation_token: authStore.confirmationToken,
        confirm_code: confirmCode
      } as RegisterFinishRequest)

      // Сохраняем access_token и expires_at в cookies через store
      if (response.data.access_token) {
        authStore.saveAccessToken(
          response.data.access_token,
          response.data.expires_at,
          response.data.session_expires_days || 7
        )
      }

      // Очищаем confirmation token
      authStore.clearConfirmation()

      // Загружаем полные данные пользователя с сервера
      await fetchCurrentUser()

      Notify.create({
        type: 'positive',
        message: 'Регистрация успешно завершена!',
        position: 'top'
      })

      // Редирект на сохранённый путь или на главную
      const redirectPath = route.query.redirect as string
      await router.push(redirectPath || '/')
      
      return response.data
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: { error_message?: string } } } }
      const message = axiosError.response?.data?.detail?.error_message || 'Ошибка при подтверждении регистрации'
      Notify.create({
        type: 'negative',
        message,
        position: 'top'
      })
      throw error
    } finally {
      authStore.setLoading(false)
    }
  }

  const logoutFromDevice = async () => {
    // Очищаем всё состояние авторизации через store
    authStore.clearAuth()

    Notify.create({
      type: 'info',
      message: 'Вы вышли с этого устройства',
      position: 'top'
    })

    await router.push('/auth')
  }

  const logoutFromAllDevices = async () => {
    // TODO: Позже добавим запрос на backend для инвалидации токена
    // Пока работает как обычный logout
    await logoutFromDevice()
    
    Notify.create({
      type: 'warning',
      message: 'Функция "выйти везде" будет доступна позже',
      position: 'top'
    })
  }

  // Оставляем старый метод для обратной совместимости
  const logout = async () => {
    await logoutFromDevice()
  }

  return {
    // Состояние (через computed из store)
    currentUser,
    isAuthenticated,
    isLoading,
    confirmationToken,
    confirmationExpiresAt,
    isAdmin,

    // Методы
    initAuth,
    fetchCurrentUser,
    startLogin,
    finishLogin,
    startRegister,
    finishRegister,
    logout,
    logoutFromDevice,
    logoutFromAllDevices
  }
}

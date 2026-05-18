import { beforeEach, describe, expect, test } from 'vitest'
import { AuthService } from '../src/auth-service.js'
import { AuthApiService } from '../src/auth-api-service.js'
import { FileStorageService } from '../src/file-storage.js'
import { CrudCollection } from '../src/record-collection.js'
import { ConfirmCodeSettingsService } from '../src/confirm-code-settings.js'
import { ProfileService } from '../src/profile-service.js'
import type { Person, User } from '../src/types.js'

describe('auth api service', () => {
  const persons = new CrudCollection<Person>(() => ({
    first_name: '',
    last_name: null,
    middle_name: null,
    birth_date: null,
    description: null,
    gender_id: null,
    vector_db_record_id: null,
    is_vector_synced: false,
  }))
  const users = new CrudCollection<User>(() => ({
    person_id: null,
    auth_email: null,
    has_access: true,
    is_admin: false,
    session_expires_at: null,
    auth_session_expires_at: null,
    avatar_id: null,
    auth_telegram_id: null,
  }))
  const fileStorage = new FileStorageService()
  const emailSender = {
    sendHtmlEmail: async () => true,
  }
  const confirmCodeSettings = new ConfirmCodeSettingsService()
  const telegramMessages: Array<{ chatId: string; text: string }> = []
  const telegramNotifier = {
    sendMessage: async (chatId: string, text: string) => {
      telegramMessages.push({ chatId, text })
      return true
    },
  }
  const auth = new AuthService({
    getUserById: (userId) => users.get(userId),
    patchUser: (userId, patch) => {
      users.patch(userId, patch)
    },
  })
  const profile = new ProfileService({ persons, users, fileStorage })
  const service = new AuthApiService({ auth, profile, confirmCodeSettings, emailSender, telegramNotifier, sessionDays: 7 })

  beforeEach(() => {
    persons.clear()
    users.clear()
    fileStorage.reset()
    auth.reset()
  })

  test('drives login and logout flow', async () => {
    users.create({
      person_id: null,
      auth_email: 'demo@example.com',
      has_access: true,
      is_admin: false,
      session_expires_at: null,
      avatar_id: null,
      auth_telegram_id: '123456789',
    })
    expect(await service.startLogin('missing@example.com')).toEqual({ ok: false, error: 'User not found', status: 404 })
    expect(await service.startRegistration({
      auth_email: 'demo@example.com',
      first_name: 'Demo',
    })).toEqual({ ok: false, error: 'User already exists', status: 409 })
    const start = await service.startLogin('demo@example.com')
    expect(start.ok).toBe(true)
    if (!start.ok) throw new Error(start.error)
    expect(start.confirmation_token).toBeTruthy()
    expect(telegramMessages).toHaveLength(1)
    expect(service.finishLogin(start.confirmation_token, auth.confirmationTokens.get(start.confirmation_token)?.confirm_code ?? '')).toEqual(
      expect.objectContaining({ user_id: 1, access_token: expect.any(String) })
    )

    const refresh = service.refreshAccessToken([...auth.accessTokens.keys()][0]!)
    expect(refresh?.session_expires_days).toBe(7)

    const token = [...auth.accessTokens.keys()][0]!
    expect(service.logout(token)).toBe(true)
    expect(service.logoutAll(token)).toBeNull()
  })

  test('normalizes auth email before confirmation flow', async () => {
    users.create({
      person_id: null,
      auth_email: 'mixed@example.com',
      has_access: true,
      is_admin: false,
      session_expires_at: null,
      avatar_id: null,
      auth_telegram_id: null,
    })

    const start = await service.startLogin('MIXED@EXAMPLE.COM')
    expect(start.ok).toBe(true)
    if (!start.ok) throw new Error(start.error)
    expect(auth.confirmationTokens.get(start.confirmation_token)?.auth_email).toBe('mixed@example.com')

    const registration = await service.startRegistration({
      auth_email: 'NEWUSER@EXAMPLE.COM',
      first_name: 'New',
      last_name: 'User',
    })
    expect(registration.ok).toBe(true)
    if (!registration.ok) throw new Error(registration.error)
    expect(auth.confirmationTokens.get(registration.confirmation_token)?.auth_email).toBe('newuser@example.com')
  })

  test('telegram failure does not add an extra send attempt', async () => {
    users.create({
      person_id: null,
      auth_email: 'telegram@example.com',
      has_access: true,
      is_admin: false,
      session_expires_at: null,
      avatar_id: null,
      auth_telegram_id: '123456789',
    })

    const failingService = new AuthApiService({
      auth,
      profile,
      confirmCodeSettings,
      emailSender,
      telegramNotifier: {
        sendMessage: async () => {
          throw new Error('telegram failed')
        },
      },
      sessionDays: 7,
    })

    const start = await failingService.startLogin('telegram@example.com')
    expect(start.ok).toBe(true)
    if (!start.ok) throw new Error(start.error)

    const confirmation = auth.confirmationTokens.get(start.confirmation_token)
    expect(confirmation?.sending_attempts_count).toBe(1)
    expect(confirmation?.history.filter((entry) => entry.action === 'send')).toHaveLength(1)
  })
})

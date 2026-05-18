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
    expect(await service.startLogin('missing@example.com')).toEqual({ ok: false, error: 'User not found' })
    expect(await service.startRegistration({
      auth_email: 'demo@example.com',
      first_name: 'Demo',
    })).toEqual({ ok: false, error: 'User already exists' })
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
})

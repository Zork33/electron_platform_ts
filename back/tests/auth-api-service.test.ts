import { beforeEach, describe, expect, test } from 'vitest'
import { AuthService } from '../src/auth-service.js'
import { AuthApiService } from '../src/auth-api-service.js'
import { FileStorageService } from '../src/file-storage.js'
import { CrudCollection } from '../src/record-collection.js'
import { ProfileService } from '../src/profile-service.js'
import type { Person, User } from '../src/types.js'

describe('auth api service', () => {
  const persons = new CrudCollection<Person>(() => ({
    first_name: '',
    last_name: null,
    middle_name: null,
    birth_date: null,
    description: null,
  }))
  const users = new CrudCollection<User>(() => ({
    person_id: null,
    auth_email: null,
    has_access: true,
    is_admin: false,
    session_expires_at: null,
    avatar_id: null,
    auth_telegram_id: null,
  }))
  const fileStorage = new FileStorageService()
  const emailSender = {
    sendHtmlEmail: async () => true,
  }
  const auth = new AuthService({
    getUserById: (userId) => users.get(userId),
    patchUser: (userId, patch) => {
      users.patch(userId, patch)
    },
  })
  const profile = new ProfileService({ persons, users, fileStorage })
  const service = new AuthApiService({ auth, profile, emailSender, sessionDays: 7 })

  beforeEach(() => {
    persons.clear()
    users.clear()
    fileStorage.reset()
    auth.reset()
  })

  test('drives login and logout flow', async () => {
    const start = await service.startLogin('demo@example.com')
    expect(start.confirmation_token).toBeTruthy()
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

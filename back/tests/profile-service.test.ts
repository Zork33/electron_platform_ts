import { describe, expect, test } from 'vitest'
import { FileStorageService } from '../src/file-storage.js'
import { CrudCollection } from '../src/record-collection.js'
import { ProfileService } from '../src/profile-service.js'
import type { Person, User } from '../src/types.js'

describe('profile service', () => {
  test('handles person, user and avatar flows', () => {
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
    fileStorage.reset()
    const service = new ProfileService({ persons, users, fileStorage })

    const person = service.createPerson({ first_name: 'Alex', last_name: 'Smith' })
    expect(service.getPerson(person.id)?.first_name).toBe('Alex')
    expect(service.vectorSearch('alex', 10)[0].id).toBe(person.id)

    const user = service.createUser({ person_id: person.id, auth_email: 'alex@example.com' })
    expect(service.getUser(user.id)?.auth_email).toBe('alex@example.com')
    expect(service.getCurrentUser(users.get(user.id)!).person?.person_id).toBe(person.id)
    expect(service.ensureUserByEmail('new@example.com', { first_name: 'New' }).auth_email).toBe('new@example.com')

    const avatar = service.uploadAvatar(user.id, {
      originalname: 'avatar.png',
      buffer: Buffer.from('avatar'),
      mimetype: 'image/png',
    })
    expect(avatar?.avatar?.filename).toBe('avatar.png')
    expect(service.getAvatarContent(user.id)?.contentType).toBe('image/png')
    expect(service.replaceAvatar(user.id, {
      originalname: 'avatar2.png',
      buffer: Buffer.from('avatar2'),
      mimetype: 'image/png',
    })?.avatar?.filename).toBe('avatar2.png')
    expect(service.clearAvatar(user.id)?.avatar).toBeNull()
    expect(service.deleteUser(user.id)?.deleted_at).not.toBeNull()
    expect(service.deletePerson(person.id)?.deleted_at).not.toBeNull()
  })
})

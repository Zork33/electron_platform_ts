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
    fileStorage.reset()
    const service = new ProfileService({ persons, users, fileStorage })

    const person = service.createPerson({ first_name: 'Alex', last_name: 'Smith' })
    expect(service.getPerson(person.id)?.first_name).toBe('Alex')
    expect(service.getPerson(person.id)?.gender_id).toBeNull()
    expect(service.getPerson(person.id)?.vector_db_record_id).toBe(person.id)
    expect(service.getPerson(person.id)?.is_vector_synced).toBe(true)
    expect(service.vectorSearch('alex', 10, 0)[0].id).toBe(person.id)

    const user = service.createUser({ person_id: person.id, auth_email: 'alex@example.com' })
    expect(service.getUser(user.id)?.auth_email).toBe('alex@example.com')
    expect(service.serializeUser(user).auth_session_expires_at).toBe(user.session_expires_at)
    expect(service.getCurrentUser(users.get(user.id)!).person?.person_id).toBe(person.id)
    expect(service.ensureUserByEmail('new@example.com', { first_name: 'New' }).auth_email).toBe('new@example.com')

    const avatar = service.uploadAvatar(user.id, {
      originalname: 'avatar.png',
      buffer: Buffer.from('avatar'),
      mimetype: 'image/png',
    })
    expect(avatar?.avatar?.filename).toBe('avatar_1')
    expect(avatar?.avatar?.path).toBe('user/1/avatar/avatar_1.png')
    expect(avatar?.avatar?.ext).toBe('png')
    expect(service.getAvatarContent(user.id)?.contentType).toBe('image/png')
    const replaced = service.replaceAvatar(user.id, {
      originalname: 'avatar2.png',
      buffer: Buffer.from('avatar2'),
      mimetype: 'image/png',
    })
    expect(replaced?.avatar?.id).toBe(avatar?.avatar?.id)
    expect(replaced?.avatar?.filename).toBe('avatar_1')
    expect(service.updatePerson(person.id, { description: 'updated person' })?.is_vector_synced).toBe(true)
    expect(service.clearAvatar(user.id)?.avatar).toBeNull()
    expect(fileStorage.getFileById(avatar!.avatar!.id)?.deleted_at).not.toBeNull()
    expect(service.deletePerson(person.id)?.is_vector_synced).toBe(false)
    expect(service.restorePerson(person.id)?.is_vector_synced).toBe(true)
    expect(service.deleteUser(user.id)?.deleted_at).not.toBeNull()
  })

  test('rejects unsupported avatar input', () => {
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
    fileStorage.reset()
    const service = new ProfileService({ persons, users, fileStorage })
    const user = service.createUser({ auth_email: 'avatar@example.com' })

    expect(() =>
      service.uploadAvatar(user.id, {
        originalname: 'avatar.txt',
        buffer: Buffer.from('avatar'),
        mimetype: 'text/plain',
      })
    ).toThrow(/Unsupported avatar extension/)
    expect(() =>
      service.uploadAvatar(user.id, {
        originalname: 'avatar.png',
        buffer: Buffer.alloc(0),
        mimetype: 'image/png',
      })
    ).toThrow(/Avatar file is empty/)
  })
})

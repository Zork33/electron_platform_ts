import { describe, expect, test } from 'vitest'
import { FileStorageService } from '../src/file-storage.js'

describe('file storage service', () => {
  test('manages parts and files', () => {
    const storage = new FileStorageService()
    storage.reset()

    expect(storage.getPartNames()).toEqual(['private', 'public', 'trash'])
    expect(storage.getPart('private')?.is_public).toBe(false)

    const createdPart = storage.setPart('avatars', true)
    expect(createdPart).toEqual({ name: 'avatars', is_public: true })
    expect(storage.getPartNames()).toEqual(['avatars', 'private', 'public', 'trash'])

    const stored = storage.storeFile({
      storagePartName: 'avatars',
      path: 'users/1/avatar.png',
      filename: 'avatar.png',
      ext: 'png',
      content: Buffer.from('avatar'),
      contentType: 'image/png',
    })

    expect(storage.getFileById(stored.id)?.filename).toBe('avatar.png')
    expect(storage.getFileByPath('avatars', 'users/1/avatar.png')?.id).toBe(stored.id)
    expect(storage.listFiles().some((file) => file.id === stored.id)).toBe(true)
    const deleted = storage.deleteFileByPath('avatars', 'users/1/avatar.png')
    expect(deleted?.deleted_at).not.toBeNull()
    expect(deleted?.storage_part_name).toBe('trash')
    expect(deleted?.path).toContain('avatars/users/1/avatar.png')
    expect(storage.restoreFile(stored.id)?.deleted_at).toBeNull()
    expect(storage.getFileById(stored.id)?.storage_part_name).toBe('avatars')
    expect(storage.deletePart('avatars')?.name).toBe('avatars')
    expect(storage.getPart('avatars')).toBeNull()
  })

  test('replaces existing file by path', () => {
    const storage = new FileStorageService()
    storage.reset()

    const first = storage.storeFile({
      storagePartName: 'public',
      path: 'docs/readme.txt',
      filename: 'readme.txt',
      ext: 'txt',
      content: Buffer.from('one'),
      contentType: 'text/plain',
    })

    const replaced = storage.storeFile({
      storagePartName: 'public',
      path: 'docs/readme.txt',
      filename: 'readme-v2.txt',
      ext: 'txt',
      content: Buffer.from('two'),
      contentType: 'text/plain',
      replaceExisting: true,
    })

    expect(replaced.id).toBe(first.id)
    expect(replaced.filename).toBe('readme-v2.txt')
    expect(replaced.size_bytes).toBe(3)
    expect(storage.getFileByPath('public', 'docs/readme.txt')?.etag).toBe(replaced.etag)
  })

  test('hydrates missing system parts', async () => {
    const storage = new FileStorageService()
    await storage.hydrate({
      fileParts: [{ name: 'private', is_public: false }],
      files: [],
    })

    expect(storage.getPartNames()).toEqual(['private', 'public', 'trash'])
    expect(storage.getPart('trash')?.is_public).toBe(false)
  })
})

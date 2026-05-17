import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { FileStorageService } from '../src/file-storage.js'
import { JsonAppStateStore } from '../src/persistent-state.js'
import { store } from '../src/store.js'

describe('persistent state', () => {
  test('roundtrips application state through json snapshot', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'electron-platform-ts-'))
    try {
      const persistence = new JsonAppStateStore(join(tempDir, 'state.json'))
      store.reset()
      const confirmation = store.auth.createConfirmation('login', { auth_email: 'demo@example.com' })
      store.fileStorage.storeFile({
        storagePartName: 'public',
        path: 'docs/readme.txt',
        filename: 'readme.txt',
        ext: 'txt',
        content: Buffer.from('persisted-file'),
        contentType: 'text/plain',
      })

      const snapshot = store.snapshot()
      persistence.save(snapshot)

      const loaded = persistence.load()
      expect(loaded?.version).toBe(1)
      expect(loaded?.users.some((user) => user.auth_email === 'demo@example.com')).toBe(true)
      expect(loaded?.confirmationTokens.some((record) => record.token === confirmation.token)).toBe(true)
      expect(loaded?.fileParts.map((part) => part.name)).toContain('public')
      expect(loaded?.files.some((file) => file.path === 'docs/readme.txt')).toBe(true)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('roundtrips file storage content and parts', async () => {
    const storage = new FileStorageService()
    storage.reset()
    storage.setPart('avatars', true)

    const file = storage.storeFile({
      storagePartName: 'avatars',
      path: 'users/1/avatar.png',
      filename: 'avatar.png',
      ext: 'png',
      content: Buffer.from('avatar-bytes'),
      contentType: 'image/png',
    })

    const snapshot = storage.snapshot()
    const restored = new FileStorageService()
    await restored.hydrate(snapshot)

    expect(restored.getPart('avatars')?.is_public).toBe(true)
    expect(restored.getFileById(file.id)?.content.toString()).toBe('avatar-bytes')
    expect(restored.getFileByPath('avatars', 'users/1/avatar.png')?.filename).toBe('avatar.png')
  })
})

import { describe, expect, test } from 'vitest'
import { FileApiService } from '../src/file-api-service.js'
import { FileStorageService } from '../src/file-storage.js'

describe('file api service', () => {
  test('handles parts and managed file flows', () => {
    const storage = new FileStorageService()
    storage.reset()
    const service = new FileApiService(storage)

    expect(service.listParts()).toEqual({
      parts: [
        { code: 'private', name: 'private', is_public: false, description: null },
        { code: 'public', name: 'public', is_public: true, description: null },
        { code: 'trash', name: 'trash', is_public: false, description: null },
      ],
      count: 3,
    })
    expect(service.createPart('archive', false)).toEqual({ code: 'archive', name: 'archive', is_public: false, description: null })
    expect(service.getPart('archive')).toEqual({ code: 'archive', name: 'archive', is_public: false, description: null })
    expect(service.setPartPublic('archive', true)?.is_public).toBe(true)

    const uploaded = service.uploadFile({
      storagePartName: 'archive',
      path: 'docs/readme.txt',
      file: {
        originalname: 'readme.txt',
        buffer: Buffer.from('hello'),
        mimetype: 'text/plain',
      },
    })
    expect(uploaded?.metadata.filename).toBe('readme.txt')
    expect(service.downloadFile('archive', 'docs/readme.txt')?.contentType).toBe('text/plain')
    expect(service.getFileInfo('archive', 'docs/readme.txt')?.file_info.size_bytes).toBe(5)
    expect(service.getPresignedUrl('archive', 'docs/readme.txt', 3600)?.expires_in).toBe(3600)
    expect(service.listFiles(false, 10, 1).items).toHaveLength(1)

    const managed = service.uploadManagedFile({
      storagePartName: 'archive',
      path: 'docs/manual.txt',
      file: {
        originalname: 'manual.txt',
        buffer: Buffer.from('manual'),
        mimetype: 'text/plain',
      },
    })
    expect(managed.metadata.path).toBe('docs/manual.txt')
    expect(service.getManagedFile(managed.metadata.id)?.metadata.filename).toBe('manual.txt')
    expect(service.getManagedFileUrl(managed.metadata.id, 60)?.url).toContain('/download')
    expect(service.replaceManagedFile(managed.metadata.id, {
      originalname: 'manual-v2.txt',
      buffer: Buffer.from('manual2'),
      mimetype: 'text/plain',
    })?.metadata.filename).toBe('manual-v2.txt')
    const deleted = service.deleteManagedFile(managed.metadata.id, false)
    expect(deleted?.metadata.deleted_at).not.toBeNull()
    expect(deleted?.metadata.storage_part_name).toBe('trash')
    expect(deleted?.metadata.path).toContain('archive/docs/manual.txt')
    expect(service.restoreManagedFile(managed.metadata.id)?.metadata.deleted_at).toBeNull()
    expect(service.getManagedFile(managed.metadata.id)?.metadata.storage_part_name).toBe('archive')
    expect(service.deletePart('archive')?.name).toBe('archive')
    expect(service.getPartCount()).toEqual({
      parts: [
        { code: 'private', name: 'private', is_public: false, description: null },
        { code: 'public', name: 'public', is_public: true, description: null },
        { code: 'trash', name: 'trash', is_public: false, description: null },
      ],
      count: 3,
    })
  })
})

import { describe, expect, test } from 'vitest'
import { FileStorageService } from '../src/file-storage.js'
import { ObjectContainerService } from '../src/object-container.js'

describe('object container service', () => {
  test('builds storage info from file storage', () => {
    const storage = new FileStorageService()
    storage.reset()
    storage.setPart('archive', false)
    storage.storeFile({
      storagePartName: 'archive',
      path: 'docs/readme.txt',
      filename: 'readme.txt',
      ext: 'txt',
      content: Buffer.from('hello'),
      contentType: 'text/plain',
    })

    const service = new ObjectContainerService(storage)
    const info = service.getStorageInfo()

    expect(info.summary.total_categories).toBe(4)
    expect(info.summary.total_objects).toBe(1)
    expect(info.object_list.find((item) => item.category === 'archive')?.object_count).toBe(1)
    expect(info.object_list.find((item) => item.category === 'archive')?.objects[0]).toMatchObject({
      id: '1',
      ttl_seconds: -1,
      expires_at: null,
    })

    const expiring = storage.storeFile({
      storagePartName: 'archive',
      path: 'docs/ttl.txt',
      filename: 'ttl.txt',
      ext: 'txt',
      content: Buffer.from('ttl'),
      contentType: 'text/plain',
    })
    storage.files.patch(expiring.id, {
      ttl_seconds: 60,
    } as Partial<typeof expiring>)
    const storageInfo = service.getStorageInfo()
    const expiringInfo = storageInfo.object_list.find((item) => item.category === 'archive')?.objects.find((item) => item.id === String(expiring.id))
    expect(expiringInfo?.ttl_seconds).toBe(60)
    expect(expiringInfo?.expires_at).toBeTruthy()
    expect(new Date(expiringInfo!.expires_at!).getTime() - new Date(expiringInfo!.created_at).getTime()).toBe(60000)
    expect(service.getCleanerInfo()).toEqual({
      summary: {
        last_cleanup: null,
        next_cleanup: null,
        is_running: false,
        interval_seconds: null,
      },
      cleanup_log: [],
    })
    expect(service.getContainerInfo().cleaner_running).toBe(false)
    expect(service.getAllStatistics()).toEqual({
      storage: storageInfo,
      cleaner: service.getCleanerInfo(),
      container: service.getContainerInfo(),
    })

    service.startCleaner(120)
    service.recordCleanup(2)
    const cleanerInfo = service.getCleanerInfo()
    expect(cleanerInfo.summary.is_running).toBe(true)
    expect(cleanerInfo.summary.interval_seconds).toBe(120)
    expect(cleanerInfo.summary.last_cleanup).toBeTruthy()
    expect(cleanerInfo.summary.next_cleanup).toBeTruthy()
    expect(cleanerInfo.cleanup_log).toHaveLength(1)
    storage.deleteFileByPath('archive', 'docs/readme.txt')
    expect(service.cleanupExpiredObjects()).toBe(1)
    expect(storage.getFileById(1)).toBeNull()
    service.stopCleaner()
    expect(service.getCleanerInfo().summary.is_running).toBe(false)
  })
})

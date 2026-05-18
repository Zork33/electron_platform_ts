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
    expect(info.object_list.find((item) => item.category === 'archive')?.objects[0].id).toBe('1')
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
      storage: info,
      cleaner: service.getCleanerInfo(),
      container: service.getContainerInfo(),
    })
  })
})

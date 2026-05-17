import { describe, expect, test } from 'vitest'
import { EventService } from '../src/event-service.js'
import { CrudCollection } from '../src/record-collection.js'
import { FileStorageService } from '../src/file-storage.js'
import type { LoungeEvent } from '../src/types.js'

describe('event service', () => {
  test('handles event lifecycle and report gallery', () => {
    const events = new CrudCollection<LoungeEvent>(() => ({
      title: '',
      description: null,
      event_type_id: 1,
      location_id: 1,
      starts_at: null,
      ends_at: null,
      report_gallery_ids: [],
    }))
    const fileStorage = new FileStorageService()
    fileStorage.reset()
    const service = new EventService({ events, fileStorage })

    const created = service.createEvent({ title: 'Launch' })
    expect(created.title).toBe('Launch')
    expect(service.getEvent(created.id)?.title).toBe('Launch')

    const gallery = service.addGalleryFile(created.id, {
      originalname: 'photo.png',
      buffer: Buffer.from('img'),
      mimetype: 'image/png',
    })
    expect(gallery?.report_gallery).toHaveLength(1)

    const renamed = service.renameGalleryFile(gallery?.report_gallery[0].id ?? 0, 'photo-renamed.png')
    expect(renamed?.filename).toBe('photo-renamed.png')

    expect(service.reorderGallery(created.id, [gallery?.report_gallery[0].id ?? 0])).toBe(true)
    expect(service.removeGalleryFile(created.id, gallery?.report_gallery[0].id ?? 0)).toBe(true)
    expect(service.deleteEvent(created.id)?.deleted_at).not.toBeNull()
  })
})

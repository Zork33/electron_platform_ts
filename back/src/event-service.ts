import type { CrudCollection } from './record-collection.js'
import type { FileStorageService } from './file-storage.js'
import type { LoungeEvent, StoredFileMetadata } from './types.js'

export interface EventServiceDeps {
  events: CrudCollection<LoungeEvent>
  fileStorage: FileStorageService
}

export class EventService {
  constructor(private readonly deps: EventServiceDeps) {}

  listEvents(includeDeleted = false) {
    return this.deps.events.list(includeDeleted).map((event) => this.serializeEvent(event))
  }

  getEvent(id: number) {
    const event = this.deps.events.get(id)
    return event ? this.serializeEvent(event) : null
  }

  createEvent(data: Partial<LoungeEvent>) {
    const created = this.deps.events.create({
      ...data,
      report_gallery_ids: [],
    })
    return this.serializeEvent(created)
  }

  updateEvent(id: number, data: Partial<LoungeEvent>) {
    const updated = this.deps.events.patch(id, data)
    return updated ? this.serializeEvent(updated) : null
  }

  deleteEvent(id: number) {
    const deleted = this.deps.events.softDelete(id)
    return deleted ? this.serializeEvent(deleted) : null
  }

  addGalleryFile(eventId: number, file: { originalname: string; buffer: Buffer; mimetype: string }) {
    const event = this.deps.events.get(eventId)
    if (!event) return null
    const stored = this.deps.fileStorage.storeFile({
      storagePartName: 'event-gallery',
      path: `events/${event.id}/gallery/${file.originalname}`,
      filename: file.originalname,
      ext: file.originalname.includes('.') ? file.originalname.split('.').pop() ?? '' : '',
      content: file.buffer,
      contentType: file.mimetype,
    })
    const nextIds = [...event.report_gallery_ids, stored.id]
    this.deps.events.patch(event.id, { report_gallery_ids: nextIds })
    return this.serializeEvent(this.deps.events.get(event.id) ?? event)
  }

  removeGalleryFile(eventId: number, storedFileId: number): boolean {
    const event = this.deps.events.get(eventId)
    if (!event) return false
    const nextIds = event.report_gallery_ids.filter((id) => id !== storedFileId)
    this.deps.events.patch(event.id, { report_gallery_ids: nextIds })
    return true
  }

  reorderGallery(eventId: number, orderedIds: number[]): boolean {
    const event = this.deps.events.get(eventId)
    if (!event) return false
    this.deps.events.patch(event.id, { report_gallery_ids: orderedIds })
    return true
  }

  renameGalleryFile(storedFileId: number, filename: string): StoredFileMetadata | null {
    const updated = this.deps.fileStorage.renameFile(storedFileId, filename)
    return updated ? this.serializeFileMetadata(updated) : null
  }

  serializeEvent(event: LoungeEvent) {
    return {
      ...event,
      report_gallery: event.report_gallery_ids
        .map((id) => this.deps.fileStorage.getFileById(id))
        .filter((file): file is NonNullable<ReturnType<typeof this.deps.fileStorage.getFileById>> => Boolean(file))
        .map((file) => this.serializeFileMetadata(file)),
    }
  }

  private serializeFileMetadata(file: NonNullable<ReturnType<typeof this.deps.fileStorage.getFileById>>): StoredFileMetadata {
    return {
      id: file.id,
      object_key: file.object_key,
      file_storage_part_id: file.file_storage_part_id,
      storage_part_name: file.storage_part_name,
      path: file.path,
      filename: file.filename,
      ext: file.ext,
      size_bytes: file.size_bytes,
      content_type: file.content_type,
      last_modified: file.last_modified,
      etag: file.etag,
      created_at: file.created_at,
      updated_at: file.updated_at,
      deleted_at: file.deleted_at,
    }
  }
}

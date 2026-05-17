import crypto from 'node:crypto'
import { CrudCollection } from './record-collection.js'
import { nowIso } from './time.js'
import type { FilePart, StoredFileMetadata, StoredFileRecord } from './types.js'

const DEFAULT_IMAGE =
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2k8Q8AAAAASUVORK5CYII=',
    'base64'
  )

export interface StoreFileInput {
  storagePartName: string
  path: string
  filename: string
  ext: string
  content: Buffer
  contentType?: string | null
  replaceExisting?: boolean
}

export class FileStorageService {
  readonly fileParts = new Map<string, FilePart>()
  readonly files = new CrudCollection<StoredFileRecord>(() => ({
    file_storage_part_id: 0,
    storage_part_name: 'private',
    path: '',
    filename: '',
    ext: '',
    size_bytes: 0,
    content_type: null,
    last_modified: null,
    etag: null,
    content: Buffer.alloc(0),
  }))

  reset(): void {
    this.files.clear()
    this.fileParts.clear()
    this.fileParts.set('private', { name: 'private', is_public: false })
    this.fileParts.set('public', { name: 'public', is_public: true })
  }

  storeFile(input: StoreFileInput): StoredFileRecord {
    const part = this.getOrCreatePart(input.storagePartName)
    const now = nowIso()
    const existing = this.files
      .all()
      .find(
        (file) =>
          file.storage_part_name === input.storagePartName &&
          file.path === input.path &&
          file.deleted_at === null
      )

    if (existing && input.replaceExisting) {
      const updated = this.files.patch(existing.id, {
        file_storage_part_id: existing.file_storage_part_id || 1,
        storage_part_name: input.storagePartName,
        path: input.path,
        filename: input.filename,
        ext: input.ext,
        size_bytes: input.content.length,
        content_type: input.contentType ?? existing.content_type,
        last_modified: now,
        etag: crypto.createHash('sha1').update(input.content).digest('hex'),
        content: input.content,
      } as Partial<StoredFileRecord>)
      return updated ?? existing
    }

    return this.files.create({
      file_storage_part_id: part.name.length,
      storage_part_name: input.storagePartName,
      path: input.path,
      filename: input.filename,
      ext: input.ext,
      size_bytes: input.content.length,
      content_type: input.contentType ?? null,
      last_modified: now,
      etag: crypto.createHash('sha1').update(input.content).digest('hex'),
      content: input.content,
    })
  }

  listFiles(includeDeleted = false): StoredFileRecord[] {
    return this.files.list(includeDeleted)
  }

  getFileByPath(storagePartName: string, path: string): StoredFileRecord | null {
    return (
      this.files
        .all()
        .find((file) => file.storage_part_name === storagePartName && file.path === path && file.deleted_at === null) ?? null
    )
  }

  getFileById(id: number): StoredFileRecord | null {
    return this.files.get(id)
  }

  deleteFileByPath(storagePartName: string, path: string): StoredFileRecord | null {
    const file = this.getFileByPath(storagePartName, path)
    if (!file) return null
    return this.files.softDelete(file.id)
  }

  deleteFileById(id: number, hard = false): StoredFileRecord | null {
    const file = this.files.get(id)
    if (!file) return null
    if (hard) {
      this.files.remove(id)
      return file
    }
    return this.files.softDelete(id)
  }

  restoreFile(id: number): StoredFileRecord | null {
    return this.files.restore(id)
  }

  renameFile(id: number, filename: string): StoredFileRecord | null {
    return this.files.patch(id, { filename })
  }

  getPartNames(): string[] {
    return [...this.fileParts.keys()].sort()
  }

  getPart(name: string): FilePart | null {
    return this.fileParts.get(name) ?? null
  }

  setPart(name: string, isPublic: boolean): FilePart {
    const part = { name, is_public: isPublic }
    this.fileParts.set(name, part)
    return part
  }

  deletePart(name: string): FilePart | null {
    const part = this.fileParts.get(name) ?? null
    if (!part) return null
    this.fileParts.delete(name)
    return part
  }

  getDefaultImage(): Buffer {
    return DEFAULT_IMAGE
  }

  getOrCreatePart(name: string): FilePart {
    const part = this.fileParts.get(name)
    if (part) return part
    const created = { name, is_public: false }
    this.fileParts.set(name, created)
    return created
  }
}

export const serializeStoredFileMetadata = (file: StoredFileRecord | null): StoredFileMetadata | null =>
  file
    ? {
        id: file.id,
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
    : null

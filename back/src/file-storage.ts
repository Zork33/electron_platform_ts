import crypto from 'node:crypto'
import { CrudCollection } from './record-collection.js'
import { nowIso } from './time.js'
import type { FilePart, StoredFileMetadata, StoredFileRecord } from './types.js'
import type { PersistedStoredFileRecord } from './persistent-state.js'
import type { BlobStore } from './blob-store.js'

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

export interface FileStorageSnapshot {
  fileParts: FilePart[]
  files: PersistedStoredFileRecord[]
}

export class FileStorageService {
  readonly fileParts = new Map<string, FilePart>()
  readonly files: CrudCollection<StoredFileRecord>

  constructor(private readonly deps: { onChange?: () => void; blobStore?: BlobStore } = {}) {
    this.files = new CrudCollection<StoredFileRecord>(
      () => ({
        object_key: '',
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
      }),
      () => this.deps.onChange?.()
    )
  }

  reset(): void {
    this.files.clear()
    this.fileParts.clear()
    this.fileParts.set('private', { name: 'private', is_public: false })
    this.fileParts.set('public', { name: 'public', is_public: true })
    this.deps.onChange?.()
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
        object_key: existing.object_key,
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
      void this.deps.blobStore?.put(existing.object_key, input.content, input.contentType ?? existing.content_type)
      this.deps.onChange?.()
      return updated ?? existing
    }

    const objectKey = crypto.randomUUID()
    const created = this.files.create({
      object_key: objectKey,
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
    void this.deps.blobStore?.put(objectKey, input.content, input.contentType ?? null)
    this.deps.onChange?.()
    return created
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
    const deleted = this.files.softDelete(file.id)
    if (deleted) this.deps.onChange?.()
    return deleted
  }

  deleteFileById(id: number, hard = false): StoredFileRecord | null {
    const file = this.files.get(id)
    if (!file) return null
    if (hard) {
      void this.deps.blobStore?.delete(file.object_key)
      this.files.remove(id)
      this.deps.onChange?.()
      return file
    }
    const deleted = this.files.softDelete(id)
    if (deleted) this.deps.onChange?.()
    return deleted
  }

  restoreFile(id: number): StoredFileRecord | null {
    const restored = this.files.restore(id)
    if (restored) this.deps.onChange?.()
    return restored
  }

  renameFile(id: number, filename: string): StoredFileRecord | null {
    const renamed = this.files.patch(id, { filename })
    if (renamed) this.deps.onChange?.()
    return renamed
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
    this.deps.onChange?.()
    return part
  }

  deletePart(name: string): FilePart | null {
    const part = this.fileParts.get(name) ?? null
    if (!part) return null
    this.fileParts.delete(name)
    this.deps.onChange?.()
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
    this.deps.onChange?.()
    return created
  }

  snapshot(): FileStorageSnapshot {
    return {
      fileParts: [...this.fileParts.values()].map((part) => ({ ...part })),
      files: this.files.snapshot().map((file) => ({
        ...file,
        content_base64: file.content.toString('base64'),
      })),
    }
  }

  async hydrate(snapshot: FileStorageSnapshot): Promise<void> {
    this.fileParts.clear()
    for (const part of snapshot.fileParts) {
      this.fileParts.set(part.name, { ...part })
    }
    const files = await Promise.all(
      snapshot.files.map(async (file) => {
        const blobContent = await this.deps.blobStore?.get(file.object_key)
        return {
          ...file,
          content: blobContent ?? Buffer.from(file.content_base64 ?? '', 'base64'),
        }
      })
    )
    this.files.hydrate(files)
    this.deps.onChange?.()
  }
}

export const serializeStoredFileMetadata = (file: StoredFileRecord | null): StoredFileMetadata | null =>
  file
    ? {
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
    : null

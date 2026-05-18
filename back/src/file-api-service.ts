import type { FileStorageService, StoreFileInput } from './file-storage.js'
import type { StoredFileMetadata } from './types.js'

export interface UploadedFile {
  originalname: string
  buffer: Buffer
  mimetype: string
}

export class FileApiService {
  constructor(private readonly fileStorage: FileStorageService) {}

  listParts() {
    const parts = this.fileStorage.getPartNames().map((partName) => this.fileStorage.getPart(partName)!).filter(Boolean)
    return { parts, count: parts.length }
  }

  createPart(name: string, isPublic: boolean) {
    return this.fileStorage.createPart(name, isPublic)
  }

  getPart(partName: string) {
    return this.fileStorage.getPart(partName)
  }

  deletePart(partName: string) {
    return this.fileStorage.deletePart(partName)
  }

  updatePartPublic(partName: string, isPublic: boolean) {
    const exists = this.fileStorage.getPart(partName)
    if (!exists) return null
    return this.fileStorage.setPart(partName, isPublic)
  }

  uploadFile(input: { storagePartName: string; path: string; file: UploadedFile }) {
    if (!input.path) return null
    const stored = this.fileStorage.storeFile(this.buildStoreFileInput(input.storagePartName, input.path, input.file))
    return {
      file_path: { storage_part_name: input.storagePartName, path: input.path },
      metadata: this.serializeMetadata(stored),
    }
  }

  downloadFile(storagePartName: string, path: string) {
    const file = this.fileStorage.getFileByPath(storagePartName, path)
    return file ? { content: file.content, contentType: file.content_type || 'application/octet-stream' } : null
  }

  deleteFile(storagePartName: string, path: string) {
    const file = this.fileStorage.deleteFileByPath(storagePartName, path)
    return file ? { file_path: { storage_part_name: storagePartName, path } } : null
  }

  getFileInfo(storagePartName: string, path: string) {
    const file = this.fileStorage.getFileByPath(storagePartName, path)
    if (!file) return null
    return {
      file_info: {
        storage_part_name: storagePartName,
        path,
        size_bytes: file.size_bytes,
        content_type: file.content_type,
        last_modified: file.last_modified,
        etag: file.etag,
      },
    }
  }

  getPresignedUrl(storagePartName: string, path: string, expiresIn: number) {
    const file = this.fileStorage.getFileByPath(storagePartName, path)
    if (!file) return null
    return {
      presigned_url: `/user-api/file-storage/file/download?storage_part_name=${encodeURIComponent(storagePartName)}&path=${encodeURIComponent(path)}`,
      expires_in: expiresIn,
    }
  }

  listFiles(includeDeleted = false, pageCount = 20, pageNumber = 1) {
    const items = this.fileStorage
      .listFiles(includeDeleted)
      .slice((pageNumber - 1) * pageCount, pageNumber * pageCount)
      .map((file) => this.serializeMetadata(file))
    return { items }
  }

  uploadManagedFile(input: {
    storagePartName: string
    path: string
    file: UploadedFile
    filename?: string
    ext?: string
    replaceExisting?: boolean
  }) {
    const stored = this.fileStorage.storeFile(
      this.buildStoreFileInput(input.storagePartName, input.path, input.file, input.replaceExisting, input.filename, input.ext)
    )
    return { metadata: this.serializeMetadata(stored) }
  }

  getManagedFile(id: number) {
    const file = this.fileStorage.getFileById(id)
    return file ? { metadata: this.serializeMetadata(file) } : null
  }

  downloadManagedFile(id: number) {
    const file = this.fileStorage.getFileById(id)
    return file ? { content: file.content, contentType: file.content_type || 'application/octet-stream' } : null
  }

  getManagedFileUrl(id: number, expiresIn: number) {
    const file = this.fileStorage.getFileById(id)
    if (!file) return null
    return {
      url: `/user-api/file-manager/${file.id}/download`,
      expires_in: expiresIn,
    }
  }

  restoreManagedFile(id: number) {
    const file = this.fileStorage.restoreFile(id)
    return file ? { metadata: this.serializeMetadata(file) } : null
  }

  replaceManagedFile(id: number, file: UploadedFile) {
    const existing = this.fileStorage.getFileById(id)
    if (!existing) return null
    const stored = this.fileStorage.storeFile({
      storagePartName: existing.storage_part_name,
      path: existing.path,
      filename: file.originalname,
      ext: existing.ext,
      content: file.buffer,
      contentType: file.mimetype,
      replaceExisting: true,
    })
    return { metadata: this.serializeMetadata(stored) }
  }

  deleteManagedFile(id: number, hard = false) {
    const file = this.fileStorage.deleteFileById(id, hard)
    return file ? { metadata: this.serializeMetadata(file) } : null
  }

  getPartCount() {
    const parts = this.fileStorage.getPartNames().map((partName) => this.fileStorage.getPart(partName)!).filter(Boolean)
    return { parts, count: parts.length }
  }

  setPartPublic(partName: string, isPublic: boolean) {
    return this.updatePartPublic(partName, isPublic)
  }

  private buildStoreFileInput(
    storagePartName: string,
    path: string,
    file: UploadedFile,
    replaceExisting = false,
    filename = file.originalname,
    ext = filename.includes('.') ? filename.split('.').pop() ?? '' : ''
  ): StoreFileInput {
    return {
      storagePartName,
      path,
      filename,
      ext,
      content: file.buffer,
      contentType: file.mimetype,
      replaceExisting,
    }
  }

  private serializeMetadata(file: NonNullable<ReturnType<FileStorageService['getFileById']>>): StoredFileMetadata {
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

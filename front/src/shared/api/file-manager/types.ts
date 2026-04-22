export interface StoredFileMetadata {
  id: number
  file_storage_part_id: number
  path: string
  filename: string
  ext: string
  size_bytes: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface FileManagerUploadRequest {
  storage_part_name?: string
  path: string
  filename: string
  ext: string
  with_replace?: boolean
}

export interface FileManagerListResponse {
  success: boolean
  items: StoredFileMetadata[]
}

export interface FileManagerMetadataResponse {
  success: boolean
  metadata: StoredFileMetadata
}

export interface FileManagerUrlResponse {
  success: boolean
  url: string
  expires_in: number
}

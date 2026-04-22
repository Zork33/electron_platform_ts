/**
 * Типы для File Storage API
 */

export interface CreatePartRequest {
  name: string
  is_public?: boolean
}

export interface SetPublicRequest {
  is_public: boolean
}

export interface PartInfo {
  name: string
  is_public: boolean
}

export interface PartListResponse {
  parts: string[]
  count: number
}

export interface PartExistsResponse {
  part_name: string
  exists: boolean
}

export interface HealthCheckResponse {
  healthy: boolean
  service: string
}

export interface FileStorageResponse<T = Record<string, unknown>> {
  success: boolean
  message?: string
  data?: T
  part?: PartInfo
  file_info?: {
    storage_part_name: string
    path: string
    size_bytes: number
    content_type: string | null
    last_modified: string | null
    etag: string | null
  }
  presigned_url?: string
  expires_in?: number
  file_path?: {
    storage_part_name: string
    path: string
  }
}

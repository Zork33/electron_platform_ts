/**
 * Типы для Object Container API
 */

export interface ObjectInfo {
  id: string
  created_at: string
  last_accessed: string
  ttl_seconds: number
  expires_at: string | null
}

export interface CategoryInfo {
  category: string
  object_count: number
  objects: ObjectInfo[]
}

export interface StorageInfoResponse {
  summary: {
    total_categories: number
    total_objects: number
  }
  object_list: CategoryInfo[]
}

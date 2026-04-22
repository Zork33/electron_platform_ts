import type { BaseEntity } from '../base'
import type { StoredFileMetadata } from '../file-manager'

export interface LoungeEvent extends BaseEntity {
  title: string
  description: string | null
  event_type_id: number
  location_id: number
  starts_at: string | null
  ends_at: string | null
  report_gallery: StoredFileMetadata[]
}

export interface CreateLoungeEventRequest {
  title: string
  description?: string | null
  event_type_id: number
  location_id: number
  starts_at?: string | null
  ends_at?: string | null
}

export interface UpdateLoungeEventRequest {
  title?: string
  description?: string | null
  event_type_id?: number
  location_id?: number
  starts_at?: string | null
  ends_at?: string | null
}

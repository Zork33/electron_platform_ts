/**
 * Типы для WebLink API
 */
import type { BaseEntity } from '../base'

export interface WebLink extends BaseEntity {
  title: string | null
  type_id: number
  custom_type_name: string | null
  url: string
  description: string | null
}

export interface CreateWebLinkRequest {
  title?: string | null
  type_id: number
  custom_type_name?: string | null
  url: string
  description?: string | null
}

export interface UpdateWebLinkRequest {
  title?: string | null
  type_id?: number
  custom_type_name?: string | null
  url?: string
  description?: string | null
}

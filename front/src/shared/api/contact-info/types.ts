/**
 * Типы для ContactInfo API
 */
import type { BaseEntity } from '../base'

export interface ContactInfo extends BaseEntity {
  person_id: number | null
  phone_number_id: number | null
  tg_acc_id: number | null
  email_id: number | null
  web_link_id: number | null
  description: string | null
  is_primary: boolean
}

export interface CreateContactInfoRequest {
  person_id?: number | null
  phone_number_id?: number | null
  tg_acc_id?: number | null
  email_id?: number | null
  web_link_id?: number | null
  description?: string | null
  is_primary?: boolean
}

export interface UpdateContactInfoRequest {
  person_id?: number | null
  phone_number_id?: number | null
  tg_acc_id?: number | null
  email_id?: number | null
  web_link_id?: number | null
  description?: string | null
  is_primary?: boolean
  deleted_at?: string | null
}

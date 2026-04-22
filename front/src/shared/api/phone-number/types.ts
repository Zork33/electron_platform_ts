/**
 * Типы для PhoneNumber API
 */
import type { BaseEntity } from '../base'

export interface PhoneNumber extends BaseEntity {
  phone_pattern_id: number | null
  number: string | null
  full_number: string | null
}

export interface CreatePhoneNumberRequest {
  phone_pattern_id?: number | null
  number?: string | null
  full_number?: string | null
}

export interface UpdatePhoneNumberRequest {
  phone_pattern_id?: number | null
  number?: string | null
  full_number?: string | null
}

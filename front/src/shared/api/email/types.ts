/**
 * Типы для Email API
 */
import type { BaseEntity } from '../base'

export interface Email extends BaseEntity {
  address: string
}

export interface CreateEmailRequest {
  address: string
}

export interface UpdateEmailRequest {
  address?: string
}

/**
 * Типы для TgAcc API
 */
import type { BaseEntity } from '../base'

export interface TgAcc extends BaseEntity {
  user_id: number | null
  username: string | null
  first_name: string | null
  last_name: string | null
  phone_number_id: number | null
}

export interface CreateTgAccRequest {
  user_id?: number | null
  username?: string | null
  first_name?: string | null
  last_name?: string | null
  phone_number_id?: number | null
}

export interface UpdateTgAccRequest {
  user_id?: number | null
  username?: string | null
  first_name?: string | null
  last_name?: string | null
  phone_number_id?: number | null
}

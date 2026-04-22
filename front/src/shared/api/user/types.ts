/**
 * Типы для User API
 */
import type { BaseEntity } from '../base'
import type { StoredFileMetadata } from '../file-manager'

export interface User extends BaseEntity {
  person_id: number | null
  auth_email: string
  has_access: boolean
  is_admin: boolean
  session_expires_at: string | null
  avatar_id: number | null
  avatar: StoredFileMetadata | null
}

export interface CreateUserRequest {
  person_id?: number | null
  auth_email: string
  has_access?: boolean
}

export interface UpdateUserRequest {
  person_id?: number | null
  auth_email?: string
  has_access?: boolean
  avatar_id?: number | null
}

export interface UserListResponse {
  users: User[]
  total?: number
  limit?: number
  offset?: number
}

/**
 * Типы для Person API
 */
import type { BaseEntity } from '../base'

export interface Person extends BaseEntity {
  first_name: string
  last_name: string | null
  middle_name: string | null
  birth_date: string | null
  description: string | null
}

export interface CreatePersonRequest {
  first_name: string
  last_name?: string | null
  middle_name?: string | null
  birth_date?: string | null
  description?: string | null
}

export interface UpdatePersonRequest {
  first_name?: string
  last_name?: string | null
  middle_name?: string | null
  birth_date?: string | null
  description?: string | null
}

export interface PersonVectorSearchResult extends Person {
  score: number
}

export interface PersonListResponse {
  persons: Person[]
  total?: number
  limit?: number
  offset?: number
}

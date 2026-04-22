/**
 * Базовые типы для API
 */

// Общий формат ответа API
export interface ApiResponse<T> {
  data: T
  status: number
}

// Общий формат ошибки API
export interface ApiError {
  detail?: {
    error_code?: string
    error_message?: string
    meta?: Record<string, unknown>
  }
  message?: string
}

// Параметры для списков с пагинацией
export interface ListParams {
  limit?: number
  offset?: number
  order_by?: string
  order_direction?: 'asc' | 'desc'
  include_deleted?: boolean
  filters?: string // JSON array of filter objects
}

// Общий формат ответа для списков
export interface ListResponse<T> {
  items: T[]
  total?: number | undefined
  limit?: number | undefined
  offset?: number | undefined
}

// Базовые поля сущности
export interface BaseEntity {
  id: number
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

// Параметры для CRUD операций
export interface CrudConfig {
  baseUrl: string
  endpoints?: {
    list?: string
    get?: string
    create?: string
    update?: string
    delete?: string
    restore?: string
  }
}

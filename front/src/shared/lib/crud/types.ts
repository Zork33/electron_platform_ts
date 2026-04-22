/**
 * Типы для CRUD composable
 */
import type { Ref } from 'vue'
import type { BaseCrudClient, ListResponse } from '@/shared/api/base'

export interface CrudState<T> {
  items: Ref<T[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  showDeleted: Ref<boolean>
}

export interface CrudActions<T, TCreate, TUpdate> {
  fetchItems: (includeDeleted?: boolean, filters?: string) => Promise<void>
  createItem: (data: TCreate) => Promise<T>
  updateItem: (id: number, data: TUpdate) => Promise<T>
  deleteItem: (id: number) => Promise<void>
  // restoreItem: (id: number) => Promise<T> // закомментировано - нет на бэкенде
  toggleShowDeleted: () => Promise<void>
}

export interface CrudConfig<T, TCreate, TUpdate> {
  apiClient: BaseCrudClient<T, TCreate, TUpdate>
  entityName: string
  supportsSoftDelete?: boolean
  extractListData?: (response: T[] | ListResponse<T>) => T[]
}

export type UseCrudReturn<T, TCreate, TUpdate> = CrudState<T> & CrudActions<T, TCreate, TUpdate>

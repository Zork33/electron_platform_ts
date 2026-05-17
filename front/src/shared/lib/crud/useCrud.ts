/**
 * Reusable CRUD composable
 */
import { shallowRef, ref } from 'vue'
import type { CrudConfig, UseCrudReturn } from './types'

export function useCrud<T extends { id: number; deleted_at?: string | null | undefined }, TCreate, TUpdate>(
  config: CrudConfig<T, TCreate, TUpdate>
): UseCrudReturn<T, TCreate, TUpdate> {
  const {
    apiClient,
    entityName,
    supportsSoftDelete = true,
    extractListData
  } = config

  const items = shallowRef<T[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const showDeleted = ref(false)

  const fetchItems = async (includeDeleted: boolean = false, filters?: string): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const response = await apiClient.list({
        order_by: 'id',
        order_direction: 'asc',
        include_deleted: includeDeleted,
        ...(filters ? { filters } : {}),
      })

      if (extractListData) {
        items.value = extractListData(response)
      } else {
        items.value = response
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : `Ошибка загрузки ${entityName}`
      console.error(`Error fetching ${entityName}:`, err)
    } finally {
      loading.value = false
    }
  }

  const createItem = async (data: TCreate): Promise<T> => {
    loading.value = true
    error.value = null
    try {
      const newItem = await apiClient.create(data)
      items.value = [newItem, ...items.value]
      return newItem
    } catch (err) {
      error.value = err instanceof Error ? err.message : `Ошибка создания ${entityName}`
      console.error(`Error creating ${entityName}:`, err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateItem = async (id: number, data: TUpdate): Promise<T> => {
    loading.value = true
    error.value = null
    try {
      const updatedItem = await apiClient.update(id, data)

      const index = items.value.findIndex(item => item.id === id)
      if (index !== -1) {
        items.value = [
          ...items.value.slice(0, index),
          updatedItem,
          ...items.value.slice(index + 1)
        ]
      }

      return updatedItem
    } catch (err) {
      error.value = err instanceof Error ? err.message : `Ошибка обновления ${entityName}`
      console.error(`Error updating ${entityName}:`, err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteItem = async (id: number): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      await apiClient.deleteById(id)

      const index = items.value.findIndex(item => item.id === id)
      if (index !== -1) {
        if (supportsSoftDelete && showDeleted.value) {
          const currentItem = items.value[index]
          const updatedItem = Object.assign({}, currentItem, {
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          items.value = [
            ...items.value.slice(0, index),
            updatedItem,
            ...items.value.slice(index + 1)
          ]
        } else {
          items.value = items.value.filter(item => item.id !== id)
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : `Ошибка удаления ${entityName}`
      console.error(`Error deleting ${entityName}:`, err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const restoreItem = async (id: number): Promise<T> => {
    if (!supportsSoftDelete) {
      throw new Error('Restore not supported for this entity')
    }

    loading.value = true
    error.value = null
    try {
      const restoredItem = await apiClient.restore(id)

      const index = items.value.findIndex(item => item.id === id)
      if (index !== -1) {
        items.value = [
          ...items.value.slice(0, index),
          restoredItem,
          ...items.value.slice(index + 1)
        ]
      }

      return restoredItem
    } catch (err) {
      error.value = err instanceof Error ? err.message : `Ошибка восстановления ${entityName}`
      console.error(`Error restoring ${entityName}:`, err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const toggleShowDeleted = async (): Promise<void> => {
    if (!supportsSoftDelete) {
      return
    }
    showDeleted.value = !showDeleted.value
    await fetchItems(showDeleted.value)
  }

  return {
    items,
    loading,
    error,
    showDeleted,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    restoreItem,
    toggleShowDeleted
  }
}

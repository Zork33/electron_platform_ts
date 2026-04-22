/**
 * User entity composable
 */
import { useCrud } from '@/shared/lib/crud'
import { userApi } from '@/shared/api'
import type { User, CreateUserRequest, UpdateUserRequest } from './types'

export function useUser() {
  const crud = useCrud<User, CreateUserRequest, UpdateUserRequest>({
    apiClient: userApi,
    entityName: 'user',
    supportsSoftDelete: true
  })

  const formatDate = (date: string | null): string | null => {
    if (!date) return null
    return new Date(date).toLocaleDateString('ru-RU')
  }

  return {
    ...crud,
    formatDate
  }
}

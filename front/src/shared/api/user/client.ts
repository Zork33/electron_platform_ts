/**
 * User API клиент
 */
import { BaseCrudClient } from '../base'
import type { User, CreateUserRequest, UpdateUserRequest } from './types'
import { devApi } from '@/boot/axios'

class UserApiClient extends BaseCrudClient<User, CreateUserRequest, UpdateUserRequest> {
  constructor() {
    super(devApi, '/user-api/user')
  }

  async uploadAvatar(userId: number, file: File): Promise<User> {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const response = await this.axios.post<User>(`${this.baseUrl}/${userId}/avatar/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async replaceAvatar(userId: number, file: File): Promise<User> {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const response = await this.axios.put<User>(`${this.baseUrl}/${userId}/avatar/replace`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async deleteAvatar(userId: number): Promise<User> {
    return this.deleteRequest<User>(`${this.baseUrl}/${userId}/avatar`)
  }

  async getAvatarContentBlob(userId: number, cacheBuster?: string): Promise<Blob> {
    try {
      const params = cacheBuster ? { t: cacheBuster } : undefined
      const response = await this.axios.get<Blob>(`${this.baseUrl}/${userId}/avatar/content`, {
        params,
        responseType: 'blob'
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }
}

export const userApi = new UserApiClient()

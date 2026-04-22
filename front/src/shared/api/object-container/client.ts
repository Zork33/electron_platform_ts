/**
 * Object Container API клиент (dev-api)
 */
import { BaseApiClient } from '../base'
import type { StorageInfoResponse } from './types'
import { devApi } from '@/boot/axios'

class ObjectContainerApiClient extends BaseApiClient {
  private readonly baseUrl = '/dev-api/object-container'

  constructor() {
    super(devApi)
  }

  /**
   * Получить информацию о хранилище объектов
   */
  async getStorageInfo(): Promise<StorageInfoResponse> {
    return this.get<StorageInfoResponse>(`${this.baseUrl}/storage-info`)
  }
}

export const objectContainerApi = new ObjectContainerApiClient()

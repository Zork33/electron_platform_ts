/**
 * File Storage API клиент
 */
import { BaseApiClient } from '../base'
import type {
  CreatePartRequest,
  SetPublicRequest,
  PartListResponse,
  PartExistsResponse,
  HealthCheckResponse,
  FileStorageResponse
} from './types'
import { devApi } from '@/boot/axios'

class FileStorageApiClient extends BaseApiClient {
  private readonly baseUrl = '/dev-api/file-storage/part'
  private readonly userApiBaseUrl = '/user-api/file-storage/part'

  constructor() {
    super(devApi)
  }

  /**
   * Создать раздел (bucket)
   */
  async createPart(data: CreatePartRequest): Promise<FileStorageResponse> {
    return this.post<FileStorageResponse>(`${this.userApiBaseUrl}/create`, data)
  }

  /**
   * Удалить раздел
   */
  async deletePart(partName: string): Promise<FileStorageResponse> {
    return this.deleteRequest<FileStorageResponse>(`${this.userApiBaseUrl}/${partName}`)
  }

  /**
   * Проверить существование раздела
   */
  async checkPartExists(partName: string): Promise<PartExistsResponse> {
    return this.get<PartExistsResponse>(`${this.userApiBaseUrl}/${partName}`)
  }

  /**
   * Получить список всех разделов
   */
  async listParts(): Promise<PartListResponse> {
    return this.get<PartListResponse>(`${this.baseUrl}/`)
  }

  /**
   * Установить публичность раздела
   */
  async setPartPublic(partName: string, data: SetPublicRequest): Promise<FileStorageResponse> {
    return this.patch<FileStorageResponse>(`${this.baseUrl}/${partName}/public`, data)
  }

  /**
   * Health check файлового хранилища
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>(`${this.baseUrl}/health/check`)
  }

  /**
   * Загрузить файл
   */
  async uploadFile(partName: string, file: File, path: string): Promise<FileStorageResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('storage_part_name', partName)
    formData.append('path', path)

    try {
      const response = await this.axios.post<FileStorageResponse>(
        `/user-api/file-storage/file/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      )
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  /**
   * Скачать файл
   */
  async downloadFile(partName: string, path: string): Promise<Blob> {
    try {
      const response = await this.axios.get(
        `/user-api/file-storage/file/download`,
        {
          params: { storage_part_name: partName, path },
          responseType: 'blob'
        }
      )
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  /**
   * Удалить файл
   */
  async deleteFile(partName: string, path: string): Promise<FileStorageResponse> {
    return this.deleteRequest<FileStorageResponse>(
      `/user-api/file-storage/file/delete?storage_part_name=${partName}&path=${path}`
    )
  }

  /**
   * Получить информацию о файле
   */
  async getFileInfo(partName: string, path: string): Promise<FileStorageResponse> {
    return this.get<FileStorageResponse>(
      `/user-api/file-storage/file/info`,
      { storage_part_name: partName, path }
    )
  }

  /**
   * Получить presigned URL для скачивания файла
   */
  async getPresignedUrl(partName: string, path: string, expiresIn: number = 3600): Promise<FileStorageResponse> {
    return this.get<FileStorageResponse>(
      `/user-api/file-storage/file/presigned-url`,
      { storage_part_name: partName, path, expires_in: expiresIn }
    )
  }
}

export const fileStorageApi = new FileStorageApiClient()

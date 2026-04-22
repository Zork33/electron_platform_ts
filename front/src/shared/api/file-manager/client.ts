/**
 * File Manager API клиент
 */
import { BaseApiClient } from '../base'
import type {
  FileManagerListResponse,
  FileManagerMetadataResponse,
  FileManagerUrlResponse
} from './types'
import { devApi } from '@/boot/axios'

class FileManagerApiClient extends BaseApiClient {
  private readonly baseUrl = '/user-api/file-manager'

  constructor() {
    super(devApi)
  }

  async upload(
    file: File,
    path: string,
    filename: string,
    ext: string,
    storagePartName: string = 'private',
    withReplace: boolean = false
  ): Promise<FileManagerMetadataResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('storage_part_name', storagePartName)
    formData.append('path', path)
    formData.append('filename', filename)
    formData.append('ext', ext)
    formData.append('with_replace', String(withReplace))

    try {
      const response = await this.axios.post<FileManagerMetadataResponse>(
        `${this.baseUrl}/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async list(includeDeleted: boolean = false, pageCount: number = 20, pageNumber: number = 1): Promise<FileManagerListResponse> {
    try {
      const data = await this.axios.get<FileManagerListResponse>(`${this.baseUrl}/list`, {
        params: {
          include_deleted: includeDeleted,
          page_count: pageCount,
          page_number: pageNumber
        }
      })
      return data.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getMetadata(storedFileId: number): Promise<FileManagerMetadataResponse> {
    try {
      const data = await this.axios.get<FileManagerMetadataResponse>(`${this.baseUrl}/${storedFileId}`)
      return data.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async download(storedFileId: number): Promise<Blob> {
    try {
      const response = await this.axios.get(`${this.baseUrl}/${storedFileId}/download`, {
        responseType: 'blob'
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getUrl(storedFileId: number, expiresIn: number = 3600): Promise<FileManagerUrlResponse> {
    try {
      const data = await this.axios.get<FileManagerUrlResponse>(`${this.baseUrl}/${storedFileId}/url`, {
        params: { expires_in: expiresIn }
      })
      return data.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async restore(storedFileId: number): Promise<FileManagerMetadataResponse> {
    try {
      const data = await this.axios.post<FileManagerMetadataResponse>(`${this.baseUrl}/${storedFileId}/restore`)
      return data.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async delete(storedFileId: number, hard: boolean = false): Promise<FileManagerMetadataResponse> {
    try {
      const response = await this.axios.delete<FileManagerMetadataResponse>(
        `${this.baseUrl}/${storedFileId}`,
        { params: { hard } }
      )
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async replace(storedFileId: number, file: File): Promise<FileManagerMetadataResponse> {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await this.axios.put<FileManagerMetadataResponse>(
        `${this.baseUrl}/${storedFileId}/replace`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }
}

export const fileManagerApi = new FileManagerApiClient()

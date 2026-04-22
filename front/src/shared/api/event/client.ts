import { BaseCrudClient } from '../base'
import type {
  LoungeEvent,
  CreateLoungeEventRequest,
  UpdateLoungeEventRequest,
} from './types'
import type { StoredFileMetadata } from '../file-manager'
import { devApi } from '@/boot/axios'

class LoungeEventApiClient extends BaseCrudClient<
  LoungeEvent,
  CreateLoungeEventRequest,
  UpdateLoungeEventRequest
> {
  constructor() {
    super(devApi, '/user-api/event')
  }

  async uploadReportGalleryImage(
    eventId: number,
    file: File
  ): Promise<{ success: boolean; metadata: StoredFileMetadata }> {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const response = await this.axios.post<{ success: boolean; metadata: StoredFileMetadata }>(
        `${this.baseUrl}/${eventId}/report_gallery/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async removeReportGalleryImage(eventId: number, storedFileId: number): Promise<void> {
    try {
      await this.axios.delete(`${this.baseUrl}/${eventId}/report_gallery/${storedFileId}`)
    } catch (error) {
      this.handleError(error)
    }
  }

  async getReportGalleryImageUrl(storedFileId: number, expiresIn: number = 3600): Promise<string> {
    try {
      const response = await this.axios.get<{ success: boolean; url: string }>(
        `/user-api/file-manager/${storedFileId}/url`,
        { params: { expires_in: expiresIn } }
      )
      return response.data.url
    } catch (error) {
      return this.handleError(error)
    }
  }

  async reorderReportGallery(eventId: number, orderedIds: number[]): Promise<void> {
    try {
      await this.axios.put(`${this.baseUrl}/${eventId}/report_gallery/reorder`, {
        ordered_ids: orderedIds,
      })
    } catch (error) {
      this.handleError(error)
    }
  }

  async renameReportGalleryItem(
    eventId: number,
    storedFileId: number,
    filename: string
  ): Promise<{ success: boolean; metadata: StoredFileMetadata }> {
    try {
      const response = await this.axios.patch<{ success: boolean; metadata: StoredFileMetadata }>(
        `${this.baseUrl}/${eventId}/report_gallery/${storedFileId}/rename`,
        { filename }
      )
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }
}

export const loungeEventApi = new LoungeEventApiClient()

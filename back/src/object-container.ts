import type { FileStorageService } from './file-storage.js'

export interface ObjectContainerItem {
  id: string
  created_at: string
  last_accessed: string
  ttl_seconds: number
  expires_at: string | null
}

export interface ObjectContainerCategory {
  category: string
  object_count: number
  objects: ObjectContainerItem[]
}

export interface ObjectContainerStorageInfo {
  summary: {
    total_categories: number
    total_objects: number
  }
  object_list: ObjectContainerCategory[]
}

export class ObjectContainerService {
  constructor(private readonly fileStorage: FileStorageService) {}

  getStorageInfo(): ObjectContainerStorageInfo {
    const objectList = this.fileStorage.getPartNames().map((category) => {
      const objects = this.fileStorage
        .listFiles(true)
        .filter((file) => file.storage_part_name === category)
        .map((file) => ({
          id: String(file.id),
          created_at: file.created_at,
          last_accessed: file.updated_at,
          ttl_seconds: 86400,
          expires_at: file.deleted_at ? file.deleted_at : null,
        }))
      return {
        category,
        object_count: objects.length,
        objects,
      }
    })

    return {
      summary: {
        total_categories: objectList.length,
        total_objects: objectList.reduce((sum, category) => sum + category.object_count, 0),
      },
      object_list: objectList,
    }
  }
}

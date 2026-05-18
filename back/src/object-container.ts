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

export interface ObjectContainerCleanerInfo {
  summary: {
    last_cleanup: string | null
    next_cleanup: string | null
    is_running: boolean
    interval_seconds: number | null
  }
  cleanup_log: Array<{
    datetime: string
    cleaned_count: number
  }>
}

export interface ObjectContainerContainerInfo {
  initialization_time: string
  total_categories: number
  total_objects: number
  cleaner_running: boolean
}

export interface ObjectContainerAllStatistics {
  storage: ObjectContainerStorageInfo
  cleaner: ObjectContainerCleanerInfo
  container: ObjectContainerContainerInfo
}

export class ObjectContainerService {
  private readonly initializationTime = new Date().toISOString()
  private readonly cleanupLog: Array<{ datetime: string; cleaned_count: number }> = []
  private isCleanerRunning = false
  private intervalSeconds: number | null = null
  private lastCleanupTime: string | null = null

  constructor(private readonly fileStorage: FileStorageService) {}

  getStorageInfo(): ObjectContainerStorageInfo {
    const objectList = this.fileStorage.getPartNames().map((category) => {
      const objects = this.fileStorage
        .listFiles(false)
        .filter((file) => file.storage_part_name === category)
        .map((file) => ({
          id: String(file.id),
          created_at: file.created_at,
          last_accessed: file.updated_at,
          ttl_seconds: -1,
          expires_at: null,
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

  getCleanerInfo(): ObjectContainerCleanerInfo {
    return {
      summary: {
        last_cleanup: this.lastCleanupTime,
        next_cleanup: this.getNextCleanupTime(),
        is_running: this.isCleanerRunning,
        interval_seconds: this.intervalSeconds,
      },
      cleanup_log: [...this.cleanupLog],
    }
  }

  getContainerInfo(): ObjectContainerContainerInfo {
    const storageInfo = this.getStorageInfo()
    return {
      initialization_time: this.initializationTime,
      total_categories: storageInfo.summary.total_categories,
      total_objects: storageInfo.summary.total_objects,
      cleaner_running: this.isCleanerRunning,
    }
  }

  getAllStatistics(): ObjectContainerAllStatistics {
    return {
      storage: this.getStorageInfo(),
      cleaner: this.getCleanerInfo(),
      container: this.getContainerInfo(),
    }
  }

  startCleaner(intervalSeconds = 300): void {
    this.isCleanerRunning = true
    this.intervalSeconds = intervalSeconds
  }

  stopCleaner(): void {
    this.isCleanerRunning = false
  }

  recordCleanup(cleanedCount: number): void {
    const datetime = new Date().toISOString()
    this.lastCleanupTime = datetime
    this.cleanupLog.push({ datetime, cleaned_count: cleanedCount })
    if (this.cleanupLog.length > 100) {
      this.cleanupLog.splice(0, this.cleanupLog.length - 100)
    }
  }

  cleanupExpiredObjects(): number {
    const trashedFiles = this.fileStorage
      .listFiles(true)
      .filter((file) => file.deleted_at !== null && file.storage_part_name === 'trash')
    for (const file of trashedFiles) {
      this.fileStorage.deleteFileById(file.id, true)
    }
    const expiredCount = trashedFiles.length
    this.recordCleanup(expiredCount)
    return expiredCount
  }

  private getNextCleanupTime(): string | null {
    if (!this.isCleanerRunning || !this.lastCleanupTime || this.intervalSeconds === null) return null
    const next = new Date(new Date(this.lastCleanupTime).getTime() + this.intervalSeconds * 1000)
    return next.toISOString()
  }
}

export type MediaType = 'image' | 'video' | 'audio' | 'text' | 'other'

export interface MediaItem {
  id: number
  filename: string
  ext: string
  type: MediaType
  size_bytes: number
}

export interface MediaFileTypeSettings {
  allowedExtensions: string[]
}

export interface MediaFileSettings {
  image?: MediaFileTypeSettings
  video?: MediaFileTypeSettings
  audio?: MediaFileTypeSettings
  any?: { allowedExtensions?: string[] }
}

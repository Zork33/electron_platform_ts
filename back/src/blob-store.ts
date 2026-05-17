import crypto from 'node:crypto'
import { Client } from 'minio'

export interface BlobStore {
  put(objectKey: string, content: Buffer, contentType?: string | null): Promise<void> | void
  get(objectKey: string): Promise<Buffer | null> | Buffer | null
  delete(objectKey: string): Promise<void> | void
  has(objectKey: string): Promise<boolean> | boolean
}

export class MemoryBlobStore implements BlobStore {
  private readonly objects = new Map<string, Buffer>()

  put(objectKey: string, content: Buffer): void {
    this.objects.set(objectKey, Buffer.from(content))
  }

  get(objectKey: string): Buffer | null {
    const content = this.objects.get(objectKey)
    return content ? Buffer.from(content) : null
  }

  delete(objectKey: string): void {
    this.objects.delete(objectKey)
  }

  has(objectKey: string): boolean {
    return this.objects.has(objectKey)
  }
}

export type MinioBlobStoreConfig = ConstructorParameters<typeof Client>[0] & {
  bucketName: string
}

export class MinioBlobStore implements BlobStore {
  private readonly client: Client

  constructor(private readonly config: MinioBlobStoreConfig) {
    this.client = new Client(config)
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.config.bucketName)
    if (!exists) {
      await this.client.makeBucket(this.config.bucketName)
    }
  }

  async put(objectKey: string, content: Buffer, contentType?: string | null): Promise<void> {
    await this.ensureBucket()
    await this.client.putObject(this.config.bucketName, objectKey, content, content.length, {
      'Content-Type': contentType ?? 'application/octet-stream',
      'x-amz-meta-etag': crypto.createHash('sha1').update(content).digest('hex'),
    })
  }

  async get(objectKey: string): Promise<Buffer | null> {
    try {
      await this.ensureBucket()
      const stream = await this.client.getObject(this.config.bucketName, objectKey)
      const chunks: Buffer[] = []
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      return Buffer.concat(chunks)
    } catch {
      return null
    }
  }

  async delete(objectKey: string): Promise<void> {
    await this.ensureBucket()
    await this.client.removeObject(this.config.bucketName, objectKey)
  }

  async has(objectKey: string): Promise<boolean> {
    try {
      await this.ensureBucket()
      await this.client.statObject(this.config.bucketName, objectKey)
      return true
    } catch {
      return false
    }
  }
}

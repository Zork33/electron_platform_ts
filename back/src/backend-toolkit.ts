import { MemoryBlobStore, MinioBlobStore, type BlobStore } from './blob-store.js'
import { NoopEmailSender, SmtpEmailSender, type EmailSender } from './email-sender.js'
import { NoopTelegramNotifier, TelegramBotApiNotifier, type TelegramNotifier } from './telegram-notifier.js'

export type BackendToolkitBlobStoreMode = 'memory' | 'minio'
export type BackendToolkitEmailSenderMode = 'noop' | 'smtp'
export type BackendToolkitTelegramMode = 'noop' | 'telegram-bot-api'

export interface BackendToolkitStatus {
  blob_store_mode: BackendToolkitBlobStoreMode
  email_sender_mode: BackendToolkitEmailSenderMode
  telegram_notifier_mode: BackendToolkitTelegramMode
  minio_configured: boolean
  smtp_configured: boolean
  telegram_configured: boolean
}

export interface BackendToolkit {
  blobStore: BlobStore
  emailSender: EmailSender
  telegramNotifier: TelegramNotifier
  status: BackendToolkitStatus
}

const isTruthy = (value: string | undefined): boolean => String(value ?? '').toLowerCase() === 'true'

export function createBackendToolkit(): BackendToolkit {
  const minioConfigured = Boolean(process.env.FILE_STORAGE_HOST)
  const smtpConfigured = Boolean(process.env.EMAIL_SMTP_HOST && process.env.EMAIL_FROM)
  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN)

  const blobStore = minioConfigured
    ? new MinioBlobStore({
        endPoint: process.env.FILE_STORAGE_HOST ?? 'localhost',
        port: Number(process.env.FILE_STORAGE_PORT ?? 9000),
        useSSL: isTruthy(process.env.FILE_STORAGE_USE_SSL),
        accessKey: process.env.FILE_STORAGE_CLIENT_LOGIN ?? 'admin',
        secretKey: process.env.FILE_STORAGE_CLIENT_PASSWORD ?? 'FilestoragePass123',
        bucketName: process.env.FILE_STORAGE_BUCKET_NAME ?? 'electron-platform-files',
      })
    : new MemoryBlobStore()

  const emailSender = smtpConfigured
    ? new SmtpEmailSender({
        host: process.env.EMAIL_SMTP_HOST ?? '',
        port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
        secure: isTruthy(process.env.EMAIL_SMTP_SECURE),
        authUser: process.env.EMAIL_SMTP_USER,
        authPass: process.env.EMAIL_SMTP_PASSWORD,
        fromEmail: process.env.EMAIL_FROM ?? '',
      })
    : new NoopEmailSender()

  const telegramNotifier = telegramConfigured
    ? new TelegramBotApiNotifier({
        botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
        apiUrl: process.env.TELEGRAM_API_URL,
      })
    : new NoopTelegramNotifier()

  return {
    blobStore,
    emailSender,
    telegramNotifier,
    status: {
      blob_store_mode: minioConfigured ? 'minio' : 'memory',
      email_sender_mode: smtpConfigured ? 'smtp' : 'noop',
      telegram_notifier_mode: telegramConfigured ? 'telegram-bot-api' : 'noop',
      minio_configured: minioConfigured,
      smtp_configured: smtpConfigured,
      telegram_configured: telegramConfigured,
    },
  }
}

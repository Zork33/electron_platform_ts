import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createBackendToolkit } from '../src/backend-toolkit.js'

const snapshotEnv = {
  FILE_STORAGE_HOST: process.env.FILE_STORAGE_HOST,
  FILE_STORAGE_PORT: process.env.FILE_STORAGE_PORT,
  FILE_STORAGE_USE_SSL: process.env.FILE_STORAGE_USE_SSL,
  FILE_STORAGE_CLIENT_LOGIN: process.env.FILE_STORAGE_CLIENT_LOGIN,
  FILE_STORAGE_CLIENT_PASSWORD: process.env.FILE_STORAGE_CLIENT_PASSWORD,
  FILE_STORAGE_BUCKET_NAME: process.env.FILE_STORAGE_BUCKET_NAME,
  EMAIL_SMTP_HOST: process.env.EMAIL_SMTP_HOST,
  EMAIL_SMTP_PORT: process.env.EMAIL_SMTP_PORT,
  EMAIL_SMTP_SECURE: process.env.EMAIL_SMTP_SECURE,
  EMAIL_SMTP_USER: process.env.EMAIL_SMTP_USER,
  EMAIL_SMTP_PASSWORD: process.env.EMAIL_SMTP_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_API_URL: process.env.TELEGRAM_API_URL,
}

beforeEach(() => {
  delete process.env.FILE_STORAGE_HOST
  delete process.env.FILE_STORAGE_PORT
  delete process.env.FILE_STORAGE_USE_SSL
  delete process.env.FILE_STORAGE_CLIENT_LOGIN
  delete process.env.FILE_STORAGE_CLIENT_PASSWORD
  delete process.env.FILE_STORAGE_BUCKET_NAME
  delete process.env.EMAIL_SMTP_HOST
  delete process.env.EMAIL_SMTP_PORT
  delete process.env.EMAIL_SMTP_SECURE
  delete process.env.EMAIL_SMTP_USER
  delete process.env.EMAIL_SMTP_PASSWORD
  delete process.env.EMAIL_FROM
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_API_URL
})

afterEach(() => {
  for (const [key, value] of Object.entries(snapshotEnv)) {
    if (typeof value === 'string') {
      process.env[key] = value
    } else {
      delete process.env[key]
    }
  }
})

describe('backend toolkit', () => {
  test('exposes noop modes by default', () => {
    const toolkit = createBackendToolkit()

    expect(toolkit.status).toEqual({
      blob_store_mode: 'memory',
      email_sender_mode: 'noop',
      telegram_notifier_mode: 'noop',
      minio_configured: false,
      smtp_configured: false,
      telegram_configured: false,
    })
  })

  test('switches to configured adapters when env vars are present', () => {
    process.env.FILE_STORAGE_HOST = 'minio.local'
    process.env.FILE_STORAGE_PORT = '9000'
    process.env.FILE_STORAGE_USE_SSL = 'false'
    process.env.FILE_STORAGE_CLIENT_LOGIN = 'minio'
    process.env.FILE_STORAGE_CLIENT_PASSWORD = 'secret'
    process.env.FILE_STORAGE_BUCKET_NAME = 'bucket'
    process.env.EMAIL_SMTP_HOST = 'smtp.local'
    process.env.EMAIL_SMTP_PORT = '587'
    process.env.EMAIL_SMTP_SECURE = 'false'
    process.env.EMAIL_FROM = 'noreply@example.com'
    process.env.TELEGRAM_BOT_TOKEN = 'token'

    const toolkit = createBackendToolkit()

    expect(toolkit.status).toEqual({
      blob_store_mode: 'minio',
      email_sender_mode: 'smtp',
      telegram_notifier_mode: 'telegram-bot-api',
      minio_configured: true,
      smtp_configured: true,
      telegram_configured: true,
    })
  })
})

/**
 * Извлекает человекочитаемое сообщение из ошибки API.
 * API возвращает ошибки в формате { detail: string }.
 */
export function parseApiErrorMessage(error: unknown, fallback = 'Ошибка при выполнении операции'): string {
  if (!error) return fallback

  // Объект с полем detail (например, response.data от axios)
  if (typeof error === 'object' && error !== null && 'detail' in error) {
    const d = (error as { detail?: unknown }).detail
    if (typeof d === 'string' && d.trim()) return d
  }

  const message = error instanceof Error ? error.message : (typeof error === 'string' ? error : '')
  try {
    const parsed = JSON.parse(message) as { detail?: string }
    if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
      return parsed.detail
    }
  } catch {
    if (message && message.length < 200) return message
  }
  return fallback
}

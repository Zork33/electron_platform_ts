import { ref, readonly } from 'vue'
import { getAccessToken } from '@/shared/lib/cookies'

type MessageHandler = (data: Record<string, unknown>) => void

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const ws = ref<WebSocket | null>(null)
const connected = ref(false)

const handlers = new Map<string, Set<MessageHandler>>()

let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelay = 1000
let intentionallyClosed = false

function getWsUrl(): string | null {
  const token = getAccessToken()
  if (!token) return null
  const base = API_BASE_URL.replace(/^http/, 'ws')
  return `${base}/ws?token=${token}`
}

function resetReconnect() {
  reconnectDelay = 1000
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect() {
  if (intentionallyClosed) return
  reconnectTimer = setTimeout(() => {
    connect()
  }, reconnectDelay)
  reconnectDelay = Math.min(reconnectDelay * 2, 30000)
}

function onMessage(event: MessageEvent) {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(event.data)
  } catch {
    return
  }

  const type = data.type as string | undefined

  if (type === 'ping') {
    ws.value?.send(JSON.stringify({ type: 'pong' }))
    return
  }

  if (type === 'debug') {
    const target = data.target as string | undefined
    const message = data.message as string | undefined
    console.log(`[WS DEBUG] target=${target ?? '?'} message="${message ?? ''}"`, data)
    return
  }

  if (type) {
    const typeHandlers = handlers.get(type)
    if (typeHandlers) {
      typeHandlers.forEach((h) => h(data))
    }
  }

  const allHandlers = handlers.get('*')
  if (allHandlers) {
    allHandlers.forEach((h) => h(data))
  }
}

function connect() {
  if (ws.value && ws.value.readyState <= WebSocket.OPEN) return

  const url = getWsUrl()
  if (!url) return

  intentionallyClosed = false

  const socket = new WebSocket(url)

  socket.onopen = () => {
    connected.value = true
    resetReconnect()
  }

  socket.onmessage = onMessage

  socket.onclose = () => {
    connected.value = false
    ws.value = null
    scheduleReconnect()
  }

  socket.onerror = () => {
    socket.close()
  }

  ws.value = socket
}

function disconnect() {
  intentionallyClosed = true
  resetReconnect()
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
  connected.value = false
}

function on(type: string, handler: MessageHandler): () => void {
  if (!handlers.has(type)) {
    handlers.set(type, new Set())
  }
  handlers.get(type)!.add(handler)
  return () => handlers.get(type)?.delete(handler)
}

function send(data: Record<string, unknown>) {
  if (ws.value?.readyState === WebSocket.OPEN) {
    ws.value.send(JSON.stringify(data))
  }
}

export function useWebSocket() {
  return {
    connected: readonly(connected),
    connect,
    disconnect,
    on,
    send,
  }
}

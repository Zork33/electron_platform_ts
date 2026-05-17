import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { buildRouters } from './routes.js'
import { store } from './store.js'

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

app.use(cors())
app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ extended: true }))

const wsApi = {
  broadcast(payload: unknown) {
    const data = JSON.stringify(payload)
    for (const socket of store.wsSockets.values()) {
      socket.send(data)
    }
  },
  sendToUser(userId: number, payload: unknown) {
    const data = JSON.stringify(payload)
    for (const [connId, meta] of store.wsConnections.entries()) {
      if (meta.user_id === userId) {
        const socket = store.wsSockets.get(connId)
        socket?.send(data)
      }
    }
  },
  sendToConnection(connId: number, payload: unknown) {
    const data = JSON.stringify(payload)
    const socket = store.wsSockets.get(connId)
    socket?.send(data)
  },
}

const { userApi, devApi } = buildRouters(wsApi)

app.use('/user-api', userApi)
app.use('/dev-api', devApi)

app.get('/health', (_req, res) => {
  res.json({ healthy: true, service: 'electron-platform-ts' })
})

const pingIntervalMs = 30_000
const pingTimer = setInterval(() => {
  for (const [connId, socket] of store.wsSockets.entries()) {
    socket.send(JSON.stringify({ type: 'ping' }))
    store.updateWsConnection(connId, { last_ping_at: new Date().toISOString() })
  }
}, pingIntervalMs)

wss.on('connection', (socket, req) => {
  const token = typeof req.url === 'string' ? new URL(req.url, 'http://localhost').searchParams.get('token') : null
  const user = token ? store.getUserByAccessToken(token) : null
  if (!user) {
    socket.close(4001, 'Unauthorized')
    return
  }

  const connId = store.registerWsConnection({
    userId: user.id,
    clientIp: req.socket.remoteAddress ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  })

  store.wsSockets.set(connId, {
    send: (data: string) => socket.send(data),
    close: () => socket.close(),
  })

  socket.send(JSON.stringify({ type: 'debug', target: 'connection', message: 'connected', conn_id: connId }))

  socket.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString()) as { type?: string }
      if (data.type === 'pong') {
        store.updateWsConnection(connId, { last_pong_at: new Date().toISOString() })
      }
    } catch {
      // ignore malformed frames
    }
  })

  socket.on('close', () => {
    store.removeWsConnection(connId)
  })

  socket.on('error', () => {
    store.removeWsConnection(connId)
  })
})

const port = Number(process.env.PORT || 8000)
server.listen(port, () => {
  console.log(`TS backend listening on http://localhost:${port}`)
})

process.on('SIGINT', () => {
  clearInterval(pingTimer)
  server.close(() => process.exit(0))
})


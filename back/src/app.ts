import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { buildRouters } from './routes.js'
import { store } from './store.js'

export type WsApi = {
  broadcast: (payload: unknown) => void
  sendToUser: (userId: number, payload: unknown) => void
  sendToConnection: (connId: number, payload: unknown) => void
}

export function createDefaultWsApi(): WsApi {
  return {
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
}

export function createBackendApp(wsApi: WsApi = createDefaultWsApi()) {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '20mb' }))
  app.use(express.urlencoded({ extended: true }))

  const { userApi, devApi } = buildRouters(wsApi)
  app.use('/user-api', userApi)
  app.use('/dev-api', devApi)

  app.get('/health', (_req, res) => {
    res.json({ healthy: true, service: 'electron-platform-ts' })
  })

  return app
}

export function attachWebSocketServer(wss: WebSocketServer) {
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
}

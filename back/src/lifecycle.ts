import http from 'node:http'
import { WebSocketServer } from 'ws'
import { attachWebSocketServer, createBackendApp } from './app.js'
import { store } from './store.js'

export interface BackendLifecycle {
  start(): Promise<void>
  stop(): Promise<void>
}

export function createBackendLifecycle(): BackendLifecycle {
  let server: http.Server | null = null
  let wss: WebSocketServer | null = null
  let pingTimer: NodeJS.Timeout | null = null

  return {
    async start() {
      await store.init()

      const app = createBackendApp()
      server = http.createServer(app)
      wss = new WebSocketServer({ server, path: '/ws' })
      attachWebSocketServer(wss)

      const pingIntervalMs = 30_000
      pingTimer = setInterval(() => {
        store.ws.forEachSocket((connId, socket) => {
          socket.send(JSON.stringify({ type: 'ping' }))
          store.ws.updateConnection(connId, { last_ping_at: new Date().toISOString() })
        })
      }, pingIntervalMs)

      const port = Number(process.env.PORT || 8000)
      await new Promise<void>((resolve) => {
        server!.listen(port, () => resolve())
      })
      console.log(`TS backend listening on http://localhost:${port}`)
    },

    async stop() {
      if (pingTimer) {
        clearInterval(pingTimer)
        pingTimer = null
      }
      await new Promise<void>((resolve) => {
        if (!server) return resolve()
        server.close(() => resolve())
      })
      if (wss) {
        await new Promise<void>((resolve) => {
          wss!.close(() => resolve())
        })
        wss = null
      }
      server = null
    },
  }
}

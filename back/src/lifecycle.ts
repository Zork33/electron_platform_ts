import http from 'node:http'
import { WebSocketServer } from 'ws'
import { attachWebSocketServer, createBackendApp } from './app.js'
import { store } from './store.js'
import type { WsSocketHandle } from './ws-service.js'

export interface BackendLifecycle {
  start(): Promise<void>
  stop(): Promise<void>
  getStatus(): BackendLifecycleStatus
}

export type BackendLifecyclePhase = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped'

export interface BackendLifecycleStatus {
  phase: BackendLifecyclePhase
  port: number | null
  has_server: boolean
  has_websocket_server: boolean
  has_ping_timer: boolean
  store_initialized: boolean
}

export function createBackendLifecycle(): BackendLifecycle {
  let server: http.Server | null = null
  let wss: WebSocketServer | null = null
  let pingTimer: NodeJS.Timeout | null = null
  let phase: BackendLifecyclePhase = 'idle'
  let port: number | null = null
  let storeInitialized = false

  const getStatus = (): BackendLifecycleStatus => ({
    phase,
    port,
    has_server: server !== null,
    has_websocket_server: wss !== null,
    has_ping_timer: pingTimer !== null,
    store_initialized: storeInitialized,
  })

  return {
    getStatus,

    async start() {
      phase = 'starting'
      await store.init()
      storeInitialized = true

      const app = createBackendApp()
      server = http.createServer(app)
      wss = new WebSocketServer({ server, path: '/ws' })
      attachWebSocketServer(wss)

      const pingIntervalMs = 30_000
      pingTimer = setInterval(() => {
        store.ws.forEachSocket((connId: number, socket: WsSocketHandle) => {
          socket.send(JSON.stringify({ type: 'ping' }))
          store.ws.updateConnection(connId, { last_ping_at: new Date().toISOString() })
        })
      }, pingIntervalMs)

      port = Number(process.env.PORT || 8000)
      await new Promise<void>((resolve) => {
        server!.listen(port, () => resolve())
      })
      phase = 'running'
      console.log(`TS backend listening on http://localhost:${port}`)
    },

    async stop() {
      phase = 'stopping'
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
      phase = 'stopped'
    },
  }
}

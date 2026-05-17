import http from 'node:http'
import { AddressInfo } from 'node:net'
import { WebSocketServer } from 'ws'
import { attachWebSocketServer, createBackendApp, createDefaultWsApi, type WsApi } from '../src/app.js'
import { store } from '../src/store.js'

export type TestServer = {
  baseUrl: string
  wsUrl: string
  close: () => Promise<void>
}

export function resetStore() {
  store.reset()
}

export async function startTestServer(wsApiOverrides: Partial<WsApi> = {}): Promise<TestServer> {
  store.reset()

  const wsApi: WsApi = {
    broadcast: wsApiOverrides.broadcast ?? createDefaultWsApi().broadcast,
    sendToUser: wsApiOverrides.sendToUser ?? createDefaultWsApi().sendToUser,
    sendToConnection: wsApiOverrides.sendToConnection ?? createDefaultWsApi().sendToConnection,
  }

  const app = createBackendApp(wsApi)
  const server = http.createServer(app)
  const wss = new WebSocketServer({ server, path: '/ws' })
  attachWebSocketServer(wss)

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`
  const wsUrl = `ws://127.0.0.1:${address.port}/ws`

  return {
    baseUrl,
    wsUrl,
    close: async () => {
      await new Promise<void>((resolve) => {
        wss.close(() => resolve())
      })
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    },
  }
}

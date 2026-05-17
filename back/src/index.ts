import http from 'node:http'
import { WebSocketServer } from 'ws'
import { attachWebSocketServer, createBackendApp } from './app.js'
import { store } from './store.js'

const app = createBackendApp()
const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })
attachWebSocketServer(wss)

const pingIntervalMs = 30_000
const pingTimer = setInterval(() => {
  store.ws.forEachSocket((connId, socket) => {
    socket.send(JSON.stringify({ type: 'ping' }))
    store.updateWsConnection(connId, { last_ping_at: new Date().toISOString() })
  })
}, pingIntervalMs)

const port = Number(process.env.PORT || 8000)
server.listen(port, () => {
  console.log(`TS backend listening on http://localhost:${port}`)
})

process.on('SIGINT', () => {
  clearInterval(pingTimer)
  server.close(() => process.exit(0))
})

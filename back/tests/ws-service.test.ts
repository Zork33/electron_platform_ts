import { describe, expect, test } from 'vitest'
import { WebSocketService } from '../src/ws-service.js'

describe('websocket service', () => {
  test('tracks connections and routes messages', () => {
    const ws = new WebSocketService()
    const sent: string[] = []
    ws.attachSocket(
      ws.registerConnection({
        userId: 1,
        clientIp: '127.0.0.1',
        userAgent: 'vitest',
      }),
      {
        send: (data: string) => sent.push(data),
        close: () => {},
      }
    )

    const connId = ws.registerConnection({
      userId: 2,
      clientIp: '127.0.0.2',
      userAgent: 'vitest',
    })
    ws.attachSocket(connId, {
      send: (data: string) => sent.push(data),
      close: () => {},
    })

    ws.broadcast({ type: 'all' })
    ws.sendToUser(1, { type: 'user' })
    ws.sendToConnection(connId, { type: 'conn' })
    ws.updateConnection(connId, { last_pong_at: '2024-01-01T00:00:00.000Z' })

    expect(ws.listConnections()).toHaveLength(2)
    expect(ws.listConnections()[1].last_pong_at).toBe('2024-01-01T00:00:00.000Z')
    expect(sent).toContain(JSON.stringify({ type: 'all' }))
    expect(sent).toContain(JSON.stringify({ type: 'user' }))
    expect(sent).toContain(JSON.stringify({ type: 'conn' }))

    ws.removeConnection(connId)
    expect(ws.listConnections()).toHaveLength(1)
  })
})

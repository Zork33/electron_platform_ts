import type { WsConnectionInfo } from './types.js'
import { nowIso } from './time.js'

export interface WsSocketHandle {
  send: (data: string) => void
  close: () => void
}

export class WebSocketService {
  readonly connections = new Map<number, WsConnectionInfo>()
  readonly sockets = new Map<number, WsSocketHandle>()
  private nextConnId = 1
  constructor(private readonly deps: { onChange?: () => void } = {}) {}

  reset(): void {
    this.connections.clear()
    this.sockets.clear()
    this.nextConnId = 1
    this.deps.onChange?.()
  }

  listConnections(): WsConnectionInfo[] {
    return [...this.connections.values()].sort((a, b) => a.conn_id - b.conn_id)
  }

  registerConnection(meta: {
    userId: number
    clientIp: string | null
    userAgent: string | null
  }): number {
    const connId = this.nextConnId++
    this.connections.set(connId, {
      conn_id: connId,
      user_id: meta.userId,
      connected_at: nowIso(),
      client_ip: meta.clientIp,
      user_agent: meta.userAgent,
      last_ping_at: nowIso(),
      last_pong_at: nowIso(),
    })
    this.deps.onChange?.()
    return connId
  }

  updateConnection(connId: number, patch: Partial<WsConnectionInfo>): void {
    const current = this.connections.get(connId)
    if (!current) return
    this.connections.set(connId, { ...current, ...patch })
    this.deps.onChange?.()
  }

  removeConnection(connId: number): void {
    this.connections.delete(connId)
    this.sockets.delete(connId)
    this.deps.onChange?.()
  }

  attachSocket(connId: number, socket: WsSocketHandle): void {
    this.sockets.set(connId, socket)
  }

  forEachSocket(callback: (connId: number, socket: WsSocketHandle) => void): void {
    for (const [connId, socket] of this.sockets.entries()) {
      callback(connId, socket)
    }
  }

  broadcast(payload: unknown): void {
    const data = JSON.stringify(payload)
    for (const socket of this.sockets.values()) {
      socket.send(data)
    }
  }

  sendToUser(userId: number, payload: unknown): void {
    const data = JSON.stringify(payload)
    for (const [connId, meta] of this.connections.entries()) {
      if (meta.user_id === userId) {
        this.sockets.get(connId)?.send(data)
      }
    }
  }

  sendToConnection(connId: number, payload: unknown): void {
    const data = JSON.stringify(payload)
    this.sockets.get(connId)?.send(data)
  }

  snapshot(): WsConnectionInfo[] {
    return this.listConnections().map((connection) => ({ ...connection }))
  }

  hydrate(connections: WsConnectionInfo[]): void {
    this.connections.clear()
    this.sockets.clear()
    this.nextConnId = 1
    for (const connection of connections) {
      this.connections.set(connection.conn_id, { ...connection })
      this.nextConnId = Math.max(this.nextConnId, connection.conn_id + 1)
    }
  }
}

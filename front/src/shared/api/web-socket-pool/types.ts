export interface WsConnection {
  conn_id: number
  user_id: number
  connected_at: string | null
  client_ip: string | null
  user_agent: string | null
  last_ping_at: string | null
  last_pong_at: string | null
}

export interface WsPoolInfo {
  total_users: number
  total_connections: number
  ping_interval: number
  ping_timeout: number
  connections: WsConnection[]
}

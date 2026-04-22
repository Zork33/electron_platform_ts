import { BaseApiClient } from '../base'
import type { WsPoolInfo } from './types'
import { devApi } from '@/boot/axios'

class WsPoolApiClient extends BaseApiClient {
  private readonly baseUrl = '/dev-api/web-socket'

  constructor() {
    super(devApi)
  }

  async getPoolInfo(): Promise<WsPoolInfo> {
    return this.get<WsPoolInfo>(`${this.baseUrl}/pool`)
  }

  async sendAll(message: string): Promise<void> {
    await this.post(`${this.baseUrl}/send-all`, { message })
  }

  async sendToUser(userId: number, message: string): Promise<void> {
    await this.post(`${this.baseUrl}/send-user/${userId}`, { message })
  }

  async sendToConnection(connId: number, message: string): Promise<void> {
    await this.post(`${this.baseUrl}/send-connection/${connId}`, { message })
  }
}

export const wsPoolApi = new WsPoolApiClient()

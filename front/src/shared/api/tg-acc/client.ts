/**
 * TgAcc API клиент
 */
import { BaseCrudClient } from '../base'
import type { TgAcc, CreateTgAccRequest, UpdateTgAccRequest } from './types'
import { api } from '@/boot/axios'

class TgAccApiClient extends BaseCrudClient<TgAcc, CreateTgAccRequest, UpdateTgAccRequest> {
  constructor() {
    super(api, '/tg-acc')
  }
}

export const tgAccApi = new TgAccApiClient()

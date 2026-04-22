/**
 * WebLink API клиент
 */
import { BaseCrudClient } from '../base'
import type { WebLink, CreateWebLinkRequest, UpdateWebLinkRequest } from './types'
import { api } from '@/boot/axios'

class WebLinkApiClient extends BaseCrudClient<WebLink, CreateWebLinkRequest, UpdateWebLinkRequest> {
  constructor() {
    super(api, '/web-link')
  }
}

export const webLinkApi = new WebLinkApiClient()

/**
 * Email API клиент
 */
import { BaseCrudClient } from '../base'
import type { Email, CreateEmailRequest, UpdateEmailRequest } from './types'
import { api } from '@/boot/axios'

class EmailApiClient extends BaseCrudClient<Email, CreateEmailRequest, UpdateEmailRequest> {
  constructor() {
    super(api, '/email')
  }
}

export const emailApi = new EmailApiClient()

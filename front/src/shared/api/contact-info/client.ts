/**
 * ContactInfo API клиент
 */
import { BaseCrudClient } from '../base'
import type { ContactInfo, CreateContactInfoRequest, UpdateContactInfoRequest } from './types'
import { api } from '@/boot/axios'

class ContactInfoApiClient extends BaseCrudClient<ContactInfo, CreateContactInfoRequest, UpdateContactInfoRequest> {
  constructor() {
    super(api, '/contact-info')
  }
}

export const contactInfoApi = new ContactInfoApiClient()

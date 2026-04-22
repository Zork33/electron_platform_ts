/**
 * PhoneNumber API клиент
 */
import { BaseCrudClient } from '../base'
import type { PhoneNumber, CreatePhoneNumberRequest, UpdatePhoneNumberRequest } from './types'
import { api } from '@/boot/axios'

class PhoneNumberApiClient extends BaseCrudClient<PhoneNumber, CreatePhoneNumberRequest, UpdatePhoneNumberRequest> {
  constructor() {
    super(api, '/phone-number')
  }
}

export const phoneNumberApi = new PhoneNumberApiClient()

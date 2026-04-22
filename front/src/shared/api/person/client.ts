/**
 * Person API клиент
 */
import { BaseCrudClient } from '../base'
import type { Person, CreatePersonRequest, UpdatePersonRequest, PersonVectorSearchResult } from './types'
import { devApi } from '@/boot/axios'

class PersonApiClient extends BaseCrudClient<Person, CreatePersonRequest, UpdatePersonRequest> {
  constructor() {
    super(devApi, '/user-api/person')
  }

  async vectorSearch(query: string, limit = 10): Promise<PersonVectorSearchResult[]> {
    return this.post<PersonVectorSearchResult[]>(`${this.baseUrl}/vector_search`, { query, limit })
  }
}

export const personApi = new PersonApiClient()

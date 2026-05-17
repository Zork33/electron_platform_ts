import { describe, expect, test } from 'vitest'
import { CollectionCrudApiService } from '../src/crud-api-service.js'
import { CrudCollection } from '../src/record-collection.js'
import type { Email } from '../src/types.js'

describe('crud api service', () => {
  test('proxies collection operations', () => {
    const emails = new CrudCollection<Email>(() => ({
      address: '',
    }))
    const service = new CollectionCrudApiService(emails)

    const created = service.create({ address: 'demo@example.com' })
    expect(service.list()).toHaveLength(1)
    expect(service.get(created.id)?.address).toBe('demo@example.com')
    expect(service.patch(created.id, { address: 'updated@example.com' })?.address).toBe('updated@example.com')
    expect(service.softDelete(created.id)?.deleted_at).not.toBeNull()
    expect(service.restore(created.id)?.deleted_at).toBeNull()
  })
})

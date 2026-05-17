import type { CrudCollection } from './record-collection.js'
import type { BaseRecord } from './types.js'

export interface CrudApiService<T extends BaseRecord> {
  list(includeDeleted?: boolean): T[]
  get(id: number): T | null
  create(data: Partial<T>): T
  patch(id: number, data: Partial<T>): T | null
  softDelete(id: number): T | null
  restore(id: number): T | null
}

export class CollectionCrudApiService<T extends BaseRecord> implements CrudApiService<T> {
  constructor(private readonly collection: CrudCollection<T>) {}

  list(includeDeleted = false): T[] {
    return this.collection.list(includeDeleted)
  }

  get(id: number): T | null {
    return this.collection.get(id)
  }

  create(data: Partial<T>): T {
    return this.collection.create(data)
  }

  patch(id: number, data: Partial<T>): T | null {
    return this.collection.patch(id, data)
  }

  softDelete(id: number): T | null {
    return this.collection.softDelete(id)
  }

  restore(id: number): T | null {
    return this.collection.restore(id)
  }
}

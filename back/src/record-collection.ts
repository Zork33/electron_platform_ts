import { nowIso } from './time.js'

export class CrudCollection<T extends { id: number; created_at: string; updated_at: string; deleted_at: string | null }> {
  private items = new Map<number, T>()
  private nextId = 1

  constructor(
    private readonly makeDefaults: () => Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
    private readonly onChange?: () => void
  ) {}

  list(includeDeleted = false): T[] {
    return [...this.items.values()]
      .filter((item) => includeDeleted || item.deleted_at === null)
      .sort((a, b) => a.id - b.id)
  }

  all(): T[] {
    return this.list(true)
  }

  get(id: number): T | null {
    return this.items.get(id) ?? null
  }

  create(data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): T {
    const record = {
      ...this.makeDefaults(),
      ...data,
      id: this.nextId++,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
    } as T
    this.items.set(record.id, record)
    this.onChange?.()
    return record
  }

  patch(id: number, data: Partial<T>): T | null {
    const current = this.items.get(id)
    if (!current) return null
    const updated = {
      ...current,
      ...data,
      id: current.id,
      created_at: current.created_at,
      updated_at: nowIso(),
    } as T
    this.items.set(id, updated)
    this.onChange?.()
    return updated
  }

  softDelete(id: number): T | null {
    return this.patch(id, { deleted_at: nowIso() } as Partial<T>)
  }

  restore(id: number): T | null {
    return this.patch(id, { deleted_at: null } as Partial<T>)
  }

  remove(id: number): T | null {
    const item = this.items.get(id) ?? null
    if (!item) return null
    this.items.delete(id)
    this.onChange?.()
    return item
  }

  clear(): void {
    this.items.clear()
    this.nextId = 1
    this.onChange?.()
  }

  snapshot(): T[] {
    return this.list(true).map((item) => ({ ...item }))
  }

  hydrate(items: T[]): void {
    this.items.clear()
    this.nextId = 1
    for (const item of items) {
      this.items.set(item.id, { ...item })
      this.nextId = Math.max(this.nextId, item.id + 1)
    }
    this.onChange?.()
  }
}

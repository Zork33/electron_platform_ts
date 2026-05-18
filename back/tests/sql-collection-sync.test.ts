import { describe, expect, test } from 'vitest'
import type { QueryResult } from 'pg'
import { SqlCollectionSyncGroup, type SqlCollectionDefinition } from '../src/sql-collection-sync.js'
import type { Email } from '../src/types.js'
import type { QueryRunner } from '../src/domain-table-sync.js'

class FakeRunner implements QueryRunner {
  readonly queries: Array<{ sql: string; params?: unknown[] }> = []

  constructor(private readonly results: Record<string, unknown[]> = {}) {}

  async query<T extends object = object>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>> {
    this.queries.push({ sql, params: params ? [...params] : undefined })
    const rows = this.results[sql] ?? []
    return { rows: rows as T[] } as QueryResult<T>
  }
}

describe('sql collection sync', () => {
  test('loads and replaces a simple table', async () => {
    const definition: SqlCollectionDefinition<Email, { id: number; address: string; created_at: string; updated_at: string; deleted_at: string | null }> = {
      tableName: 'email',
      columns: [
        { dbColumn: 'id', value: (record) => record.id },
        { dbColumn: 'address', value: (record) => record.address },
        { dbColumn: 'created_at', value: (record) => record.created_at },
        { dbColumn: 'updated_at', value: (record) => record.updated_at },
        { dbColumn: 'deleted_at', value: (record) => record.deleted_at },
      ],
      fromRow: (row) => ({
        id: row.id,
        address: row.address,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
      }),
    }

    const runner = new FakeRunner({
      'SELECT * FROM "email" ORDER BY id': [
        { id: 1, address: 'demo@example.com', created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-02T00:00:00.000Z', deleted_at: null },
      ],
    })
    const sync = new SqlCollectionSyncGroup(runner).create(definition)

    expect(await sync.loadAll()).toEqual([
      {
        id: 1,
        address: 'demo@example.com',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
        deleted_at: null,
      },
    ])

    await sync.replaceAll([
      {
        id: 2,
        address: 'new@example.com',
        created_at: '2024-01-03T00:00:00.000Z',
        updated_at: '2024-01-04T00:00:00.000Z',
        deleted_at: null,
      },
    ])

    expect(runner.queries.map((entry) => entry.sql)).toEqual([
      'SELECT * FROM "email" ORDER BY id',
      'BEGIN',
      'DELETE FROM "email"',
      'INSERT INTO "email" ("id", "address", "created_at", "updated_at", "deleted_at") VALUES ($1, $2, $3, $4, $5)',
      'SELECT setval(pg_get_serial_sequence($1, \'id\'), COALESCE((SELECT MAX(id) FROM "email"), 0), true)',
      'COMMIT',
    ])
    expect(runner.queries[3].params).toEqual([
      2,
      'new@example.com',
      '2024-01-03T00:00:00.000Z',
      '2024-01-04T00:00:00.000Z',
      null,
    ])
  })
})

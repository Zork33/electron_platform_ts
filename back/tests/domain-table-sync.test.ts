import { describe, expect, test } from 'vitest'
import type { QueryResult } from 'pg'
import { DomainTableSync, type QueryRunner } from '../src/domain-table-sync.js'
import type { Person, User } from '../src/types.js'

class FakeRunner implements QueryRunner {
  readonly queries: Array<{ sql: string; params?: unknown[] }> = []

  constructor(private readonly results: Record<string, unknown[]> = {}) {}

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    this.queries.push({ sql, params })
    const rows = this.results[sql] ?? []
    return { rows: rows as T[] } as QueryResult<T>
  }
}

describe('domain table sync', () => {
  test('loads person and user rows from sql tables', async () => {
    const personRow = {
      id: 7,
      first_name: 'Jane',
      last_name: 'Doe',
      middle_name: null,
      birth_date: '1990-01-02',
      gender_id: null,
      description: 'from db',
      vector_db_record_id: 33,
      is_vector_synced: true,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
      deleted_at: null,
    }
    const userRow = {
      id: 11,
      person_id: 7,
      auth_email: 'jane@example.com',
      has_access: true,
      auth_session_expires_at: '2024-01-10T00:00:00.000Z',
      is_admin: false,
      avatar_id: 21,
      auth_telegram_id: 'tg-1',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
      deleted_at: null,
    }
    const runner = new FakeRunner({
      'SELECT * FROM "person" ORDER BY id': [personRow],
      'SELECT * FROM "user" ORDER BY id': [userRow],
    })

    const sync = new DomainTableSync(runner)
    const state = await sync.load()

    expect(state.persons).toEqual<Person[]>([
      {
        id: 7,
        first_name: 'Jane',
        last_name: 'Doe',
        middle_name: null,
        birth_date: '1990-01-02',
        description: 'from db',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
        deleted_at: null,
      },
    ])
    expect(state.users).toEqual<User[]>([
      {
        id: 11,
        person_id: 7,
        auth_email: 'jane@example.com',
        has_access: true,
        is_admin: false,
        session_expires_at: '2024-01-10T00:00:00.000Z',
        avatar_id: 21,
        auth_telegram_id: 'tg-1',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
        deleted_at: null,
      },
    ])
  })

  test('syncs person and user collections into sql tables', async () => {
    const runner = new FakeRunner()
    const sync = new DomainTableSync(runner)
    const persons: Person[] = [
      {
        id: 1,
        first_name: 'Alexey',
        last_name: 'Zorkaltsev',
        middle_name: null,
        birth_date: null,
        description: 'seed',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
        deleted_at: null,
      },
    ]
    const users: User[] = [
      {
        id: 2,
        person_id: 1,
        auth_email: 'demo@example.com',
        has_access: true,
        is_admin: true,
        session_expires_at: '2024-01-09T00:00:00.000Z',
        avatar_id: null,
        auth_telegram_id: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
        deleted_at: null,
      },
    ]

    await sync.save(persons, users)

    expect(runner.queries.map((entry) => entry.sql)).toEqual([
      'BEGIN',
      'DELETE FROM "person"',
      'INSERT INTO "person" ("id", "first_name", "last_name", "middle_name", "birth_date", "gender_id", "description", "vector_db_record_id", "is_vector_synced", "created_at", "updated_at", "deleted_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      'SELECT setval(pg_get_serial_sequence($1, \'id\'), COALESCE((SELECT MAX(id) FROM "person"), 0), true)',
      'COMMIT',
      'BEGIN',
      'DELETE FROM "user"',
      'INSERT INTO "user" ("id", "person_id", "auth_email", "has_access", "auth_session_expires_at", "is_admin", "avatar_id", "auth_telegram_id", "created_at", "updated_at", "deleted_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      'SELECT setval(pg_get_serial_sequence($1, \'id\'), COALESCE((SELECT MAX(id) FROM "user"), 0), true)',
      'COMMIT',
    ])
    expect(runner.queries[2].params).toEqual([
      1,
      'Alexey',
      'Zorkaltsev',
      null,
      null,
      null,
      'seed',
      null,
      false,
      '2024-01-01T00:00:00.000Z',
      '2024-01-02T00:00:00.000Z',
      null,
    ])
    expect(runner.queries[7].params).toEqual([
      2,
      1,
      'demo@example.com',
      true,
      '2024-01-09T00:00:00.000Z',
      true,
      null,
      null,
      '2024-01-01T00:00:00.000Z',
      '2024-01-02T00:00:00.000Z',
      null,
    ])
  })
})

import { describe, expect, test } from 'vitest'
import type { QueryResult } from 'pg'
import { ConfirmationTokenSync, type ConfirmationTokenDbRow } from '../src/confirmation-sync.js'
import type { QueryRunner } from '../src/domain-table-sync.js'
import type { ConfirmationTokenRecord } from '../src/types.js'

class FakeRunner implements QueryRunner {
  readonly queries: Array<{ sql: string; params?: unknown[] }> = []

  constructor(private readonly results: Record<string, unknown[]> = {}) {}

  async query<T extends object = object>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>> {
    this.queries.push({ sql, params: params ? [...params] : undefined })
    const rows = this.results[sql] ?? []
    return { rows: rows as T[] } as QueryResult<T>
  }
}

describe('confirmation sync', () => {
  test('loads and replaces confirm-code rows', async () => {
    const history: ConfirmationTokenRecord['history'] = [
      { action: 'create', timestamp: '2024-01-01T00:00:00.000Z', ok: true, error_message: null },
      { action: 'send', timestamp: '2024-01-02T00:00:00.000Z', ok: true, error_message: null },
    ]
    const row: ConfirmationTokenDbRow = {
      token: 'token-1',
      user_id: 12,
      confirm_code: '123456',
      expires_at: '2024-01-05T00:00:00.000Z',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
      deleted_at: null,
      auth_email: 'demo@example.com',
      reason_id: 2,
      first_name: 'Demo',
      last_name: 'User',
      middle_name: null,
      sending_at: '2024-01-02T00:00:00.000Z',
      is_sent: true,
      sending_error: null,
      sending_attempts_count: 1,
      verification_at: null,
      is_verified: false,
      verification_error: null,
      verification_attempts_count: 0,
      user_creation_at: null,
      is_user_created: false,
      user_creation_error: null,
      access_token_created_at: null,
      is_access_token_created: false,
      access_token_error: null,
      history,
    }

    const runner = new FakeRunner({
      'SELECT * FROM "user_auth_confirm_code" ORDER BY id': [row],
    })
    const sync = new ConfirmationTokenSync(runner)

    expect(await sync.loadAll()).toEqual([
      expect.objectContaining({
        token: 'token-1',
        kind: 'login',
        auth_email: 'demo@example.com',
        reason_id: 2,
        user_id: 12,
        is_sent: true,
        history,
      }),
    ])

    await sync.replaceAll([
      {
        token: 'token-2',
        kind: 'register',
        auth_email: 'new@example.com',
        reason_id: 1,
        user_id: null,
        first_name: 'New',
        last_name: null,
        middle_name: null,
        confirm_code: '654321',
        expires_at: '2024-01-06T00:00:00.000Z',
        sending_at: null,
        is_sent: false,
        sending_attempts_count: 0,
        sending_error: null,
        verification_at: null,
        is_verified: false,
        verification_attempts_count: 0,
        verification_error: null,
        user_creation_at: null,
        is_user_created: false,
        user_creation_error: null,
        access_token_created_at: null,
        is_access_token_created: false,
        access_token_error: null,
        history: [],
      },
    ])

    expect(runner.queries.map((entry) => entry.sql)).toEqual([
      'SELECT * FROM "user_auth_confirm_code" ORDER BY id',
      'BEGIN',
      'DELETE FROM "user_auth_confirm_code"',
      expect.stringContaining('INSERT INTO "user_auth_confirm_code"'),
      'COMMIT',
    ])
    expect(runner.queries[3].params?.[0]).toBe('token-2')
    expect(runner.queries[3].params?.[5]).toBe(1)
  })
})

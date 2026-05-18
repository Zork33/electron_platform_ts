import type { QueryResultRow } from 'pg'
import type { QueryRunner } from './domain-table-sync.js'
import type { ConfirmationHistoryEntry, ConfirmationTokenRecord } from './types.js'

const quoteIdent = (value: string) => `"${value.replaceAll('"', '""')}"`

const sqlValue = (value: unknown): unknown => value ?? null

const kindFromReasonId = (reasonId: number | null | undefined): ConfirmationTokenRecord['kind'] =>
  reasonId === 2 ? 'login' : 'register'

const reasonIdFromKind = (kind: ConfirmationTokenRecord['kind']): number => (kind === 'login' ? 2 : 1)

export interface ConfirmationTokenDbRow extends QueryResultRow {
  token: string
  user_id: number | null
  confirm_code: string
  expires_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  auth_email: string
  reason_id: number | null
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  sending_at: string | null
  is_sent: boolean | null
  sending_error: string | null
  sending_attempts_count: number
  verification_at: string | null
  is_verified: boolean | null
  verification_error: string | null
  verification_attempts_count: number
  user_creation_at: string | null
  is_user_created: boolean | null
  user_creation_error: string | null
  access_token_created_at: string | null
  is_access_token_created: boolean | null
  access_token_error: string | null
  history: ConfirmationHistoryEntry[] | null
}

export interface ConfirmationTokenSqlDefinition {
  tableName: string
}

export class ConfirmationTokenSync {
  constructor(private readonly db: QueryRunner, private readonly definition: ConfirmationTokenSqlDefinition = { tableName: 'user_auth_confirm_code' }) {}

  async loadAll(): Promise<ConfirmationTokenRecord[]> {
    const result = await this.db.query<ConfirmationTokenDbRow>(`SELECT * FROM ${quoteIdent(this.definition.tableName)} ORDER BY id`)
    return result.rows.map((row) => ({
      token: row.token,
      kind: kindFromReasonId(row.reason_id),
      auth_email: row.auth_email,
      user_id: row.user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      middle_name: row.middle_name,
      reason_id: row.reason_id,
      confirm_code: row.confirm_code,
      expires_at: row.expires_at,
      sending_at: row.sending_at,
      is_sent: row.is_sent ?? false,
      sending_attempts_count: row.sending_attempts_count,
      sending_error: row.sending_error,
      verification_at: row.verification_at,
      is_verified: row.is_verified ?? false,
      verification_attempts_count: row.verification_attempts_count,
      verification_error: row.verification_error,
      user_creation_at: row.user_creation_at,
      is_user_created: row.is_user_created ?? false,
      user_creation_error: row.user_creation_error,
      access_token_created_at: row.access_token_created_at,
      is_access_token_created: row.is_access_token_created ?? false,
      access_token_error: row.access_token_error,
      history: row.history ?? [],
    }))
  }

  async replaceAll(records: ConfirmationTokenRecord[]): Promise<void> {
    await this.db.query('BEGIN')
    try {
      await this.db.query(`DELETE FROM ${quoteIdent(this.definition.tableName)}`)
      for (const record of records) {
        await this.db.query(
          `INSERT INTO ${quoteIdent(this.definition.tableName)} (
            token, user_id, confirm_code, expires_at, auth_email, reason_id, first_name, last_name, middle_name,
            sending_at, is_sent, sending_error, sending_attempts_count, verification_at, is_verified, verification_error,
            verification_attempts_count, user_creation_at, is_user_created, user_creation_error, access_token_created_at,
            is_access_token_created, access_token_error, history
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21,
            $22, $23, $24
          )`,
          [
            record.token,
            record.user_id ?? null,
            record.confirm_code,
            record.expires_at,
            record.auth_email,
            record.reason_id ?? reasonIdFromKind(record.kind),
            record.first_name ?? null,
            record.last_name ?? null,
            record.middle_name ?? null,
            record.sending_at ?? null,
            record.is_sent,
            record.sending_error ?? null,
            record.sending_attempts_count,
            record.verification_at ?? null,
            record.is_verified,
            record.verification_error ?? null,
            record.verification_attempts_count,
            record.user_creation_at ?? null,
            record.is_user_created ?? false,
            record.user_creation_error ?? null,
            record.access_token_created_at ?? null,
            record.is_access_token_created ?? false,
            record.access_token_error ?? null,
            record.history,
          ]
        )
      }
      await this.db.query('COMMIT')
    } catch (error) {
      await this.db.query('ROLLBACK')
      throw error
    }
  }
}

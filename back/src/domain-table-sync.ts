import type { Pool, QueryResult, QueryResultRow } from 'pg'
import type { Person, User } from './types.js'

export interface QueryRunner {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>>
}

const quoteIdent = (value: string) => `"${value.replaceAll('"', '""')}"`

const sqlValue = (value: unknown): unknown => value ?? null

export interface PersonDbRow {
  id: number
  first_name: string
  last_name: string | null
  middle_name: string | null
  birth_date: string | null
  gender_id: number | null
  description: string | null
  vector_db_record_id: number | null
  is_vector_synced: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface UserDbRow {
  id: number
  person_id: number | null
  auth_email: string | null
  has_access: boolean
  auth_session_expires_at: string | null
  is_admin: boolean
  avatar_id: number | null
  auth_telegram_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type ColumnMap<T> = ReadonlyArray<{
  dbColumn: string
  value: (record: T) => unknown
}>

class TableSync<TRecord extends { id: number }, TRow extends { id: number }> {
  constructor(
    private readonly db: QueryRunner,
    private readonly tableName: string,
    private readonly columns: ColumnMap<TRecord>,
    private readonly fromRow: (row: TRow) => TRecord
  ) {}

  async loadAll(): Promise<TRecord[]> {
    const result = await this.db.query<TRow>(`SELECT * FROM ${quoteIdent(this.tableName)} ORDER BY id`)
    return result.rows.map((row) => this.fromRow(row))
  }

  async replaceAll(records: TRecord[]): Promise<void> {
    await this.db.query('BEGIN')
    try {
      await this.db.query(`DELETE FROM ${quoteIdent(this.tableName)}`)
      for (const record of records) {
        const columns = this.columns.map((column) => column.dbColumn)
        const values = this.columns.map((column) => sqlValue(column.value(record)))
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
        await this.db.query(
          `INSERT INTO ${quoteIdent(this.tableName)} (${columns.map(quoteIdent).join(', ')}) VALUES (${placeholders})`,
          values
        )
      }
      await this.db.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${quoteIdent(this.tableName)}), 0), true)`,
        [this.tableName]
      )
      await this.db.query('COMMIT')
    } catch (error) {
      await this.db.query('ROLLBACK')
      throw error
    }
  }
}

const personColumns: ColumnMap<Person> = [
  { dbColumn: 'id', value: (record) => record.id },
  { dbColumn: 'first_name', value: (record) => record.first_name },
  { dbColumn: 'last_name', value: (record) => record.last_name },
  { dbColumn: 'middle_name', value: (record) => record.middle_name },
  { dbColumn: 'birth_date', value: (record) => record.birth_date },
  { dbColumn: 'gender_id', value: () => null },
  { dbColumn: 'description', value: (record) => record.description },
  { dbColumn: 'vector_db_record_id', value: () => null },
  { dbColumn: 'is_vector_synced', value: () => false },
  { dbColumn: 'created_at', value: (record) => record.created_at },
  { dbColumn: 'updated_at', value: (record) => record.updated_at },
  { dbColumn: 'deleted_at', value: (record) => record.deleted_at },
]

const userColumns: ColumnMap<User> = [
  { dbColumn: 'id', value: (record) => record.id },
  { dbColumn: 'person_id', value: (record) => record.person_id },
  { dbColumn: 'auth_email', value: (record) => record.auth_email },
  { dbColumn: 'has_access', value: (record) => record.has_access },
  { dbColumn: 'auth_session_expires_at', value: (record) => record.session_expires_at },
  { dbColumn: 'is_admin', value: (record) => record.is_admin },
  { dbColumn: 'avatar_id', value: (record) => record.avatar_id },
  { dbColumn: 'auth_telegram_id', value: (record) => record.auth_telegram_id },
  { dbColumn: 'created_at', value: (record) => record.created_at },
  { dbColumn: 'updated_at', value: (record) => record.updated_at },
  { dbColumn: 'deleted_at', value: (record) => record.deleted_at },
]

const mapPersonRow = (row: PersonDbRow): Person => ({
  id: row.id,
  first_name: row.first_name,
  last_name: row.last_name,
  middle_name: row.middle_name,
  birth_date: row.birth_date,
  description: row.description,
  created_at: row.created_at,
  updated_at: row.updated_at,
  deleted_at: row.deleted_at,
})

const mapUserRow = (row: UserDbRow): User => ({
  id: row.id,
  person_id: row.person_id,
  auth_email: row.auth_email,
  has_access: row.has_access,
  is_admin: row.is_admin,
  session_expires_at: row.auth_session_expires_at,
  avatar_id: row.avatar_id,
  auth_telegram_id: row.auth_telegram_id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  deleted_at: row.deleted_at,
})

export class DomainTableSync {
  private readonly persons: TableSync<Person, PersonDbRow>
  private readonly users: TableSync<User, UserDbRow>

  constructor(db: QueryRunner | Pool) {
    this.persons = new TableSync<Person, PersonDbRow>(db, 'person', personColumns, mapPersonRow)
    this.users = new TableSync<User, UserDbRow>(db, 'user', userColumns, mapUserRow)
  }

  async load(): Promise<{ persons: Person[]; users: User[] }> {
    const [persons, users] = await Promise.all([this.persons.loadAll(), this.users.loadAll()])
    return { persons, users }
  }

  async save(persons: Person[], users: User[]): Promise<void> {
    await this.persons.replaceAll(persons)
    await this.users.replaceAll(users)
  }
}

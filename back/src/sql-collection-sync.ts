import type { QueryResultRow } from 'pg'
import type { QueryRunner } from './domain-table-sync.js'

const quoteIdent = (value: string) => `"${value.replaceAll('"', '""')}"`

const sqlValue = (value: unknown): unknown => value ?? null

type ColumnMap<T> = ReadonlyArray<{
  dbColumn: string
  value: (record: T) => unknown
}>

export interface SqlCollectionDefinition<TRecord extends { id: number }, TRow extends QueryResultRow> {
  tableName: string
  columns: ColumnMap<TRecord>
  fromRow: (row: TRow) => TRecord
}

class SqlCollectionSync<TRecord extends { id: number }, TRow extends QueryResultRow> {
  constructor(
    private readonly db: QueryRunner,
    private readonly definition: SqlCollectionDefinition<TRecord, TRow>
  ) {}

  async loadAll(): Promise<TRecord[]> {
    const result = await this.db.query<TRow>(`SELECT * FROM ${quoteIdent(this.definition.tableName)} ORDER BY id`)
    return result.rows.map((row) => this.definition.fromRow(row))
  }

  async replaceAll(records: TRecord[]): Promise<void> {
    await this.db.query('BEGIN')
    try {
      await this.db.query(`DELETE FROM ${quoteIdent(this.definition.tableName)}`)
      for (const record of records) {
        const columns = this.definition.columns.map((column) => column.dbColumn)
        const values = this.definition.columns.map((column) => sqlValue(column.value(record)))
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
        await this.db.query(
          `INSERT INTO ${quoteIdent(this.definition.tableName)} (${columns.map(quoteIdent).join(', ')}) VALUES (${placeholders})`,
          values
        )
      }
      await this.db.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${quoteIdent(this.definition.tableName)}), 0), true)`,
        [this.definition.tableName]
      )
      await this.db.query('COMMIT')
    } catch (error) {
      await this.db.query('ROLLBACK')
      throw error
    }
  }
}

export class SqlCollectionSyncGroup {
  constructor(private readonly db: QueryRunner) {}

  create<TRecord extends { id: number }, TRow extends QueryResultRow>(definition: SqlCollectionDefinition<TRecord, TRow>) {
    return new SqlCollectionSync(this.db, definition)
  }
}

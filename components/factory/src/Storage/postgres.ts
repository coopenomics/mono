/**
 * Реализация порта хранилища фабрики на PostgreSQL (шаг 5 фабрики v2).
 * Таблицы создаёт миграция контроллера `CoreFactoryStorage1793204380830`;
 * этой реализацией пользуются контроллер (с его же соединением Kysely),
 * boot стенда и скрипт переноса (своё соединение по параметрам).
 *
 * Правила версий те же, что были в MongoDB: текущая запись — последняя по
 * блоку, при равном блоке последняя по `id`; удаление ставит флаг на все
 * версии. Поля записи лежат в `payload` (jsonb), отбор порта переводится в
 * выражения над ним: равенство — через вхождение jsonb (`@>`), граница по
 * блоку и флаг удаления — по колонкам, образец текста — `~*` над текстовым
 * значением поля. Возвращаемая запись собирается из `payload` и колонок, как
 * отдавала MongoDB (`_id` — текстовый `id` строки).
 */
import { Kysely, PostgresDialect, expressionBuilder, sql } from 'kysely'
import type { Expression, ExpressionBuilder, SqlBool } from 'kysely'
import { Pool } from 'pg'
import type { PoolConfig } from 'pg'
import type { Cooperative } from 'cooptypes'
import type { DocDataRecord, DocumentPage, DocumentWhere, FieldCondition, IFactoryStorage, RecordCollection, StoredDocument, StoredRecord, Where } from './port'

// eslint-disable-next-line ts/no-explicit-any
type Db = Kysely<any>
// eslint-disable-next-line ts/no-explicit-any
type Eb = ExpressionBuilder<any, any>
type Cond = Expression<SqlBool>

const RECORDS = 'factory_records'
const DOCUMENTS = 'factory_documents'
const DOC_DATA = 'factory_doc_private_data'

/** Поля-колонки; всё остальное — внутри payload. */
const COLUMN_FIELDS = new Set(['block_num', 'deleted'])

/**
 * Текстовое значение поля payload по пути через точку: `details.inn` →
 * `payload #>> '{details,inn}'`. Оператор `->>` с таким именем искал бы
 * ключ «details.inn» верхнего уровня и не находил ничего — так поиск по ИНН
 * и ОГРН возвращал пустоту. JSON null и отсутствие поля дают SQL NULL, как
 * отбор `{ поле: null }` в MongoDB.
 */
function payloadText(field: string) {
  return sql`("payload" #>> ${sql.lit(`{${field.split('.').join(',')}}`)})`
}

export class PostgresFactoryStorage implements IFactoryStorage {
  readonly db: Db
  /** Соединение создано здесь — закрываем его в `disconnect`. */
  private readonly ownsConnection: boolean

  /** Готовое соединение Kysely (контроллер) либо параметры пула (boot, скрипты). */
  constructor(dbOrPool: Db | PoolConfig) {
    if (dbOrPool instanceof Kysely) {
      this.db = dbOrPool
      this.ownsConnection = false
    }
    else {
      this.db = new Kysely({ dialect: new PostgresDialect({ pool: new Pool(dbOrPool) }) })
      this.ownsConnection = true
    }
  }

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {
    if (this.ownsConnection)
      await this.db.destroy()
  }

  /** Условие порта → выражение Kysely над строкой `factory_records`. */
  private condition(eb: Eb, where: Where): Cond {
    const parts: Cond[] = []
    for (const [field, raw] of Object.entries(where)) {
      if (raw === undefined) continue
      if (field === '$or') {
        parts.push(eb.or((raw as Where[]).map((w) => this.condition(eb, w))))
        continue
      }
      if (field === '$and') {
        parts.push(eb.and((raw as Where[]).map((w) => this.condition(eb, w))))
        continue
      }
      parts.push(this.fieldCondition(eb, field, raw as FieldCondition))
    }
    return parts.length === 0 ? eb.lit(true) : eb.and(parts)
  }

  private fieldCondition(eb: Eb, field: string, condition: FieldCondition): Cond {
    if (condition === undefined) return eb.lit(true)
    if (COLUMN_FIELDS.has(field)) return this.columnCondition(eb, field, condition)
    if (condition === null) return sql<SqlBool>`${payloadText(field)} IS NULL`
    if (typeof condition === 'object') return this.payloadOperator(field, condition)
    return this.payloadEquals(field, condition)
  }

  /** Колонки `block_num` и `deleted`: сравнение по столбцу. */
  private columnCondition(eb: Eb, field: string, condition: FieldCondition): Cond {
    if (condition !== null && typeof condition === 'object' && '$lte' in condition) return eb(field, '<=', condition.$lte)
    if (condition === null) return eb(field, 'is', null)
    return eb(field, '=', condition as string | number | boolean)
  }

  /** Граница по числу и образец текста над полем payload. */
  private payloadOperator(field: string, condition: { $lte: number } | { $regex: string; $options?: string }): Cond {
    if ('$lte' in condition) return sql<SqlBool>`${payloadText(field)}::numeric <= ${condition.$lte}`
    const op = (condition.$options ?? '').includes('i') ? '~*' : '~'
    return sql<SqlBool>`${payloadText(field)} ${sql.raw(op)} ${condition.$regex}`
  }

  /** Равенство через вхождение jsonb: точный тип значения и вложенные пути. */
  private payloadEquals(field: string, value: string | number | boolean): Cond {
    const nested = field.split('.').reduceRight<unknown>((acc, key) => ({ [key]: acc }), value)
    return sql<SqlBool>`"payload" @> ${JSON.stringify(nested)}::jsonb`
  }

  // eslint-disable-next-line ts/no-explicit-any
  private toRecord<T extends StoredRecord>(row: Record<string, any>): T {
    const record = { ...(row.payload as Record<string, unknown>) } as Record<string, unknown>
    record._id = String(row.id)
    if (row.block_num !== null && row.block_num !== undefined) record.block_num = Number(row.block_num)
    record.deleted = row.deleted
    return record as T
  }

  async findOne<T extends StoredRecord>(collection: RecordCollection, where: Where): Promise<T | null> {
    const row = await this.db
      .selectFrom(RECORDS)
      .selectAll()
      .where('collection', '=', collection)
      .where((eb) => this.condition(eb, where))
      .orderBy('block_num', 'desc')
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirst()
    return row ? this.toRecord<T>(row) : null
  }

  async findLatestPerGroup<T extends StoredRecord>(collection: RecordCollection, where: Where, groupBy: string[], page: number, limit: number): Promise<Cooperative.Document.IGetResponse<T>> {
    // Текущая версия каждой группы: DISTINCT ON по полям группировки в порядке
    // «новее первым», затем страница по той же сортировке.
    const groupExprs = groupBy.map(f => payloadText(f))
    const distinctOn = sql.join(groupExprs, sql`, `)
    const filter = this.condition(expressionBuilder<any, any>(), where) // eslint-disable-line ts/no-explicit-any
    const base = sql`
      SELECT DISTINCT ON (${distinctOn}) *
      FROM "factory_records"
      WHERE "collection" = ${collection} AND ${filter}
      ORDER BY ${distinctOn}, "block_num" DESC NULLS LAST, "id" DESC
    `
    const countRes = await sql<{ total: string }>`SELECT count(*)::text AS total FROM (${base}) AS latest`.execute(this.db)
    const totalResults = Number(countRes.rows[0]?.total ?? 0)
    const rowsRes = await sql<{ id: string; block_num: string | null; deleted: boolean; payload: unknown }>`
      SELECT * FROM (${base}) AS latest
      ORDER BY "block_num" DESC NULLS LAST, "id" DESC
      OFFSET ${(page - 1) * limit} LIMIT ${limit}
    `.execute(this.db)
    return {
      results: rowsRes.rows.map((r) => this.toRecord<T>(r)),
      page,
      limit,
      totalPages: Math.ceil(totalResults / limit),
      totalResults,
    }
  }

  async findAll<T extends StoredRecord>(collection: RecordCollection, where: Where): Promise<T[]> {
    const rows = await this.db
      .selectFrom(RECORDS)
      .selectAll()
      .where('collection', '=', collection)
      .where((eb) => this.condition(eb, where))
      .orderBy('block_num', 'desc')
      .orderBy('id', 'desc')
      .execute()
    return rows.map((r) => this.toRecord<T>(r))
  }

  async insert<T extends StoredRecord>(collection: RecordCollection, record: T): Promise<{ insertedId: string }> {
    const { block_num, deleted, _id: _ignored, _created_at: _ignoredAt, ...payload } = record as StoredRecord & { _id?: unknown; _created_at?: unknown }
    const row = await this.db
      .insertInto(RECORDS)
      .values({
        collection,
        block_num: block_num ?? null,
        deleted: deleted ?? false,
        payload: JSON.stringify(payload),
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    return { insertedId: String(row.id) }
  }

  async updateMany(collection: RecordCollection, where: Where, set: Partial<StoredRecord>): Promise<{ modifiedCount: number }> {
    const { block_num, deleted, ...payloadPatch } = set
    let query = this.db.updateTable(RECORDS).where('collection', '=', collection).where((eb) => this.condition(eb, where))
    const values: Record<string, unknown> = {}
    if (block_num !== undefined) values.block_num = block_num
    if (deleted !== undefined) values.deleted = deleted
    if (Object.keys(payloadPatch).length > 0) values.payload = sql`"payload" || ${JSON.stringify(payloadPatch)}::jsonb`
    if (Object.keys(values).length === 0) return { modifiedCount: 0 }
    query = query.set(values)
    const result = await query.executeTakeFirst()
    return { modifiedCount: Number(result.numUpdatedRows ?? 0) }
  }

  async saveDocument(document: StoredDocument): Promise<void> {
    const binary = Buffer.from(document.binary)
    await this.db
      .insertInto(DOCUMENTS)
      .values({
        hash: document.hash,
        meta_key: document.meta_key,
        registry_id: document.meta.registry_id,
        block_num: document.meta.block_num ?? null,
        full_title: document.full_title ?? null,
        html: document.html,
        meta: JSON.stringify(document.meta),
        binary,
      })
      .onConflict((oc) =>
        oc.columns(['hash', 'meta_key']).doUpdateSet({
          registry_id: document.meta.registry_id,
          block_num: document.meta.block_num ?? null,
          full_title: document.full_title ?? null,
          html: document.html,
          meta: JSON.stringify(document.meta),
          binary,
          updated_at: sql`now()`,
        })
      )
      .execute()
  }

  // eslint-disable-next-line ts/no-explicit-any
  private toDocument(row: Record<string, any>): StoredDocument {
    return {
      hash: row.hash,
      meta_key: row.meta_key,
      full_title: row.full_title ?? '',
      html: row.html,
      meta: row.meta as StoredDocument['meta'],
      binary: new Uint8Array(row.binary),
    }
  }

  async findDocument(where: DocumentWhere): Promise<StoredDocument | null> {
    let query = this.db.selectFrom(DOCUMENTS).selectAll().where('hash', '=', where.hash)
    if (where.meta_key !== undefined) query = query.where('meta_key', '=', where.meta_key)
    if (where.block_num !== undefined) query = query.where('block_num', '=', where.block_num)
    const row = await query.orderBy('id', 'asc').limit(1).executeTakeFirst()
    return row ? this.toDocument(row) : null
  }

  async listDocuments(page: DocumentPage): Promise<Array<Pick<StoredDocument, 'hash' | 'meta' | 'html'>>> {
    let query = this.db.selectFrom(DOCUMENTS).select(['hash', 'meta', 'html'])
    if (page.registry_id !== undefined) query = query.where('registry_id', '=', page.registry_id)
    const rows = await query.orderBy('id', 'asc').offset(page.offset).limit(page.limit).execute()
    return rows.map((r) => ({ hash: r.hash, meta: r.meta as StoredDocument['meta'], html: r.html }))
  }

  async countDocuments(registry_id?: number): Promise<number> {
    let query = this.db.selectFrom(DOCUMENTS).select((eb) => eb.fn.countAll<string>().as('total'))
    if (registry_id !== undefined) query = query.where('registry_id', '=', registry_id)
    const row = await query.executeTakeFirst()
    return Number(row?.total ?? 0)
  }

  async saveDocData(record: DocDataRecord): Promise<void> {
    await this.db
      .insertInto(DOC_DATA)
      .values({ hash: record.hash, registry_id: record.registry_id, payload: JSON.stringify(record.payload) })
      .onConflict((oc) => oc.column('hash').doNothing())
      .execute()
  }

  async getDocData<P = Record<string, unknown>>(hash: string): Promise<P | null> {
    const row = await this.db.selectFrom(DOC_DATA).select('payload').where('hash', '=', hash).executeTakeFirst()
    return row ? (row.payload as P) : null
  }
}

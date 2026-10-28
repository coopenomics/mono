/**
 * Реализация порта хранилища в памяти процесса.
 *
 * Для набора тестов фабрики и локальной разработки без базы: те же правила,
 * что у MongoDB и PostgreSQL, — версии по блоку, последняя вставленная при
 * равном блоке, удаление флагом. Отбор толкуется по подмножеству порта:
 * равенство, `$lte`, `$regex` без учёта регистра, `$or`, `$and`.
 */
import type { Cooperative } from 'cooptypes'
import type { DocDataRecord, DocumentPage, DocumentWhere, FieldCondition, IFactoryStorage, RecordCollection, StoredDocument, StoredRecord, Where } from './port'

interface Row { seq: number, record: StoredRecord }

function valueOf(record: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), record)
}

function matchesField(value: unknown, condition: FieldCondition): boolean {
  if (condition !== null && typeof condition === 'object') {
    if ('$lte' in condition)
      return typeof value === 'number' && value <= condition.$lte
    if ('$regex' in condition)
      return typeof value === 'string' && new RegExp(condition.$regex, condition.$options ?? '').test(value)
  }
  if (condition === undefined)
    return true
  return value === condition
}

export function matchesWhere(record: StoredRecord, where: Where): boolean {
  for (const [field, condition] of Object.entries(where)) {
    if (field === '$or') {
      if (!(condition as Where[]).some(w => matchesWhere(record, w)))
        return false
      continue
    }
    if (field === '$and') {
      if (!(condition as Where[]).every(w => matchesWhere(record, w)))
        return false
      continue
    }
    if (!matchesField(valueOf(record, field), condition as FieldCondition))
      return false
  }
  return true
}

/** От новых к старым: блок по убыванию, при равном — порядок вставки по убыванию. */
function newestFirst(a: Row, b: Row): number {
  const ab = (a.record.block_num as number | undefined) ?? -1
  const bb = (b.record.block_num as number | undefined) ?? -1
  return bb - ab || b.seq - a.seq
}

export class MemoryFactoryStorage implements IFactoryStorage {
  private seq = 0
  private readonly rows = new Map<RecordCollection, Row[]>()
  private readonly documents = new Map<string, StoredDocument>()
  private readonly docOrder: string[] = []
  private readonly docData = new Map<string, DocDataRecord>()

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  /** Полная очистка — для изоляции тестов. */
  clear(): void {
    this.rows.clear()
    this.documents.clear()
    this.docOrder.length = 0
    this.docData.clear()
  }

  private table(collection: RecordCollection): Row[] {
    let rows = this.rows.get(collection)
    if (!rows) {
      rows = []
      this.rows.set(collection, rows)
    }
    return rows
  }

  private select(collection: RecordCollection, where: Where): Row[] {
    return this.table(collection).filter(r => matchesWhere(r.record, where)).sort(newestFirst)
  }

  async findOne<T extends StoredRecord>(collection: RecordCollection, where: Where): Promise<T | null> {
    const row = this.select(collection, where)[0]
    return row ? (structuredClone(row.record) as T) : null
  }

  async findLatestPerGroup<T extends StoredRecord>(collection: RecordCollection, where: Where, groupBy: string[], page: number, limit: number): Promise<Cooperative.Document.IGetResponse<T>> {
    const seen = new Set<string>()
    const latest: StoredRecord[] = []
    for (const row of this.select(collection, where)) {
      const key = JSON.stringify(groupBy.map(f => valueOf(row.record, f)))
      if (seen.has(key))
        continue
      seen.add(key)
      latest.push(row.record)
    }
    const totalResults = latest.length
    const results = latest.slice((page - 1) * limit, page * limit).map(r => structuredClone(r) as T)
    return { results, page, limit, totalPages: Math.ceil(totalResults / limit), totalResults }
  }

  async findAll<T extends StoredRecord>(collection: RecordCollection, where: Where): Promise<T[]> {
    return this.select(collection, where).map(r => structuredClone(r.record) as T)
  }

  async insert<T extends StoredRecord>(collection: RecordCollection, record: T): Promise<{ insertedId: string }> {
    const seq = ++this.seq
    this.table(collection).push({ seq, record: { _id: String(seq), _created_at: new Date(), ...structuredClone(record) } })
    return { insertedId: String(seq) }
  }

  async updateMany(collection: RecordCollection, where: Where, set: Partial<StoredRecord>): Promise<{ modifiedCount: number }> {
    let modifiedCount = 0
    for (const row of this.table(collection)) {
      if (matchesWhere(row.record, where)) {
        Object.assign(row.record, set)
        modifiedCount++
      }
    }
    return { modifiedCount }
  }

  private docKey(hash: string, meta_key: string): string {
    return `${hash}:${meta_key}`
  }

  async saveDocument(document: StoredDocument): Promise<void> {
    const key = this.docKey(document.hash, document.meta_key)
    if (!this.documents.has(key))
      this.docOrder.push(key)
    this.documents.set(key, structuredClone(document))
  }

  async findDocument(where: DocumentWhere): Promise<StoredDocument | null> {
    for (const key of this.docOrder) {
      const doc = this.documents.get(key)!
      if (doc.hash !== where.hash)
        continue
      if (where.meta_key !== undefined && doc.meta_key !== where.meta_key)
        continue
      if (where.block_num !== undefined && doc.meta.block_num !== where.block_num)
        continue
      return structuredClone(doc)
    }
    return null
  }

  async listDocuments(page: DocumentPage): Promise<Array<Pick<StoredDocument, 'hash' | 'meta' | 'html'>>> {
    const all = this.docOrder
      .map(key => this.documents.get(key)!)
      .filter(doc => page.registry_id === undefined || doc.meta.registry_id === page.registry_id)
    return all.slice(page.offset, page.offset + page.limit).map(({ hash, meta, html }) => structuredClone({ hash, meta, html }))
  }

  async countDocuments(registry_id?: number): Promise<number> {
    return this.docOrder
      .map(key => this.documents.get(key)!)
      .filter(doc => registry_id === undefined || doc.meta.registry_id === registry_id)
      .length
  }

  async saveDocData(record: DocDataRecord): Promise<void> {
    if (!this.docData.has(record.hash))
      this.docData.set(record.hash, structuredClone(record))
  }

  async getDocData<P = Record<string, unknown>>(hash: string): Promise<P | null> {
    const record = this.docData.get(hash)
    return record ? (structuredClone(record.payload) as P) : null
  }
}

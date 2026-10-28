/**
 * Реализация порта хранилища на MongoDB — прежнее хранилище фабрики.
 *
 * Живёт до прогона переноса на стенде (решение владельца, 28.10.2026), затем
 * удаляется вместе с выводом MongoDB из развёртывания. Отбор передаётся
 * драйверу как есть: порт описывает подмножество его синтаксиса.
 */
import { MongoClient } from 'mongodb'
import type { Collection, Db, Document, Filter } from 'mongodb'
import type { Cooperative } from 'cooptypes'
import type { DocDataRecord, DocumentPage, DocumentWhere, IFactoryStorage, RecordCollection, StoredDocument, StoredRecord, Where } from './port'

export class MongoFactoryStorage implements IFactoryStorage {
  readonly client: MongoClient
  readonly db: Db

  constructor(uri: string) {
    this.client = new MongoClient(uri)
    const dbName = uri.match(/mongodb:\/\/[^/]+\/([^?]+)/)?.[1]
    if (!dbName)
      throw new Error('Database name must be specified in the URI.')
    this.db = this.client.db(dbName)
  }

  async connect(): Promise<void> {
    await this.client.connect()
  }

  async disconnect(): Promise<void> {
    await this.client.close()
  }

  /** Сырая коллекция — для переноса и набора тестов, не для фабрики. */
  collection<T extends Document>(name: string): Collection<T> {
    return this.db.collection<T>(name)
  }

  async findOne<T extends StoredRecord>(collection: RecordCollection, where: Where): Promise<T | null> {
    // Вторичная сортировка по _id: при равном block_num ObjectId растёт
    // монотонно и детерминированно даёт последнюю вставленную версию.
    const row = await this.db.collection(collection).findOne(where as Filter<Document>, { sort: { block_num: -1, _id: -1 } })
    return (row as T | null) ?? null
  }

  async findLatestPerGroup<T extends StoredRecord>(collection: RecordCollection, where: Where, groupBy: string[], page: number, limit: number): Promise<Cooperative.Document.IGetResponse<T>> {
    const groupId = groupBy.reduce((acc, field) => ({ ...acc, [field]: `$${field}` }), {})
    const pipeline = [
      { $match: where },
      { $sort: { block_num: -1, _id: -1 } },
      { $group: { _id: groupId, doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
    ]
    const col = this.db.collection(collection)
    const total = await col.aggregate([...pipeline, { $count: 'total' }]).toArray()
    const totalResults = total[0]?.total || 0
    const results = await col.aggregate([...pipeline, { $skip: (page - 1) * limit }, { $limit: limit }]).toArray()
    return { results: results as T[], page, limit, totalPages: Math.ceil(totalResults / limit), totalResults }
  }

  async findAll<T extends StoredRecord>(collection: RecordCollection, where: Where): Promise<T[]> {
    const rows = await this.db.collection(collection).find(where as Filter<Document>).sort({ block_num: -1, _id: -1 }).toArray()
    return rows as unknown as T[]
  }

  async insert<T extends StoredRecord>(collection: RecordCollection, record: T): Promise<{ insertedId: string }> {
    const result = await this.db.collection(collection).insertOne({ _created_at: new Date(), ...record })
    return { insertedId: String(result.insertedId) }
  }

  async updateMany(collection: RecordCollection, where: Where, set: Partial<StoredRecord>): Promise<{ modifiedCount: number }> {
    const result = await this.db.collection(collection).updateMany(where as Filter<Document>, { $set: set })
    return { modifiedCount: result.modifiedCount }
  }

  async saveDocument(document: StoredDocument): Promise<void> {
    await this.db.collection('documents').updateOne(
      { hash: document.hash, meta_key: document.meta_key },
      { $set: document },
      { upsert: true },
    )
  }

  async findDocument(where: DocumentWhere): Promise<StoredDocument | null> {
    const filter: Record<string, unknown> = { hash: where.hash }
    if (where.meta_key !== undefined)
      filter.meta_key = where.meta_key
    if (where.block_num !== undefined)
      filter['meta.block_num'] = where.block_num
    const row = await this.db.collection('documents').findOne(filter as Filter<Document>)
    return (row as StoredDocument | null) ?? null
  }

  async listDocuments(page: DocumentPage): Promise<Array<Pick<StoredDocument, 'hash' | 'meta' | 'html'>>> {
    const filter: Record<string, unknown> = {}
    if (page.registry_id !== undefined)
      filter['meta.registry_id'] = page.registry_id
    const rows = await this.db.collection('documents')
      .find(filter as Filter<Document>, { projection: { hash: 1, meta: 1, html: 1 } })
      .sort({ _id: 1 })
      .skip(page.offset)
      .limit(page.limit)
      .toArray()
    return rows as unknown as Array<Pick<StoredDocument, 'hash' | 'meta' | 'html'>>
  }

  async countDocuments(registry_id?: number): Promise<number> {
    const filter: Record<string, unknown> = {}
    if (registry_id !== undefined)
      filter['meta.registry_id'] = registry_id
    return this.db.collection('documents').countDocuments(filter as Filter<Document>)
  }

  async saveDocData(record: DocDataRecord): Promise<void> {
    const col = this.db.collection('doc_private_data')
    await col.createIndex({ hash: 1 }, { unique: true })
    await col.updateOne(
      { hash: record.hash },
      { $setOnInsert: { hash: record.hash, registry_id: record.registry_id, payload: record.payload, _created_at: new Date() } },
      { upsert: true },
    )
  }

  async getDocData<P = Record<string, unknown>>(hash: string): Promise<P | null> {
    const row = await this.db.collection('doc_private_data').findOne({ hash })
    return row ? (row.payload as P) : null
  }
}

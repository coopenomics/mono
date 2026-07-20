import { Buffer } from 'node:buffer'
import type { Collection } from 'mongodb'
import type { MongoDBConnector } from '../Databazor'
import { calculateSha256 } from '../../Utils/calculateSHA'

/**
 * Хранилище приватных данных документа.
 *
 * On-chain в meta попадает только `doc_data_hash` (sha256 от стабильно
 * сериализованного payload). Сам payload (ФИО, паспорт, телефон, госномер
 * и прочие персональные поля экспедитора / подписанта) лежит в этой
 * коллекции отдельно и не публикуется в блокчейн.
 *
 * При генерации документа `DocFactory.generateDocument` сам подгружает
 * payload по `doc_data_hash` и подставляет под зарезервированной
 * переменной `doc_data` в combinedData — шаблон обращается как
 * `{{ doc_data.<field> }}`.
 */

export interface IDocDataRecord<P = Record<string, unknown>> {
  hash: string
  registry_id: number
  payload: P
  _created_at: Date
}

const COLLECTION_NAME = 'doc_private_data'

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object')
    return JSON.stringify(value)

  if (Array.isArray(value))
    return `[${value.map(item => stableStringify(item)).join(',')}]`

  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => {
      const v = (value as Record<string, unknown>)[key]
      return `${JSON.stringify(key)}:${stableStringify(v)}`
    })

  return `{${entries.join(',')}}`
}

export class DocDataService {
  private readonly collection: Collection<IDocDataRecord>
  private indexEnsured = false

  constructor(storage: MongoDBConnector) {
    this.collection = storage.getCollection<IDocDataRecord>(COLLECTION_NAME)
  }

  private async ensureIndex(): Promise<void> {
    if (this.indexEnsured)
      return
    await this.collection.createIndex({ hash: 1 }, { unique: true })
    this.indexEnsured = true
  }

  /**
   * Сохраняет приватный payload и возвращает его hash.
   * Идемпотентно: один и тот же payload даёт один и тот же hash,
   * повторный вызов не создаёт дублей.
   */
  async save<P extends Record<string, unknown>>(
    payload: P,
    registry_id: number,
  ): Promise<{ hash: string }> {
    await this.ensureIndex()

    const serialized = stableStringify(payload)
    const hash = calculateSha256(Buffer.from(serialized, 'utf8'))

    await this.collection.updateOne(
      { hash },
      {
        $setOnInsert: {
          hash,
          registry_id,
          payload,
          _created_at: new Date(),
        },
      },
      { upsert: true },
    )

    return { hash }
  }

  /**
   * Получает приватный payload по хэшу. Возвращает null если запись
   * удалена (документ остаётся верифицируемым по хэшу подписи, но не
   * регенерируется — graceful degradation).
   */
  async get<P = Record<string, unknown>>(hash: string): Promise<P | null> {
    const record = await this.collection.findOne({ hash })
    if (!record)
      return null
    return record.payload as P
  }
}

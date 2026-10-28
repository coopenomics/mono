import { Buffer } from 'node:buffer'
import type { IFactoryStorage } from '../../Storage'
import { calculateSha256 } from '../../Utils/calculateSHA'

export interface IDocDataRecord<P = Record<string, unknown>> {
  hash: string
  registry_id: number
  payload: P
  _created_at: Date
}

/** Ключи по алфавиту на каждом уровне: один и тот же payload даёт один хэш. */
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

/**
 * Приватные данные документа: в цепь публикуется только хэш содержимого
 * (`doc_data_hash`), само содержимое остаётся у узла. Повторное сохранение
 * того же содержимого даёт тот же хэш и ничего не меняет.
 */
export class DocDataService {
  constructor(private readonly storage: IFactoryStorage) {}

  async save<P extends Record<string, unknown>>(payload: P, registry_id: number): Promise<{ hash: string }> {
    const serialized = stableStringify(payload)
    const hash = calculateSha256(Buffer.from(serialized, 'utf8'))
    await this.storage.saveDocData({ hash, registry_id, payload })
    return { hash }
  }

  async get<P = Record<string, unknown>>(hash: string): Promise<P | null> {
    return this.storage.getDocData<P>(hash)
  }
}

/**
 * Ключ версии черновика по meta. Две генерации одного документа в пределах
 * блока совпадали и телом, и block_num, и вторая затирала первую — встречная
 * подпись первой падала «Хэш метаданных не совпадает» (C28-80).
 */
import { describe, expect, it } from 'vitest'
import { documentMetaKey } from '../src'

describe('ключ версии черновика по meta', () => {
  const meta = { registry_id: 327, username: 'ivanov', hash: 'a1', block_num: 100, created_at: '25.09.2026 10:00' }

  it('разные заявки — разные ключи, даже при одном теле и блоке', () => {
    expect(documentMetaKey(meta)).not.toBe(documentMetaKey({ ...meta, hash: 'b2' }))
  })

  it('порядок полей и пустые поля ключ не меняют — транспорт их роняет, база хранит как null', () => {
    const reordered = { created_at: meta.created_at, block_num: 100, hash: 'a1', username: 'ivanov', registry_id: 327, note: null, extra: undefined }
    expect(documentMetaKey(reordered)).toBe(documentMetaKey(meta))
  })

  it('meta строкой и объектом дают один ключ', () => {
    expect(documentMetaKey(JSON.stringify(meta))).toBe(documentMetaKey(meta))
  })
})

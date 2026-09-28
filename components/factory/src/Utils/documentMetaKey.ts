import { createHash } from 'node:crypto'

/** Запись значения с ключами по порядку; отсутствующие и пустые (undefined, null) поля опускаются. */
function stable(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(stable)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key]
      if (v !== undefined && v !== null)
        out[key] = stable(v)
    }
    return out
  }
  return value
}

/**
 * Ключ версии черновика по его meta. Тело документа двух генераций может
 * совпасть (дата впечатана до минуты), совпадает и блок, если генерации
 * попали в один блок, — тогда вторая версия затирала первую, и второй
 * подписант получал чужую meta («Хэш метаданных не совпадает»). Ключ по meta
 * различает такие версии. Пустые поля опускаются: транспорт их роняет, а база
 * хранит как null.
 */
export function documentMetaKey(meta: unknown): string {
  const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta
  return createHash('sha256').update(JSON.stringify(stable(parsed)), 'utf8').digest('hex')
}

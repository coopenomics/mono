// Параллельные запросы с ограничением: сеть — узкое место pull, но заваливать бэкенд нельзя.

/** Предел одновременных запросов к бэкенду в одном шаге pull. */
export const DEFAULT_REQUEST_CONCURRENCY = 6

/**
 * Выполняет `worker` для каждого элемента, держа в полёте не больше `limit` запросов.
 * Результаты возвращаются в порядке входного массива.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  limit: number = DEFAULT_REQUEST_CONCURRENCY,
): Promise<R[]> {
  if (items.length === 0) {
    return []
  }
  const effectiveLimit = Math.max(1, Math.min(limit, items.length))
  const results = Array.from({ length: items.length }) as R[]
  let next = 0

  const runners = Array.from({ length: effectiveLimit }, async () => {
    for (;;) {
      const current = next
      next += 1
      if (current >= items.length) {
        return
      }
      results[current] = await worker(items[current] as T, current)
    }
  })

  await Promise.all(runners)
  return results
}

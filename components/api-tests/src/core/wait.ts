/**
 * Ожидания. Мутация контроллера отвечает уже после того, как узел разобрал её
 * блок (транзакция ждёт свой блок), поэтому после мутаций ждать нечего.
 * Ожидание нужно, когда тест пишет в цепь сам, мимо контроллера: зеркало узла
 * догоняет цепь по ленте индексера, обычно за секунды.
 */

export interface WaitOptions {
  timeoutMs?: number
  intervalMs?: number
  label?: string
}

/** Опрашивает, пока проверка не вернёт значение (не null/undefined). */
export async function waitFor<T>(probe: () => Promise<T | null | undefined>, opts: WaitOptions = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 60_000
  const intervalMs = opts.intervalMs ?? 500
  const deadline = Date.now() + timeoutMs
  let last: unknown
  while (Date.now() < deadline) {
    try {
      const v = await probe()
      if (v !== null && v !== undefined)
        return v
    }
    catch (e) {
      last = e
    }
    // timing: backoff — зеркало узла догоняет запись в цепь мимо контроллера
    await new Promise(r => setTimeout(r, intervalMs))
  }
  const why = last ? `; последняя ошибка: ${String((last as any)?.message ?? last).slice(0, 300)}` : ''
  throw new Error(`не дождались «${opts.label ?? 'условия'}» за ${timeoutMs} мс${why}`)
}

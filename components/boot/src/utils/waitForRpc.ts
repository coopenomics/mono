import { sleep } from './index'

/**
 * Ждёт готовности RPC ноды. Возвращает `true`, если нода ответила до
 * истечения таймаута.
 *
 * Нужен всем командам, которые запускаются сразу после подъёма ноды или
 * деплоя контрактов: RPC поднимается не мгновенно, а падать на первой же
 * секунде — значит требовать ручного перезапуска шага деплоя.
 */
export async function waitForRpc(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/v1/chain/get_info`, {
        signal: AbortSignal.timeout(2000),
      } as RequestInit)

      if (response.ok)
        return true
    }
    catch {
      // RPC ещё не готов — пробуем снова
    }

    await sleep(1000)
  }

  return false
}

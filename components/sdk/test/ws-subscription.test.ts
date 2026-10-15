import { describe, expect, it, vi } from 'vitest'

// Подменяем graphql-ws: один общий клиент, как в приложении, с ручным
// управлением событиями «сокет открыт» и исходом операции.
const sinks: Array<{ next: (v: unknown) => void, error: (e: unknown) => void, complete: () => void }> = []
const openedListeners = new Set<() => void>()
vi.mock('graphql-ws', () => ({
  createClient: () => ({
    subscribe: (_payload: unknown, sink: any) => {
      sinks.push(sink)
      return () => undefined
    },
    on: (event: string, listener: () => void) => {
      if (event === 'opened')
        openedListeners.add(listener)
      return () => openedListeners.delete(listener)
    },
    dispose: () => undefined,
  }),
}))

const { wsSubscription } = await import('../src/utils/wsSubscription')

function openSocket(): void {
  openedListeners.forEach(listener => listener())
}

describe('wsSubscription — жива ли операция подписки', () => {
  it('живая операция узнаёт о (пере)открытии сокета и считается активной', () => {
    const api = wsSubscription('ws://node/graphql')
    const handle = api('subscription')({ walletEvents: [{ input: { coopname: 'voskhod' } }, { username: true }] } as any)
    const opened = vi.fn()
    handle.open(opened)

    openSocket()
    expect(opened).toHaveBeenCalledTimes(1)
    expect(handle.isActive()).toBe(true)
  })

  it('после ошибки операция мертва навсегда: чужое открытие сокета её не оживляет', () => {
    const api = wsSubscription('ws://node/graphql')
    const wallet = api('subscription')({ walletEvents: [{ input: { coopname: 'voskhod' } }, { username: true }] } as any)
    const opened = vi.fn()
    wallet.open(opened)

    sinks.at(-1)!.error(new Error('4403: Forbidden'))
    openSocket() // сокет открыла другая подписка
    expect(wallet.isActive()).toBe(false)
    expect(opened).not.toHaveBeenCalled()
  })

  it('завершённая сервером операция тоже мертва', () => {
    const api = wsSubscription('ws://node/graphql')
    const handle = api('subscription')({ walletEvents: [{ input: { coopname: 'voskhod' } }, { username: true }] } as any)
    sinks.at(-1)!.complete()
    expect(handle.isActive()).toBe(false)
  })
})

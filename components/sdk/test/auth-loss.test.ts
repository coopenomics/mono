import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client, Queries } from '../src'

/**
 * Потеря доступа и чей токен уходит с запросом.
 *
 * Случай 16.10.2026 (стенд 5): узел пересоздан, а браузер хранит токен CoopID
 * пайщика прежней базы. Сервер отвечал «Пользователь с указанным JWT не найден»
 * (`AUTH_JWT_USER_NOT_FOUND`), SDK этого потерей доступа не считал — кабинет падал
 * по кругу. Регистрация нового пайщика выставляла свой токен, но провайдер CoopID
 * писал старый поверх него, и первое же чтение аккаунта уходило от чужого имени.
 */
describe('потеря доступа и источник bearer', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  function makeClient() {
    return Client.create({
      api_url: 'http://sdk-test.local/v1/graphql',
      chain_url: 'http://sdk-test.local/chain',
      chain_id: '',
    })
  }

  function respondWith(body: unknown) {
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) }),
    )
  }

  function refusal(code: string, message = 'отказ') {
    return { errors: [{ message, extensions: { code, status: 401 } }] }
  }

  function lastAuthHeader(): string | undefined {
    const init = fetchMock.mock.calls.at(-1)?.[1] as { headers?: Record<string, string> } | undefined
    return init?.headers?.Authorization
  }

  async function query(client: Client) {
    return client.Query(Queries.System.GetSystemInfo.query).catch(() => undefined)
  }

  beforeEach(() => {
    fetchMock = vi.fn()
    respondWith({ data: {} })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('«пользователь не найден» по ручному токену → потеря доступа, источник token', async () => {
    respondWith(refusal('AUTH_JWT_USER_NOT_FOUND'))
    const client = makeClient()
    client.setToken('LEGACY')
    const onLost = vi.fn()
    client.setAuthLostHandler(onLost)

    await query(client)

    expect(onLost).toHaveBeenCalledWith({ source: 'token' })
  })

  it('«пользователь не найден» по токену CoopID → источник session', async () => {
    respondWith(refusal('AUTH_JWT_USER_NOT_FOUND'))
    const client = makeClient()
    client.setToken('LEGACY')
    client.setAccessTokenProvider(() => Promise.resolve('COOPID'))
    const onLost = vi.fn()
    client.setAuthLostHandler(onLost)

    await query(client)

    expect(onLost).toHaveBeenCalledWith({ source: 'session' })
  })

  it('завершённая сессия опознаётся по коду, без текста', async () => {
    respondWith(refusal('AUTH_SESSION_TERMINATED', 'Session terminated'))
    const client = makeClient()
    client.setToken('LEGACY')
    const onLost = vi.fn()
    client.setAuthLostHandler(onLost)

    await query(client)

    expect(onLost).toHaveBeenCalledTimes(1)
  })

  it('гость с тем же отказом потерей доступа не считается', async () => {
    respondWith(refusal('AUTH_JWT_USER_NOT_FOUND'))
    const client = makeClient()
    const onLost = vi.fn()
    client.setAuthLostHandler(onLost)

    await query(client)

    expect(onLost).not.toHaveBeenCalled()
  })

  it('чужой отказ с токеном потерей доступа не считается', async () => {
    respondWith(refusal('EDUBRIDGE_INSUFFICIENT_RIGHTS', 'Недостаточно прав доступа'))
    const client = makeClient()
    client.setToken('LEGACY')
    const onLost = vi.fn()
    client.setAuthLostHandler(onLost)

    await query(client)

    expect(onLost).not.toHaveBeenCalled()
  })

  it('провайдер отдал токен, затем отказал → запрос уходит с ручным токеном, а не с прежним CoopID', async () => {
    const client = makeClient()
    let coopIdAlive = true
    client.setAccessTokenProvider(() =>
      coopIdAlive ? Promise.resolve('STALE_COOPID') : Promise.reject(new Error('WalletLocked')),
    )
    await query(client)
    expect(lastAuthHeader()).toBe('Bearer STALE_COOPID')

    coopIdAlive = false
    client.setToken('REGISTRATION')
    await query(client)

    expect(lastAuthHeader()).toBe('Bearer REGISTRATION')
  })

  it('провайдер отказал, ручного токена нет → запрос уходит без заголовка', async () => {
    const client = makeClient()
    let coopIdAlive = true
    client.setAccessTokenProvider(() =>
      coopIdAlive ? Promise.resolve('STALE_COOPID') : Promise.reject(new Error('WalletLocked')),
    )
    await query(client)

    coopIdAlive = false
    await query(client)

    expect(lastAuthHeader()).toBeUndefined()
  })

  it('отвязка провайдера после его токена → возврат к ручному токену', async () => {
    const client = makeClient()
    client.setToken('LEGACY')
    client.setAccessTokenProvider(() => Promise.resolve('COOPID'))
    await query(client)

    client.setAccessTokenProvider(undefined)
    await query(client)

    expect(lastAuthHeader()).toBe('Bearer LEGACY')
  })
})

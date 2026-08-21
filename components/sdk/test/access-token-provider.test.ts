import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client, Queries } from '../src'

/**
 * Инвариант FR29 (Эпик 11 «CoopID»): уже выданные легаси access-токены продолжают
 * работать до явного логаута — даже после того, как desktop подключил контур CoopID.
 *
 * Механизм живёт в `Client.createThunder` (src/index.ts): перед каждым GraphQL-запросом,
 * если привязан `accessTokenProvider` (его ставит desktop через `getAccessToken` из
 * `@coopenomics/auth`), SDK пытается взять свежий CoopID-токен и положить его в заголовок
 * Authorization. Но если активной CoopID-сессии нет, провайдер БРОСАЕТ (`WalletLocked`) —
 * и тогда SDK обязан отправить запрос с тем bearer, что уже установлен через `setToken`
 * (или `login`): то есть с легаси-токеном. Авторизация при этом не «обнуляется».
 *
 * Так инвариант обеспечивается КОНСТРУКТИВНО (D1, Эпик 7): провайдера можно ставить
 * безусловно — он сам решает, есть ли CoopID-сессия, и при её отсутствии не трогает
 * легаси-заголовок. Это позволяет включить CoopID, не ломая действующих пайщиков.
 *
 * Тест — чистый unit: `fetch` замокан, бэкенд НЕ нужен (в отличие от integration-набора
 * в test/index.test.ts, который ходит в живой узел voskhod и здесь не запускается).
 */
describe('setAccessTokenProvider — паритет легаси-токенов (FR29)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  function makeClient() {
    return Client.create({
      // chain_url должен быть непустым: конструктор Blockchain создаёт APIClient(url),
      // который бросает на пустой строке. Запросов к узлу тест не делает — URL фиктивный.
      api_url: 'http://sdk-test.local/v1/graphql',
      chain_url: 'http://sdk-test.local/chain',
      chain_id: '',
    })
  }

  // Заголовок Authorization, ушедший в последний вызов fetch.
  function lastAuthHeader(): string | undefined {
    const init = fetchMock.mock.calls.at(-1)?.[1] as { headers?: Record<string, string> } | undefined
    return init?.headers?.Authorization
  }

  beforeEach(() => {
    // Минимальный ответ GraphQL; decode scalar'ов null-безопасен (см. traverseResponse).
    fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) }),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('провайдер бросает (нет CoopID-сессии) → остаётся легаси-bearer из setToken', async () => {
    const client = makeClient()
    client.setToken('LEGACY_ACCESS_TOKEN')
    client.setAccessTokenProvider(() => Promise.reject(new Error('WalletLocked')))

    await client.Query(Queries.System.GetSystemInfo.query)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(lastAuthHeader()).toBe('Bearer LEGACY_ACCESS_TOKEN')
  })

  it('провайдер отдаёт CoopID-токен → он перекрывает легаси-bearer', async () => {
    const client = makeClient()
    client.setToken('LEGACY_ACCESS_TOKEN')
    client.setAccessTokenProvider(() => Promise.resolve('COOPID_ACCESS_TOKEN'))

    await client.Query(Queries.System.GetSystemInfo.query)

    expect(lastAuthHeader()).toBe('Bearer COOPID_ACCESS_TOKEN')
  })

  it('провайдер не привязан → используется легаси-bearer (поведение не меняется)', async () => {
    const client = makeClient()
    client.setToken('LEGACY_ACCESS_TOKEN')

    await client.Query(Queries.System.GetSystemInfo.query)

    expect(lastAuthHeader()).toBe('Bearer LEGACY_ACCESS_TOKEN')
  })

  it('отвязка провайдера (undefined) → возврат к легаси-bearer', async () => {
    const client = makeClient()
    client.setToken('LEGACY_ACCESS_TOKEN')
    client.setAccessTokenProvider(() => Promise.resolve('COOPID_ACCESS_TOKEN'))
    client.setAccessTokenProvider(undefined)

    await client.Query(Queries.System.GetSystemInfo.query)

    expect(lastAuthHeader()).toBe('Bearer LEGACY_ACCESS_TOKEN')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client, GraphQLResponseError, Queries } from '../src'

/**
 * Форма ошибки, которую SDK отдаёт вызывающему коду при отказе сервера.
 *
 * Раньше `createThunder` бросал сырой `json.errors` (массив) или тело ответа не 2xx
 * (объект либо строку). Без `message` и стека такой отказ в журнале ошибок выглядел
 * как «[object Object]», а `e instanceof Error` его не узнавал. Теперь наружу уходит
 * `GraphQLResponseError`, при этом старая форма сохранена полем `errors` — на неё
 * опираются `extractGraphQLErrorMessages`, `isGraphQLError` и диалог конфликта
 * редакций в desktop.
 *
 * Чистый unit: `fetch` замокан, бэкенд не нужен (интеграционный набор — в index.test.ts).
 */
describe('отказ сервера уходит наружу настоящей ошибкой (GraphQLResponseError)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  function makeClient() {
    return Client.create({
      api_url: 'http://sdk-test.local/v1/graphql',
      chain_url: 'http://sdk-test.local/chain',
      chain_id: '',
    })
  }

  function respond(body: unknown, init: { ok: boolean, status: number }) {
    const text = typeof body === 'string' ? body : JSON.stringify(body)
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: init.ok,
        status: init.status,
        json: () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body),
        text: () => Promise.resolve(text),
      }),
    )
  }

  async function failing(client: Client): Promise<unknown> {
    try {
      await client.Query(Queries.System.GetSystemInfo.query)
    }
    catch (e) {
      return e
    }
    throw new Error('запрос должен был отказать')
  }

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('200 с errors → Error с текстом сервера, исходный массив в errors, код в code', async () => {
    const serverErrors = [
      { message: 'Сессия завершена, требуется повторная авторизация', extensions: { code: 'UNAUTHENTICATED' }, path: ['getSystemInfo'] },
      { message: 'Вторая ошибка' },
    ]
    respond({ errors: serverErrors }, { ok: true, status: 200 })

    const e = await failing(makeClient())

    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(GraphQLResponseError)
    const err = e as GraphQLResponseError
    expect(err.message).toBe('Сессия завершена, требуется повторная авторизация; Вторая ошибка')
    expect(err.errors).toEqual(serverErrors)
    expect(err.code).toBe('UNAUTHENTICATED')
    expect(err.status).toBe(200)
    expect(err.response).toEqual({ errors: serverErrors })
    expect(err.stack).toBeTruthy()
  })

  it('ответ HTTP 400 с GraphQL-конвертом → та же ошибка со статусом ответа', async () => {
    const serverErrors = [{ message: 'Bad Request Exception', extensions: { code: 'BAD_USER_INPUT' } }]
    respond({ errors: serverErrors }, { ok: false, status: 400 })

    const err = (await failing(makeClient())) as GraphQLResponseError

    expect(err).toBeInstanceOf(GraphQLResponseError)
    expect(err.status).toBe(400)
    expect(err.errors).toEqual(serverErrors)
    expect(err.message).toBe('Bad Request Exception')
  })

  it('ответ HTTP 401 REST-конвертом NestJS ({statusCode, message}) → сообщение из message', async () => {
    respond({ statusCode: 401, message: 'Unauthorized' }, { ok: false, status: 401 })

    const err = (await failing(makeClient())) as GraphQLResponseError

    expect(err).toBeInstanceOf(GraphQLResponseError)
    expect(err.message).toBe('Unauthorized')
    expect(err.status).toBe(401)
    expect(err.errors).toEqual([{ message: 'Unauthorized', extensions: { code: 401 } }])
  })

  it('ответ HTTP 502 HTML-страницей от прокси → сообщение без разметки, тело целиком в response', async () => {
    const html = '<html>\n<head><title>502 Bad Gateway</title></head>\n<body><center><h1>502 Bad Gateway</h1></center>\n<hr><center>nginx</center></body></html>'
    respond(html, { ok: false, status: 502 })

    const err = (await failing(makeClient())) as GraphQLResponseError

    expect(err).toBeInstanceOf(GraphQLResponseError)
    expect(err.message).toBe('502 Bad Gateway 502 Bad Gateway nginx')
    expect(err.status).toBe(502)
    expect(err.response).toBe(html)
  })

  it('ответ HTTP 503 с пустым телом → сообщение по статусу, а не пустая строка', async () => {
    respond('', { ok: false, status: 503 })

    const err = (await failing(makeClient())) as GraphQLResponseError

    expect(err.message).toBe('HTTP 503')
    expect(err.errors[0]?.message).toBe('HTTP 503')
  })

  it('потеря сессии по-прежнему доходит до обработчика setAuthLostHandler', async () => {
    respond(
      { errors: [{ message: 'Сессия завершена, требуется повторная авторизация' }] },
      { ok: true, status: 200 },
    )
    const client = makeClient()
    client.setToken('ACCESS')
    const onLost = vi.fn()
    client.setAuthLostHandler(onLost)

    await failing(client)

    expect(onLost).toHaveBeenCalledTimes(1)
  })

  it('успешный ответ не затронут', async () => {
    respond({ data: {} }, { ok: true, status: 200 })

    await expect(makeClient().Query(Queries.System.GetSystemInfo.query)).resolves.toBeDefined()
  })
})

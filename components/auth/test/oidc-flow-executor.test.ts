import { afterEach, describe, expect, it, vi } from 'vitest'
import { authenticateWithFlowExecutor } from '../src/oidc/flow-executor'

const ISSUER = 'https://coop.example/application/o/coopid/'
const FLOW_URL = 'https://coop.example/api/v3/flows/executor/default-authentication-flow/?query='

afterEach(() => vi.unstubAllGlobals())

/** Ответ flow-executor: 200 + тело challenge'а. */
function challenge(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

describe('authenticateWithFlowExecutor (Story 11.2) — встроенный фактор-1 authentik', () => {
  it('раздельные стадии identification → password → redirect: успех, верные URL/тела/credentials', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(challenge({ component: 'ak-stage-identification' })) // GET
      .mockResolvedValueOnce(challenge({ component: 'ak-stage-password' })) // POST email
      .mockResolvedValueOnce(challenge({ type: 'redirect' })) // POST password → завершение
    vi.stubGlobal('fetch', fetchMock)

    await authenticateWithFlowExecutor({ issuer: ISSUER, email: 'user@e.com', password: 'S3cret!' })

    // GET старта flow
    expect(fetchMock.mock.calls[0][0]).toBe(FLOW_URL)
    expect(fetchMock.mock.calls[0][1].method).toBe('GET')
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
    // POST identification — uid_field + password (совмещённая форма безопасна и для раздельной)
    expect(fetchMock.mock.calls[1][1].method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ uid_field: 'user@e.com', password: 'S3cret!' })
    // POST password
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ password: 'S3cret!' })
    expect(fetchMock.mock.calls[2][1].credentials).toBe('include')
  })

  it('совмещённая identification сразу завершает flow (redirect)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(challenge({ component: 'ak-stage-identification' }))
      .mockResolvedValueOnce(challenge({ type: 'redirect' }))
    vi.stubGlobal('fetch', fetchMock)
    await authenticateWithFlowExecutor({ issuer: ISSUER, email: 'u@e.com', password: 'p' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('завершение по стадии ak-stage-user-login (сессия установлена)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(challenge({ component: 'ak-stage-password' }))
      .mockResolvedValueOnce(challenge({ component: 'ak-stage-user-login' }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(authenticateWithFlowExecutor({ issuer: ISSUER, email: 'u@e.com', password: 'p' })).resolves.toBeUndefined()
  })

  it('неверный пароль (response_errors, HTTP 400) → InvalidCredentials с сообщением authentik', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(challenge({ component: 'ak-stage-password' }))
      .mockResolvedValueOnce(challenge({ component: 'ak-stage-password', response_errors: { password: [{ string: 'Неверный пароль', code: 'invalid' }] } }, 400))
    vi.stubGlobal('fetch', fetchMock)
    await expect(authenticateWithFlowExecutor({ issuer: ISSUER, email: 'u@e.com', password: 'bad' }))
      .rejects
      .toMatchObject({ code: 'invalid_credentials', message: 'Неверный пароль' })
  })

  it('ak-stage-access-denied → InvalidCredentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(challenge({ component: 'ak-stage-access-denied' })))
    await expect(authenticateWithFlowExecutor({ issuer: ISSUER, email: 'u@e.com', password: 'p' }))
      .rejects
      .toMatchObject({ code: 'invalid_credentials' })
  })

  it('неподдерживаемая интерактивная стадия (MFA) → InvalidCredentials с её именем', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(challenge({ component: 'ak-stage-password' }))
      .mockResolvedValueOnce(challenge({ component: 'ak-stage-authenticator-validate' }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(authenticateWithFlowExecutor({ issuer: ISSUER, email: 'u@e.com', password: 'p' }))
      .rejects
      .toMatchObject({ code: 'invalid_credentials', message: expect.stringContaining('ak-stage-authenticator-validate') })
  })

  it('сеть упала на старте → NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    await expect(authenticateWithFlowExecutor({ issuer: ISSUER, email: 'u@e.com', password: 'p' }))
      .rejects
      .toMatchObject({ code: 'network_error' })
  })

  it('эхо CSRF-cookie уходит в заголовке X-authentik-CSRF (same-origin)', async () => {
    vi.stubGlobal('document', { cookie: 'foo=1; authentik_csrf=tok123; bar=2' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(challenge({ component: 'ak-stage-password' }))
      .mockResolvedValueOnce(challenge({ type: 'redirect' }))
    vi.stubGlobal('fetch', fetchMock)
    await authenticateWithFlowExecutor({ issuer: ISSUER, email: 'u@e.com', password: 'p' })
    expect(fetchMock.mock.calls[0][1].headers['X-authentik-CSRF']).toBe('tok123')
    expect(fetchMock.mock.calls[1][1].headers['X-authentik-CSRF']).toBe('tok123')
  })
})

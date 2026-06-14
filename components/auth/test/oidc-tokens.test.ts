import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthV2Error } from '../src/errors'
import { clearSession, currentTokens, getAccessToken, setSession } from '../src/oidc/tokens'

/** JWT с заданным exp (сек от now); содержимое не важно — getAccessToken читает только exp. */
async function jwtExpIn(seconds: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${seconds}s`)
    .sign(new TextEncoder().encode('t'))
}

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

beforeEach(() => clearSession())
afterEach(() => vi.unstubAllGlobals())

describe('getAccessToken lifecycle (Story 1.7) — токен внутри SDK, авто-refresh', () => {
  it('нет активной сессии → бросает', async () => {
    await expect(getAccessToken()).rejects.toBeInstanceOf(AuthV2Error)
  })

  it('свежий access → возвращается без обращения к сети', async () => {
    const access = await jwtExpIn(3600)
    setSession('https://coop.example', { accessToken: access, refreshToken: 'r' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await getAccessToken()).toBe(access)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('истёкший access → refresh через /coop/refresh, новая пара сохраняется', async () => {
    const expired = await jwtExpIn(-10)
    const fresh = await jwtExpIn(3600)
    setSession('https://coop.example/', { accessToken: expired, refreshToken: 'r-old' })
    const fetchMock = vi.fn().mockResolvedValue(okJson({ access_token: fresh, refresh_token: 'r-new' }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await getAccessToken()).toBe(fresh)
    expect(fetchMock.mock.calls[0][0]).toBe('https://coop.example/coop/refresh')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refresh_token: 'r-old' })
    expect(currentTokens()).toEqual({ accessToken: fresh, refreshToken: 'r-new' })
  })

  it('refresh 401 → SessionBindingExpired (нужен повторный вход)', async () => {
    const expired = await jwtExpIn(-10)
    setSession('https://coop.example', { accessToken: expired, refreshToken: 'r' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }))

    await expect(getAccessToken()).rejects.toMatchObject({ code: 'session_binding_expired' })
  })
})

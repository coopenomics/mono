import type { StorageAdapter } from '../src/wallet'
import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthV2Error } from '../src/errors'
import { clearSession, configureTokenStorage, currentTokens, getAccessToken, restoreSession, setSession } from '../src/oidc/tokens'

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

/** In-memory StorageAdapter для тестов персистентности токенов. */
function memoryStorage(): StorageAdapter & { dump: () => Record<string, string> } {
  const m = new Map<string, string>()
  return {
    get: async k => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    remove: async k => void m.delete(k),
    dump: () => Object.fromEntries(m),
  }
}

beforeEach(() => clearSession())
afterEach(() => {
  vi.unstubAllGlobals()
  configureTokenStorage(null)
  clearSession()
})

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

describe('персистентность токенов (паритет с легаси — переживание reload)', () => {
  it('setSession персистит пару токенов в storage', async () => {
    const storage = memoryStorage()
    const access = await jwtExpIn(3600)
    configureTokenStorage(storage)
    setSession('https://coop.example', { accessToken: access, refreshToken: 'r' })
    expect(JSON.stringify(storage.dump())).toContain(access)
  })

  it('restoreSession поднимает пару после «reload» (RAM пуста, storage цел) — сессия переживает F5', async () => {
    const access = await jwtExpIn(3600)
    // «До reload»: storage с записью, как её оставил setSession в прошлой сессии.
    const storage = memoryStorage()
    await storage.set('coopid.session.tokens', JSON.stringify({ apiBase: 'https://coop.example', tokens: { accessToken: access, refreshToken: 'r' } }))
    // «После reload»: RAM пуста (beforeEach), подключаем storage и восстанавливаем.
    configureTokenStorage(storage)

    expect(await restoreSession()).toBe(true)
    expect(currentTokens()).toEqual({ accessToken: access, refreshToken: 'r' })
    expect(await getAccessToken()).toBe(access) // токен жив без сети
  })

  it('нет персистентной записи → restoreSession=false (нужен вход)', async () => {
    configureTokenStorage(memoryStorage())
    expect(await restoreSession()).toBe(false)
    await expect(getAccessToken()).rejects.toBeInstanceOf(AuthV2Error)
  })

  it('активная RAM-сессия не перетирается restoreSession', async () => {
    const access = await jwtExpIn(3600)
    setSession('https://coop.example', { accessToken: access, refreshToken: 'r' })
    configureTokenStorage(memoryStorage()) // пустой storage
    expect(await restoreSession()).toBe(true) // уже в RAM
    expect(currentTokens()).toEqual({ accessToken: access, refreshToken: 'r' })
  })

  it('refresh обновляет персистентную копию (на диске свежий refresh-токен)', async () => {
    const storage = memoryStorage()
    const expired = await jwtExpIn(-10)
    const fresh = await jwtExpIn(3600)
    configureTokenStorage(storage)
    setSession('https://coop.example', { accessToken: expired, refreshToken: 'r-old' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ access_token: fresh, refresh_token: 'r-new' })))

    expect(await getAccessToken()).toBe(fresh)
    const dump = JSON.stringify(storage.dump())
    expect(dump).toContain('r-new')
    expect(dump).not.toContain('r-old')
  })

  it('clearSession стирает персистентную копию (logout)', async () => {
    const storage = memoryStorage()
    const access = await jwtExpIn(3600)
    configureTokenStorage(storage)
    setSession('https://coop.example', { accessToken: access, refreshToken: 'r' })
    expect(Object.keys(storage.dump())).toHaveLength(1)
    clearSession()
    expect(Object.keys(storage.dump())).toHaveLength(0)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lockWallet = vi.fn()

// keystore-затирание мокаем на уровне модуля wallet — logout обязан вызвать его
// независимо от исхода сетевого запроса.
vi.mock('../src/wallet', () => ({
  lockWallet,
}))

const { logout } = await import('../src/oidc')

describe('logout (Story 1.10)', () => {
  beforeEach(() => {
    lockWallet.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('шлёт POST /coop/logout с refresh/access и затирает keystore', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await logout({ apiUrl: 'https://coop.example/', refreshToken: 'r1', accessToken: 'a1' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://coop.example/coop/logout')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ refresh_token: 'r1', access_token: 'a1' })
    expect(lockWallet).toHaveBeenCalledTimes(1)
  })

  it('затирает keystore ДАЖЕ при недоступности сервера (finally)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(logout({ apiUrl: 'https://coop.example', refreshToken: 'r1' })).resolves.toBeUndefined()
    expect(lockWallet).toHaveBeenCalledTimes(1)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Граница повторного входа (authentik-сессия + on-chain timestamp-handshake) — сетевые
// интеграции; мокаем их, чтобы юнит-тест проверял детерминированный confirm-флоу:
// генерацию пары, AAD vault'а, тело запроса confirm и маппинг ошибок. Крипто vault'а
// и antelope здесь настоящие — round-trip ключа проверяется по-настоящему.
vi.mock('../src/oidc/client', async importActual => ({
  ...(await importActual<typeof import('../src/oidc/client')>()),
  authenticateWithAuthentik: vi.fn().mockResolvedValue({ id_token: 'ID_TOK' }),
}))
vi.mock('../src/oidc/handshake', async importActual => ({
  ...(await importActual<typeof import('../src/oidc/handshake')>()),
  performTimestampHandshake: vi.fn().mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT', participantCertificate: 'CERT', degraded: false }),
}))
vi.mock('../src/wallet', async importActual => ({
  ...(await importActual<typeof import('../src/wallet')>()),
  unlockWallet: vi.fn().mockResolvedValue(undefined),
}))

const { PrivateKey } = await import('@wharfkit/antelope')
const { loginWithMagicLink } = await import('../src/oidc')
const { authenticateWithAuthentik, configureCoopId } = await import('../src/oidc/client')
const { performTimestampHandshake } = await import('../src/oidc/handshake')
const { decryptPrivateKey } = await import('../src/vault/encrypt')
const { unlockWallet } = await import('../src/wallet')

const BASE = 'https://coop.example'
const PARAMS = {
  issuer: 'https://coop.example/application/o/coopid/',
  email: 'ant@example.com',
  account: 'ant',
  token: 'magic-token-xyz',
  totp: '123456',
  newPassword: 'Strong#NewPass1',
}

beforeEach(() => configureCoopId({ apiUrl: BASE }))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('loginWithMagicLink (Story 12.2) — восстановление доступа', () => {
  it('happy: новая пара → корректное тело confirm → vault round-trip → повторный вход', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await loginWithMagicLink(PARAMS)

    // единственный сетевой вызов — confirm (unlock/handshake/authentik замоканы).
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/coop/recovery/confirm`)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.token).toBe(PARAMS.token)
    expect(body.code).toBe(PARAMS.totp)
    expect(body.password).toBe(PARAMS.newPassword)
    expect(body.public_key).toMatch(/^PUB_K1_/)
    expect(body.vault).toMatchObject({ cipher_version: expect.any(String), salt: expect.any(String), ciphertext: expect.any(String) })

    // vault расшифровывается новым паролём под тем же субъектом, и приватный ключ
    // соответствует отправленному public_key — целостность сгенерированной пары.
    const wif = await decryptPrivateKey(body.vault, PARAMS.newPassword, { subject_type: 'participant', subject_id: PARAMS.account })
    expect(PrivateKey.from(wif).toPublic().toString()).toBe(body.public_key)

    // повторный вход новым контуром выполнен; результат собран из user + handshake.
    expect(authenticateWithAuthentik).toHaveBeenCalledWith(expect.objectContaining({ email: PARAMS.email, password: PARAMS.newPassword, issuer: PARAMS.issuer }))
    expect(unlockWallet).toHaveBeenCalledWith({ apiUrl: BASE, account: PARAMS.account, password: PARAMS.newPassword })
    expect(performTimestampHandshake).toHaveBeenCalledWith(BASE)
    expect(result).toEqual({ accessToken: 'AT', idToken: 'ID_TOK', participantCertificate: 'CERT' })
  }, 60000)

  it('неверный TOTP (400 invalid_2fa_code) → проброс; повторный вход не запускается', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'invalid_2fa_code', error_description: 'Неверный код' }) }))

    await expect(loginWithMagicLink(PARAMS)).rejects.toMatchObject({ code: 'invalid_2fa_code' })
    expect(authenticateWithAuthentik).not.toHaveBeenCalled()
    expect(performTimestampHandshake).not.toHaveBeenCalled()
  }, 60000)

  it('недействительный токен (400 invalid_recovery_token) → проброс', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'invalid_recovery_token', error_description: 'Ссылка недействительна' }) }))
    await expect(loginWithMagicLink(PARAMS)).rejects.toMatchObject({ code: 'invalid_recovery_token' })
  }, 60000)

  it('429 → TooManyRecoveryAttempts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }))
    await expect(loginWithMagicLink(PARAMS)).rejects.toMatchObject({ code: 'too_many_recovery_attempts' })
  }, 60000)

  it('сеть упала на confirm → NetworkError; повторный вход не запускается', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    await expect(loginWithMagicLink(PARAMS)).rejects.toMatchObject({ code: 'network_error' })
    expect(authenticateWithAuthentik).not.toHaveBeenCalled()
  }, 60000)

  it('storage задан → локальная копия нового блоба сохранена под account', async () => {
    const store = new Map<string, string>()
    const storage = {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      set: vi.fn(async (k: string, v: string) => { store.set(k, v) }),
      remove: vi.fn(async (k: string) => { store.delete(k) }),
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }))

    await loginWithMagicLink({ ...PARAMS, storage })

    expect(storage.set).toHaveBeenCalledTimes(1)
    const saved = JSON.parse(storage.set.mock.calls[0][1] as string)
    expect(saved.account).toBe(PARAMS.account)
    expect(saved.blob).toMatchObject({ cipher_version: expect.any(String) })
  }, 60000)
})

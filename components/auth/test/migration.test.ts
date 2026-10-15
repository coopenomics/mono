import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canonicalMigrationMessage, migrate } from '../src/migration'
import { configureCoopId } from '../src/oidc/client'
import { decryptPrivateKey } from '../src/vault'

const WIF = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'

beforeEach(() => configureCoopId({ apiUrl: 'https://coop.example' }))
afterEach(() => vi.unstubAllGlobals())

describe('canonicalMigrationMessage (Story 11.4)', () => {
  it('без ротации: pw_hash, purpose, ts — формат старых клиентов не тронут', () => {
    expect(canonicalMigrationMessage({ ts: 'T', pw_hash: 'H' }))
      .toBe('{"pw_hash":"H","purpose":"coopid-key-migration","ts":"T"}')
  })

  it('с ротацией: pk впереди — подпись биндит новый публичный ключ', () => {
    expect(canonicalMigrationMessage({ ts: 'T', pw_hash: 'H', pk: 'P' }))
      .toBe('{"pk":"P","purpose":"coopid-key-migration","pw_hash":"H","ts":"T"}')
  })
})

describe('migrate (Story 11.4) — «ключ → пароль»', () => {
  it('невалидный WIF → InvalidCredentials, без сетевого запроса', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(migrate({ email: 'a@e.com', privateKey: 'not-a-key', newPassword: 'Strong#Pass1' }))
      .rejects
      .toMatchObject({ code: 'invalid_credentials' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ошибка сервера (400 weak_password) пробрасывается; vault не сохраняется', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'weak_password', error_description: 'Пароль слишком короткий' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(migrate({ email: 'a@e.com', privateKey: WIF, newPassword: 'weakweak' }))
      .rejects
      .toMatchObject({ code: 'weak_password' })
    // только POST /coop/migration, без POST /coop/vault
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://coop.example/coop/migration')
  }, 60000)

  it('happy path (ротация по умолчанию): один POST /coop/migration с new_public_key и vault-блобом нового ключа', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ username: 'ant', rotated: true }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await migrate({ email: 'a@e.com', privateKey: WIF, newPassword: 'Strong#Pass1' })

    expect(result.username).toBe('ant')
    expect(result.rotated).toBe(true)
    // Новый ключ сгенерирован и НЕ равен старому.
    expect(result.privateKey).toMatch(/^5/)
    expect(result.privateKey).not.toBe(WIF)

    // Единственный запрос — миграция; отдельного POST /coop/vault нет (блоб в теле).
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://coop.example/coop/migration')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.email).toBe('a@e.com')
    expect(body.new_password).toBe('Strong#Pass1')
    expect(typeof body.timestamp).toBe('string')
    expect(body.signature).toMatch(/^SIG_/)
    expect(typeof body.new_public_key).toBe('string')
    expect(body.new_public_key.length).toBeGreaterThan(0)

    // Блоб расшифровывается паролем и содержит ровно тот WIF, что вернул migrate.
    const decrypted = await decryptPrivateKey(body.vault, 'Strong#Pass1', { subject_type: 'participant', subject_id: 'ant' })
    expect(decrypted).toBe(result.privateKey)
  }, 120000)

  it('сервер не подтвердил ротацию (rotated отсутствует) → ошибка, рассинхрон vault/цепи не допускается', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ username: 'ant' }) })
    vi.stubGlobal('fetch', fetchMock)
    await expect(migrate({ email: 'a@e.com', privateKey: WIF, newPassword: 'Strong#Pass1' }))
      .rejects
      .toMatchObject({ code: 'chain_verification_failed' })
  }, 120000)

  it('rotation_unavailable (кандидат) → прозрачный повтор без ротации с ТЕКУЩИМ ключом', async () => {
    const fetchMock = vi.fn()
      // 1-я попытка (с ротацией) — отказ кандидату
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'rotation_unavailable', error_description: 'после регистрации' }) })
      // 2-я попытка (без ротации) — успех, блоб сервер сохранил из тела
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ username: 'newbie', rotated: false }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await migrate({ email: 'n@e.com', privateKey: WIF, newPassword: 'Strong#Pass1' })

    expect(result).toEqual({ username: 'newbie', rotated: false, privateKey: WIF })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const second = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(second.new_public_key).toBeUndefined()
    expect(await decryptPrivateKey(second.vault, 'Strong#Pass1', { subject_type: 'participant', subject_id: '' })).toBe(WIF)
  }, 120000)

  it('rotate: false (регистрация): один POST /coop/migration, в теле блоб ТЕКУЩЕГО ключа', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ username: 'ant', rotated: false }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await migrate({ email: 'a@e.com', privateKey: WIF, newPassword: 'Strong#Pass1', rotate: false })

    expect(result).toEqual({ username: 'ant', rotated: false, privateKey: WIF })
    // Единственный запрос — миграция: отдельной записи vault больше нет.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://coop.example/coop/migration')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.new_public_key).toBeUndefined()
    expect(await decryptPrivateKey(body.vault, 'Strong#Pass1', { subject_type: 'participant', subject_id: 'ant' })).toBe(WIF)
  }, 120000)
})

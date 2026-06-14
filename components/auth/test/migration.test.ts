import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canonicalMigrationMessage, migrate } from '../src/migration'
import { configureCoopId } from '../src/oidc/client'

const WIF = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'

beforeEach(() => configureCoopId({ apiUrl: 'https://coop.example' }))
afterEach(() => vi.unstubAllGlobals())

describe('canonicalMigrationMessage (Story 11.4)', () => {
  it('фиксированный алфавитный порядок ключей: pw_hash, purpose, ts', () => {
    expect(canonicalMigrationMessage({ ts: 'T', pw_hash: 'H' }))
      .toBe('{"pw_hash":"H","purpose":"coopid-key-migration","ts":"T"}')
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
  })

  it('happy path: POST /coop/migration → username, затем saveToVault (POST /coop/vault)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ username: 'ant' }) }) // migration
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) }) // vault store
    vi.stubGlobal('fetch', fetchMock)

    const result = await migrate({ email: 'a@e.com', privateKey: WIF, newPassword: 'Strong#Pass1' })

    expect(result).toEqual({ username: 'ant' })
    // 1) запрос миграции
    expect(fetchMock.mock.calls[0][0]).toBe('https://coop.example/coop/migration')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.email).toBe('a@e.com')
    expect(body.new_password).toBe('Strong#Pass1')
    expect(typeof body.timestamp).toBe('string')
    expect(body.signature).toMatch(/^SIG_/)
    // 2) сохранение vault новым паролём (subject = возвращённый username)
    expect(fetchMock.mock.calls[1][0]).toBe('https://coop.example/coop/vault')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ subject_type: 'participant', subject_id: 'ant' })
  }, 60000)
})

import type { StorageAdapter } from '../src/wallet'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { decryptPrivateKey } from '../src/vault'
import { clearLocalVault, loadLocalVault, saveLocalVault, saveToVault, storeVaultBlob } from '../src/wallet'

const BLOB = {
  cipher_version: 'aes-256-gcm-v1',
  kdf_version: 'argon2id-v1',
  salt: 'c2FsdA',
  nonce: 'bm9uY2U',
  ciphertext: 'Y2lwaGVy',
  auth_tag: 'dGFn',
}

/** In-memory StorageAdapter для теста локальной копии. */
function memStorage(): StorageAdapter & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    get: async k => map.get(k) ?? null,
    set: async (k, v) => void map.set(k, v),
    remove: async k => void map.delete(k),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('storeVaultBlob (Story 11.3) — POST /coop/vault', () => {
  it('шлёт POST с плоскими subject_type/subject_id + полями blob; 201 ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    await storeVaultBlob('https://coop.example', { subject_type: 'participant', subject_id: 'ant' }, BLOB)

    expect(fetchMock.mock.calls[0][0]).toBe('https://coop.example/coop/vault')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ...BLOB, subject_type: 'participant', subject_id: 'ant' })
  })

  it('не-ok ответ → NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }))
    await expect(storeVaultBlob('https://coop.example', { subject_type: 'participant', subject_id: 'ant' }, BLOB))
      .rejects
      .toMatchObject({ code: 'network_error' })
  })

  it('сеть упала → NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    await expect(storeVaultBlob('https://coop.example', { subject_type: 'participant', subject_id: 'ant' }, BLOB))
      .rejects
      .toMatchObject({ code: 'network_error' })
  })
})

describe('локальная копия vault (Story 11.3)', () => {
  it('save → load возвращает blob того же аккаунта', async () => {
    const storage = memStorage()
    await saveLocalVault(storage, 'ant', BLOB)
    expect(await loadLocalVault(storage, 'ant')).toEqual(BLOB)
  })

  it('load для другого аккаунта → null (чужой blob не отдаём)', async () => {
    const storage = memStorage()
    await saveLocalVault(storage, 'ant', BLOB)
    expect(await loadLocalVault(storage, 'someone-else')).toBeNull()
  })

  it('нет записи → null; clear удаляет', async () => {
    const storage = memStorage()
    expect(await loadLocalVault(storage, 'ant')).toBeNull()
    await saveLocalVault(storage, 'ant', BLOB)
    await clearLocalVault(storage)
    expect(await loadLocalVault(storage, 'ant')).toBeNull()
  })
})

describe('saveToVault (Story 11.3) — encrypt → POST → локальная копия', () => {
  it('шифрует ключ паролём, шлёт на сервер и кладёт локально; blob расшифровывается обратно', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const storage = memStorage()
    const wif = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'

    const blob = await saveToVault({ apiUrl: 'https://coop.example', account: 'ant', privateKey: wif, password: 'P@ss', storage })

    // сервер получил blob с субъектом ant
    expect(fetchMock.mock.calls[0][0]).toBe('https://coop.example/coop/vault')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ subject_type: 'participant', subject_id: 'ant', cipher_version: 'aes-256-gcm-v1' })
    // локальная копия сохранена
    expect(await loadLocalVault(storage, 'ant')).toEqual(blob)
    // round-trip: тем же паролём ключ восстанавливается (неверный пароль покрыт wallet.test.ts)
    expect(await decryptPrivateKey(blob, 'P@ss', { subject_type: 'participant', subject_id: 'ant' })).toBe(wif)
  }, 60000)
})

import type { StorageAdapter } from '../src/wallet'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearLocalVault, loadLocalVault, saveLocalVault } from '../src/wallet'

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

import type { StorageAdapter } from '../src/wallet'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AuthV2Error, AuthV2ErrorCode } from '../src/errors'
import {
  clearPinCache,
  DEFAULT_PIN,
  getWallet,
  hasPinCache,
  isWalletUnlocked,
  lockWallet,
  persistPinCache,
  unlockWithPin,
} from '../src/wallet'
import { storeUnlocked } from '../src/wallet/storage'

const KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
const ACCOUNT = 'ant'
const PUB = 'PUB_K1_'

/** In-memory StorageAdapter (в браузере — localStorage/IndexedDB, тут — Map). */
function memoryStorage(): StorageAdapter & { dump: () => Record<string, string> } {
  const m = new Map<string, string>()
  return {
    get: async k => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    remove: async k => void m.delete(k),
    dump: () => Object.fromEntries(m),
  }
}

/** Кладёт ключ в RAM-keystore, как это делает unlockWallet после входа паролём. */
function putUnlocked(): void {
  // publicKey деривуется внутри unlockWallet/unlockWithPin; здесь для setup
  // достаточно любого валидного вида — реальный pub проверяем после unlockWithPin.
  storeUnlocked({ account: ACCOUNT, publicKey: 'PUB_K1_setup', privateKey: KEY })
}

beforeEach(() => {
  lockWallet()
})

afterEach(() => {
  lockWallet()
})

describe('pin-кэш: persist → unlock без пароля и round-trip к серверу', () => {
  it('кастомный ПИН: persist под ПИН, lock, unlock тем же ПИН → тот же account и валидный publicKey', async () => {
    const storage = memoryStorage()
    putUnlocked()
    await persistPinCache({ pin: '135790', storage })
    lockWallet()
    expect(isWalletUnlocked()).toBe(false)

    const wallet = await unlockWithPin({ pin: '135790', storage })
    expect(wallet).not.toBeNull()
    expect(wallet!.account).toBe(ACCOUNT)
    expect(wallet!.publicKey).toMatch(new RegExp(`^${PUB}`))
    expect(isWalletUnlocked()).toBe(true)
    // keystore реально наполнен правильным ключом — getWallet отдаёт тот же pub
    expect((await getWallet()).publicKey).toBe(wallet!.publicKey)
  }, 30000)

  it('дефолтный ПИН (000000): persist и unlock без аргумента pin — прозрачно', async () => {
    const storage = memoryStorage()
    putUnlocked()
    await persistPinCache({ storage }) // pin не задан → DEFAULT_PIN
    lockWallet()

    const wallet = await unlockWithPin({ storage }) // pin не задан → DEFAULT_PIN
    expect(wallet).not.toBeNull()
    expect(wallet!.account).toBe(ACCOUNT)
    // тем же значением расшифровывается и явный DEFAULT_PIN
    lockWallet()
    expect(await unlockWithPin({ pin: DEFAULT_PIN, storage })).not.toBeNull()
  }, 30000)

  it('неверный ПИН → VaultDecryptionFailed, keystore остаётся пуст', async () => {
    const storage = memoryStorage()
    putUnlocked()
    await persistPinCache({ pin: '111111', storage })
    lockWallet()

    const err = await unlockWithPin({ pin: '999999', storage }).then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.VaultDecryptionFailed)
    expect(isWalletUnlocked()).toBe(false)
  }, 30000)
})

describe('pin-кэш: отсутствие кэша и жизненный цикл', () => {
  it('нет кэша → unlockWithPin возвращает null (нужен полный вход паролём)', async () => {
    const storage = memoryStorage()
    expect(await unlockWithPin({ storage })).toBeNull()
    expect(isWalletUnlocked()).toBe(false)
  })

  it('hasPinCache: false → persist → true → clear → false', async () => {
    const storage = memoryStorage()
    expect(await hasPinCache(storage)).toBe(false)
    putUnlocked()
    await persistPinCache({ storage })
    expect(await hasPinCache(storage)).toBe(true)
    await clearPinCache(storage)
    expect(await hasPinCache(storage)).toBe(false)
  }, 30000)

  it('persistPinCache при запертом кошельке → WalletLocked (нечего кэшировать)', async () => {
    const storage = memoryStorage()
    lockWallet()
    const err = await persistPinCache({ storage }).then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.WalletLocked)
  })
})

describe('pin-кэш: at-rest — на диске только шифр', () => {
  it('сохранённая запись не содержит WIF в открытом виде', async () => {
    const storage = memoryStorage()
    putUnlocked()
    await persistPinCache({ pin: '424242', storage })
    expect(JSON.stringify(storage.dump())).not.toContain(KEY)
  }, 30000)
})

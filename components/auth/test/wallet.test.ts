import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthV2Error, AuthV2ErrorCode } from '../src/errors'
import { encryptPrivateKey } from '../src/vault'
import {
  getWallet,
  isWalletUnlocked,
  lockWallet,
  unlockWallet,
  Wallet,
} from '../src/wallet'

const KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
const PW = 'correct-horse-battery-staple-12'
const ACCOUNT = 'ant'
const API = 'http://stub'

/** Подменяет fetch так, чтобы GET vault отдавал заранее зашифрованный blob. */
async function stubVaultFetch(password = PW): Promise<void> {
  const blob = await encryptPrivateKey(KEY, password, { subject_type: 'participant', subject_id: ACCOUNT })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => blob }) as any))
}

beforeEach(() => {
  lockWallet()
})

afterEach(() => {
  vi.unstubAllGlobals()
  lockWallet()
})

describe('wallet: unlock + in-memory keystore + getWallet', () => {
  it('unlock → getWallet отдаёт account и деривованный publicKey', async () => {
    await stubVaultFetch()
    const wallet = await unlockWallet({ apiUrl: API, account: ACCOUNT, password: PW })
    expect(wallet.account).toBe(ACCOUNT)
    expect(wallet.publicKey).toMatch(/^PUB_K1_/)
    expect(isWalletUnlocked()).toBe(true)

    const again = await getWallet()
    expect(again.publicKey).toBe(wallet.publicKey)
  }, 30000)

  it('неверный пароль → VaultDecryptionFailed, keystore остаётся пуст', async () => {
    await stubVaultFetch(PW)
    const err = await unlockWallet({ apiUrl: API, account: ACCOUNT, password: 'wrong-password-000000000000' })
      .then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.VaultDecryptionFailed)
    expect(isWalletUnlocked()).toBe(false)
  }, 30000)

  it('getWallet при запертом кошельке → WalletLocked', async () => {
    const err = await getWallet().then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.WalletLocked)
  })

  it('сеть недоступна → NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }) as any))
    const err = await unlockWallet({ apiUrl: API, account: ACCOUNT, password: PW }).then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.NetworkError)
  })
})

describe('wallet: несериализуемость приватного ключа', () => {
  it('JSON.stringify(wallet) не раскрывает приватный ключ', async () => {
    await stubVaultFetch()
    const wallet = await unlockWallet({ apiUrl: API, account: ACCOUNT, password: PW })
    const serialized = JSON.stringify(wallet)
    expect(serialized).not.toContain(KEY)
    expect(JSON.parse(serialized)).toEqual({ account: ACCOUNT, publicKey: wallet.publicKey })
    // приватного ключа нет ни в одном перечислимом свойстве обёртки
    expect(Object.values(wallet as unknown as Record<string, unknown>)).not.toContain(KEY)
    expect(wallet).toBeInstanceOf(Wallet)
  }, 30000)
})

describe('wallet: lock/wipe', () => {
  it('lockWallet затирает keystore → getWallet бросает; идемпотентно', async () => {
    await stubVaultFetch()
    await unlockWallet({ apiUrl: API, account: ACCOUNT, password: PW })
    expect(isWalletUnlocked()).toBe(true)
    lockWallet()
    expect(isWalletUnlocked()).toBe(false)
    lockWallet() // повторно — без ошибки
    const err = await getWallet().then(() => null, e => e)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.WalletLocked)
  }, 30000)
})

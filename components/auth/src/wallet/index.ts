/**
 * Кошелёк (Story 2.2): разблокировка после логина, доступ к публичному «виду»
 * ключа в памяти, запирание на logout. Приватный ключ живёт ТОЛЬКО в keystore
 * (storage.ts) и наружу не выходит — `Wallet` его не содержит и не сериализует.
 * Desktop-кошелёк переезжает на этот модуль (миграция — Эпик 7).
 */
import { AuthV2Error, AuthV2ErrorCode, notImplemented } from '../errors'
import { decryptPrivateKey } from '../vault/encrypt'
import type { EncryptedVaultBlob } from '../vault/types'
import { loadPinProtected, savePinProtected, type StorageAdapter } from './pin'
import { currentView, isUnlocked, storeUnlocked, wipeKeystore } from './storage'

/**
 * Несериализуемая обёртка кошелька: отдаёт только аккаунт и публичный ключ.
 * Приватного ключа в объекте НЕТ — `JSON.stringify(wallet)` физически не может
 * его раскрыть. Подпись (Stories 2.3/2.4) берёт ключ из keystore, не из Wallet.
 */
export class Wallet {
  readonly account: string
  readonly publicKey: string

  constructor(view: { account: string, publicKey: string }) {
    this.account = view.account
    this.publicKey = view.publicKey
  }

  toJSON(): { account: string, publicKey: string } {
    return { account: this.account, publicKey: this.publicKey }
  }
}

/** Деривует публичный ключ из приватного (WIF K1) через WharfKit antelope. */
async function derivePublicKey(privateKey: string): Promise<string> {
  // Ленивый импорт: тяжёлый antelope не тянем в bundle, пока кошелёк не разблокируют.
  const { PrivateKey } = await import('@wharfkit/antelope')
  try {
    return PrivateKey.from(privateKey).toPublic().toString()
  }
  catch {
    throw new AuthV2Error(AuthV2ErrorCode.VaultDecryptionFailed, 'Расшифрованное значение не является валидным приватным ключом')
  }
}

/** GET зашифрованного blob'а пайщика с контроллера (blob-only, см. 2.2). */
export async function fetchVaultBlob(apiUrl: string, subjectId: string): Promise<EncryptedVaultBlob> {
  let res: Response
  try {
    res = await fetch(`${apiUrl.replace(/\/$/, '')}/coop/vault/participant/${encodeURIComponent(subjectId)}`)
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна при запросе vault: ${e instanceof Error ? e.message : e}`)
  }
  if (!res.ok)
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Не удалось получить vault (HTTP ${res.status})`)
  return res.json() as Promise<EncryptedVaultBlob>
}

interface UnlockParams {
  apiUrl: string
  account: string
  password: string
  /** Опционально сохранить ключ под PIN для быстрой разблокировки на устройстве. */
  persistPin?: { pin: string, storage: StorageAdapter }
}

/**
 * Полная разблокировка: забрать blob → расшифровать паролём на клиенте →
 * положить ключ в keystore. При неверном пароле keystore остаётся пуст.
 */
export async function unlockWallet(params: UnlockParams): Promise<Wallet> {
  const blob = await fetchVaultBlob(params.apiUrl, params.account)
  const privateKey = await decryptPrivateKey(blob, params.password, {
    subject_type: 'participant',
    subject_id: params.account,
  })
  const publicKey = await derivePublicKey(privateKey)
  storeUnlocked({ account: params.account, publicKey, privateKey })
  if (params.persistPin)
    await savePinProtected(privateKey, params.persistPin.pin, params.account, params.persistPin.storage)
  return new Wallet({ account: params.account, publicKey })
}

/**
 * Быстрая разблокировка ранее сохранённым PIN (без обращения к серверу/паролю).
 * `null` — на устройстве нет PIN-записи. Неверный PIN → `VaultDecryptionFailed`.
 */
export async function unlockWithPin(pin: string, storage: StorageAdapter): Promise<Wallet | null> {
  const loaded = await loadPinProtected(pin, storage)
  if (!loaded)
    return null
  const publicKey = await derivePublicKey(loaded.privateKey)
  storeUnlocked({ account: loaded.account, publicKey, privateKey: loaded.privateKey })
  return new Wallet({ account: loaded.account, publicKey })
}

/** Текущий разблокированный кошелёк. Бросает `WalletLocked`, если заперт. */
export async function getWallet(): Promise<Wallet> {
  return new Wallet(currentView())
}

/** Заперт ли кошелёк (нет ключа в памяти). */
export function isWalletUnlocked(): boolean {
  return isUnlocked()
}

/** Затирает ключ из памяти (logout). Идемпотентно. PIN-запись не трогает. */
export function lockWallet(): void {
  wipeKeystore()
}

/** Ротация ключа пайщика (updateauth + перешифровка vault). Story 3.3. */
export async function rotateKey(): Promise<void> {
  notImplemented('rotateKey')
}

export type { StorageAdapter } from './pin'
export { clearPinProtected } from './pin'

import type { EncryptedVaultBlob } from '../vault/types'
import type { StorageAdapter } from './storage-adapter'
import { lt } from '@coopenomics/i18n'
/**
 * Кошелёк (Story 2.2): разблокировка после логина, доступ к публичному «виду»
 * ключа в памяти, запирание на logout. Приватный ключ живёт ТОЛЬКО в keystore
 * (storage.ts) и наружу не выходит — `Wallet` его не содержит и не сериализует.
 * Desktop-кошелёк переезжает на этот модуль (миграция — Эпик 7).
 */
import { AuthV2Error, AuthV2ErrorCode, notImplemented } from '../errors'
import { decryptPrivateKey } from '../vault/encrypt'
import { clearPinProtected, DEFAULT_PIN, hasPinProtected, loadPinProtected, savePinProtected } from './pin'
import { currentView, isUnlocked, readUnlockedKey, storeUnlocked, wipeKeystore } from './storage'

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
    throw new AuthV2Error(AuthV2ErrorCode.VaultDecryptionFailed, lt('authClient.wallet.invalidPrivateKey'))
  }
}

/** GET зашифрованного blob'а пайщика с контроллера (blob-only, см. 2.2). */
export async function fetchVaultBlob(apiUrl: string, subjectId: string): Promise<EncryptedVaultBlob> {
  let res: Response
  try {
    res = await fetch(`${apiUrl.replace(/\/$/, '')}/coop/vault/participant/${encodeURIComponent(subjectId)}`)
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, lt('authClient.wallet.vaultNetworkError', { error: e instanceof Error ? e.message : e }))
  }
  if (!res.ok)
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, lt('authClient.wallet.vaultRequestFailed', { status: res.status }))
  return res.json() as Promise<EncryptedVaultBlob>
}

interface UnlockParams {
  apiUrl: string
  account: string
  password: string
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
  return new Wallet({ account: params.account, publicKey })
}

/**
 * Отдаёт приватный ключ разблокированного кошелька наружу — исключительно для
 * подписи документов кооператива старым путём.
 *
 * Почему это вообще есть. Подпись документов собирается классом из SDK, который
 * принимает ключ строкой, а не функцию подписи. Точек вызова таких больше полудюжины,
 * и до тех пор, пока класс не научится подписывать чужими руками (как это уже делает
 * мост подписи транзакций), ключ приходится отдавать. Без этого вход по паролю
 * оставляет пайщика без возможности подписать хоть что-нибудь.
 *
 * Что при этом НЕ нарушается: ключ не уходит на сервер и не ложится в браузерное
 * хранилище — он и так живёт в памяти этой же вкладки, пока сессия разблокирована.
 * Забирающий обязан держать его только в памяти и стирать вместе с сессией.
 *
 * Бросает `WalletLocked`, если кошелёк заперт.
 */
export function exportUnlockedKeyForDocumentSigning(): string {
  return readUnlockedKey()
}

/** Текущий разблокированный кошелёк. Бросает `WalletLocked`, если заперт. */
export async function getWallet(): Promise<Wallet> {
  return new Wallet(currentView())
}

/** Заперт ли кошелёк (нет ключа в памяти). */
export function isWalletUnlocked(): boolean {
  return isUnlocked()
}

/** Затирает ключ из памяти (logout). Идемпотентно. */
export function lockWallet(): void {
  wipeKeystore()
}

/** Ротация ключа пайщика (updateauth + перешифровка vault). Story 3.3. */
export async function rotateKey(): Promise<void> {
  notImplemented('rotateKey')
}

interface PersistPinParams {
  /** ПИН для шифрования локального кэша; по умолчанию — `DEFAULT_PIN` ('000000', прозрачный). */
  pin?: string
  storage: StorageAdapter
}

/**
 * Перешифровывает текущий разблокированный ключ ПИНом и кладёт в локальный кэш
 * (уточнённая at-rest модель, см. `pin.ts`). Вызывается сразу после успешного
 * `unlockWallet`/`migrate`, чтобы последующие входы шли по ПИН, а не по паролю.
 * Бросает `WalletLocked`, если кошелёк заперт (нечего кэшировать). Ключ читается
 * пакет-внутренней `readUnlockedKey()` и наружу не выходит — в кэш ложится шифр.
 */
export async function persistPinCache(params: PersistPinParams): Promise<void> {
  const { account } = currentView() // бросает WalletLocked, если заперт
  await savePinProtected(readUnlockedKey(), params.pin ?? DEFAULT_PIN, account, params.storage)
}

interface UnlockWithPinParams {
  /** ПИН; по умолчанию — `DEFAULT_PIN` ('000000', прозрачная авто-разблокировка). */
  pin?: string
  storage: StorageAdapter
}

/**
 * Разблокировка из локального PIN-кэша без round-trip к серверу и без пароля
 * (reload устройства, авто-лок по простою). `null` — кэша нет (нужен полный вход
 * `unlockWallet` паролём). Неверный ПИН → `VaultDecryptionFailed`. При успехе
 * кладёт ключ в keystore и возвращает `Wallet`.
 */
export async function unlockWithPin(params: UnlockWithPinParams): Promise<Wallet | null> {
  const loaded = await loadPinProtected(params.pin ?? DEFAULT_PIN, params.storage)
  if (!loaded)
    return null
  const publicKey = await derivePublicKey(loaded.privateKey)
  storeUnlocked({ account: loaded.account, publicKey, privateKey: loaded.privateKey })
  return new Wallet({ account: loaded.account, publicKey })
}

/** Есть ли локальный PIN-кэш (выбор сценария разблокировки на загрузке). */
export async function hasPinCache(storage: StorageAdapter): Promise<boolean> {
  return hasPinProtected(storage)
}

/** Удаляет локальный PIN-кэш («забыть устройство» / смена аккаунта). */
export async function clearPinCache(storage: StorageAdapter): Promise<void> {
  await clearPinProtected(storage)
}

export { clearLocalVault, loadLocalVault, saveLocalVault } from './local-vault'
export { DEFAULT_PIN } from './pin'
export type { StorageAdapter } from './storage-adapter'

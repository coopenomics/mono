/**
 * In-memory keystore (Story 2.2). ЕДИНСТВЕННОЕ место, где живёт расшифрованный
 * приватный ключ пайщика — module-private переменная, только в RAM процесса/вкладки.
 *
 * Публичная поверхность SDK (`getWallet()`) приватный ключ НЕ отдаёт: signing-модули
 * (Stories 2.3/2.4) берут его через пакет-внутреннюю `readUnlockedKey()`. На logout —
 * `wipeKeystore()` затирает ключ (перезапись + сброс ссылки).
 */
import { AuthV2Error, AuthV2ErrorCode } from '../errors'

interface UnlockedEntry {
  account: string
  publicKey: string
  privateKey: string
}

/** Открытое состояние сессии. null = заперто. */
let unlocked: UnlockedEntry | null = null

/** Кладёт расшифрованный ключ в keystore (вызывается из unlockWallet). */
export function storeUnlocked(entry: UnlockedEntry): void {
  unlocked = entry
}

/** Заперт ли кошелёк (нет расшифрованного ключа в памяти). */
export function isUnlocked(): boolean {
  return unlocked !== null
}

/** Публичный «вид» кошелька без приватного ключа. Бросает, если заперто. */
export function currentView(): { account: string, publicKey: string } {
  if (!unlocked)
    throw new AuthV2Error(AuthV2ErrorCode.WalletLocked, 'Кошелёк заперт: сначала вызовите unlockWallet()')
  return { account: unlocked.account, publicKey: unlocked.publicKey }
}

/**
 * Пакет-внутренний доступ к приватному ключу для signing-модулей (2.3/2.4).
 * НЕ реэкспортируется из index.ts — наружу ключ не выходит.
 */
export function readUnlockedKey(): string {
  if (!unlocked)
    throw new AuthV2Error(AuthV2ErrorCode.WalletLocked, 'Кошелёк заперт: подпись невозможна без unlockWallet()')
  return unlocked.privateKey
}

/** Затирает ключ из памяти (logout / lockWallet). Идемпотентно. */
export function wipeKeystore(): void {
  if (unlocked) {
    // Перезаписываем строку-ключ перед сбросом ссылки, чтобы уменьшить окно жизни
    // в куче (JS-строки иммутабельны — гарантий нет, но снимаем прямую ссылку).
    unlocked.privateKey = '\0'.repeat(unlocked.privateKey.length)
    unlocked = null
  }
}

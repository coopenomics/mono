import type { EncryptedVaultBlob } from '../vault/types'
import type { StorageAdapter } from './storage-adapter'
/**
 * Опциональный PIN-слой (Story 2.2): обёртка приватного ключа коротким PIN
 * поверх того же Argon2id+AES-256-GCM, что и vault. Хранится в подключаемом
 * `StorageAdapter` (в браузере — localStorage/IndexedDB, в тестах/Node — память),
 * чтобы крипто-логика не зависела от среды и тестировалась без браузера.
 *
 * Модель угроз: PIN слабее пароля, но Argon2id держит перебор медленным, а AAD
 * `pin|<account>` привязывает обёртку к аккаунту. Защита от компрометации самого
 * устройства — вне scope этого слоя.
 */
import { decryptWithPassword, encryptWithPassword } from '../vault/encrypt'

export type { StorageAdapter } from './storage-adapter'

const STORAGE_KEY = 'coopid.wallet.pin-vault'

function aad(account: string): string {
  return `pin|${account}`
}

interface PinRecord {
  account: string
  blob: EncryptedVaultBlob
}

/** Сохраняет ключ под PIN в storage (перезаписывает предыдущую запись). */
export async function savePinProtected(
  privateKey: string,
  pin: string,
  account: string,
  storage: StorageAdapter,
): Promise<void> {
  const blob = await encryptWithPassword(privateKey, pin, aad(account))
  const record: PinRecord = { account, blob }
  await storage.set(STORAGE_KEY, JSON.stringify(record))
}

/**
 * Восстанавливает ключ из storage по PIN. `null` — записи нет. Неверный PIN →
 * `VaultDecryptionFailed` (из ядра). Возвращает `{account, privateKey}`.
 */
export async function loadPinProtected(
  pin: string,
  storage: StorageAdapter,
): Promise<{ account: string, privateKey: string } | null> {
  const raw = await storage.get(STORAGE_KEY)
  if (!raw)
    return null
  const record = JSON.parse(raw) as PinRecord
  const privateKey = await decryptWithPassword(record.blob, pin, aad(record.account))
  return { account: record.account, privateKey }
}

/** Удаляет PIN-запись (например, при logout с забыванием устройства). */
export async function clearPinProtected(storage: StorageAdapter): Promise<void> {
  await storage.remove(STORAGE_KEY)
}

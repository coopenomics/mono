import type { EncryptedVaultBlob } from '../vault/types'
import type { StorageAdapter } from './storage-adapter'
/**
 * Локальный PIN-кэш приватного ключа (уточнённая модель CoopID, 2026-06-15 —
 * СУПЕРДИТ «без PIN» из Story 11.8). Двухуровневая защита ключа:
 *
 *  1) Серверный vault ← ПАРОЛЬ (сложный, записан отдельно). Расшифровывается
 *     только при входе; повторно пароль не спрашиваем. Защита от кражи блоба.
 *  2) Локальный кэш ← ПИН (этот модуль). После входа расшифрованный WIF
 *     перешифровывается ПИНом тем же Argon2id+AES-256-GCM и кладётся в
 *     `StorageAdapter`. Дальнейшие разблокировки (reload, авто-лок по простою) —
 *     ПИНом, НЕ паролём.
 *
 * Модель угроз: ПИН защищает не от похищения блоба (от него защищает пароль), а
 * «от дурака» — постороннего/ребёнка за разблокированным устройством. ПИН по
 * умолчанию `DEFAULT_PIN` ('000000') делает разблокировку прозрачной (ключ де-факто
 * лежит локально с тривиальной защитой — осознанная плата за «не вводить пароль
 * повторно»); кастомный ПИН поднимает планку до анти-«дурак» (6 цифр). AAD
 * `pin|<account>` привязывает обёртку к аккаунту; account лежит в самой записи,
 * поэтому знать его заранее не нужно (в отличие от серверного blob'а).
 */
import { decryptWithPassword, encryptWithPassword } from '../vault/encrypt'

export type { StorageAdapter } from './storage-adapter'

const STORAGE_KEY = 'coopid.wallet.pin-vault'

/** Стандартный «прозрачный» ПИН: разблокировка происходит автоматически и незаметно. */
export const DEFAULT_PIN = '000000'

function aad(account: string): string {
  return `pin|${account}`
}

interface PinRecord {
  account: string
  blob: EncryptedVaultBlob
}

/** Сохраняет ключ под ПИН в storage (перезаписывает предыдущую запись). */
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
 * Восстанавливает ключ из storage по ПИН. `null` — записи нет. Неверный ПИН →
 * `VaultDecryptionFailed` (из ядра). Возвращает `{account, privateKey}` — account
 * берётся из самой записи, знать его до разблокировки не требуется.
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

/** Есть ли локальный PIN-кэш (без расшифровки — для выбора сценария разблокировки). */
export async function hasPinProtected(storage: StorageAdapter): Promise<boolean> {
  return (await storage.get(STORAGE_KEY)) !== null
}

/** Удаляет PIN-запись (logout с «забыть устройство» / смена аккаунта). */
export async function clearPinProtected(storage: StorageAdapter): Promise<void> {
  await storage.remove(STORAGE_KEY)
}

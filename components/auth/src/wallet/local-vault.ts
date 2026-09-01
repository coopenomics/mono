/**
 * Локальная копия зашифрованного vault-блоба (Story 11.3). Хранит то же, что и
 * сервер — Argon2id+AES-256-GCM ciphertext, бесполезный без пароля; расшифровать
 * нельзя без знания пароля пайщика (zero-knowledge инвариант сохраняется и локально).
 *
 * Зачем дублировать серверную копию на устройстве: вход и подпись возможны без
 * round-trip к контроллеру (офлайн/деградация узла), а также чтобы сразу после
 * миграции (Story 11.4) ключ был доступен локально. Сервер остаётся источником
 * истины и обязателен для входа с НОВОГО устройства (там локальной копии нет).
 *
 * Это НЕ расшифрованный ключ: расшифрованный WIF живёт только в RAM-keystore
 * (`storage.ts`) и стирается на логауте (Story 11.8). Локально лежит лишь шифр.
 */
import type { EncryptedVaultBlob } from '../vault/types'
import type { StorageAdapter } from './storage-adapter'

const LOCAL_VAULT_KEY = 'coopid.wallet.vault'

interface LocalVaultRecord {
  account: string
  blob: EncryptedVaultBlob
}

/** Сохраняет (перезаписывает) локальную копию зашифрованного blob'а пайщика. */
export async function saveLocalVault(storage: StorageAdapter, account: string, blob: EncryptedVaultBlob): Promise<void> {
  const record: LocalVaultRecord = { account, blob }
  await storage.set(LOCAL_VAULT_KEY, JSON.stringify(record))
}

/**
 * Возвращает локальную копию blob'а для `account` (или `null`, если записи нет /
 * она от другого аккаунта). Подмена account → `null`: чужой blob не отдаём, даже
 * расшифровать его без чужого пароля всё равно нельзя.
 */
export async function loadLocalVault(storage: StorageAdapter, account: string): Promise<EncryptedVaultBlob | null> {
  const raw = await storage.get(LOCAL_VAULT_KEY)
  if (!raw)
    return null
  const record = JSON.parse(raw) as LocalVaultRecord
  return record.account === account ? record.blob : null
}

/** Удаляет локальную копию vault'а (смена аккаунта / «забыть устройство»). */
export async function clearLocalVault(storage: StorageAdapter): Promise<void> {
  await storage.remove(LOCAL_VAULT_KEY)
}

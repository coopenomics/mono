/**
 * Цепочка доверия: офлайн-проверка participant_certificate walk'ом
 * `ano → voskhod → vostok → participant` от embedded trust anchor.
 * Реализация verify — Story 4.4; чтение ключей `cert` из COOPOS — здесь.
 */
import { APIClient } from '@wharfkit/antelope'
import { AuthV2Error, AuthV2ErrorCode, notImplemented } from '../errors'

/**
 * Публичный ключ permission `cert` аккаунта в COOPOS (Story 1.3).
 * Возвращает строку в формате Antelope (`PUB_K1_...`).
 */
export async function readCertPublicKey(rpcUrl: string, account: string): Promise<string> {
  const client = new APIClient({ url: rpcUrl })
  const acc = await client.v1.chain.get_account(account).catch((e: unknown) => {
    throw new AuthV2Error(
      AuthV2ErrorCode.NetworkError,
      `COOPOS недоступен или аккаунт ${account} не найден: ${e instanceof Error ? e.message : String(e)}`,
    )
  })
  const cert = acc.permissions.find(p => String(p.perm_name) === 'cert')
  const key = cert?.required_auth.keys[0]?.key
  if (!cert || !key) {
    throw new AuthV2Error(
      AuthV2ErrorCode.ChainVerificationFailed,
      `На аккаунте ${account} нет permission cert с ключом — цепочка доверия не настроена (Story 1.3).`,
    )
  }
  // MVP-инвариант: cert — строго single-key (multi-sig для ano — Growth).
  // Молча взять keys[0] у multi-sig значило бы проверять подпись против
  // одного из N ключей — это дыра в цепочке доверия.
  const auth = cert.required_auth
  if (Number(auth.threshold) !== 1 || auth.keys.length !== 1 || auth.accounts.length > 0 || auth.waits.length > 0) {
    throw new AuthV2Error(
      AuthV2ErrorCode.ChainVerificationFailed,
      `Permission cert на ${account} не является single-key (threshold=${auth.threshold}, keys=${auth.keys.length}) — не поддерживается MVP-верификацией.`,
    )
  }
  return key.toString()
}

export interface VerifyOfflineResult {
  valid: boolean
  /** Причина отказа, если valid=false (expired / revoked / chain broken) */
  reason?: string
}

/** Офлайн-валидация удостоверения без обращения к сети. Story 4.4. */
export async function verifyOffline(_certificate: string): Promise<VerifyOfflineResult> {
  notImplemented('verifyOffline')
}

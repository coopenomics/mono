/**
 * Цепочка доверия: офлайн-проверка participant_certificate walk'ом
 * `ano → voskhod → vostok → participant` от embedded trust anchor.
 * Реализация verify — Story 4.4; чтение ключей `cert` из COOPOS — здесь.
 */
import { APIClient } from '@wharfkit/antelope'
import { base64url } from 'jose'
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

/**
 * Окно активности одного публичного ключа подписанта в истории его аккаунта.
 * Блоки, не время: смена authority в COOPOS привязана к блоку.
 */
export interface KeyValidityWindow {
  /** публичный ключ в формате Antelope (`PUB_K1_...`) */
  public_key: string
  /** блок, с которого ключ стал активным (включительно) */
  valid_from_block: number
  /** блок, по который ключ был активным (включительно); null = активен сейчас */
  valid_to_block: number | null
}

export type VerifyDocumentReason =
  | 'malformed_jws'
  | 'unsupported_alg'
  | 'signature_mismatch' // ни один исторический ключ не даёт валидную подпись (подделка/чужой)
  | 'key_not_active_at_signing' // подпись валидна под ключом, но он НЕ был активен на signedAtBlock

export interface VerifyDocumentParams {
  /** compact JWS из `signDocument` (Story 2.3) */
  jws: string
  /**
   * Блок, на который проверяется активность ключа — `last_irreversible_block_num`
   * на момент `iat` подписи. Известен держателю документа (метаданные подписи).
   */
  signedAtBlock: number
  /**
   * Историческая хронология ключей подписанта (offline-снимок из
   * `chain_manifests_cache`). Наполнение кэша (ротация ключей / manifest-sync) —
   * отдельная задача; здесь — чистая проверка по уже полученной хронологии.
   */
  authority: KeyValidityWindow[]
}

export interface VerifyDocumentResult {
  valid: boolean
  reason?: VerifyDocumentReason
  /** ключ, под которым подпись подтвердилась (если valid) */
  matched_key?: string
}

/**
 * Backward-валидность подписи документа через chain-walk (Story 2.5). Подпись,
 * сделанная ключом пайщика ДО ротации, остаётся валидной: проверяем, что ключ был
 * активен в момент подписи (`signedAtBlock` ∈ окно ключа), а не «активен сейчас».
 * Так ротация ключа не аннулирует юридически значимые документы.
 *
 * Полностью офлайн: работает по переданной хронологии `authority` (кэш манифеста),
 * без сети. Верификация — `verifyMessage` против ключей-кандидатов (а НЕ recover:
 * `signDocument` отбрасывает recovery-байт, оставляя JWS-формат R||S).
 */
export async function verifyDocumentOffline(params: VerifyDocumentParams): Promise<VerifyDocumentResult> {
  const parts = params.jws.split('.')
  if (parts.length !== 3)
    return { valid: false, reason: 'malformed_jws' }
  const [h, p, s] = parts

  let header: { alg?: string }
  try {
    header = JSON.parse(new TextDecoder().decode(base64url.decode(h)))
  }
  catch {
    return { valid: false, reason: 'malformed_jws' }
  }
  if (header.alg !== 'ES256K')
    return { valid: false, reason: 'unsupported_alg' }

  let rs: Uint8Array
  try {
    rs = base64url.decode(s)
  }
  catch {
    return { valid: false, reason: 'malformed_jws' }
  }
  if (rs.length !== 64)
    return { valid: false, reason: 'malformed_jws' }

  const { PublicKey, Signature } = await import('@wharfkit/antelope')
  const signingInput = new TextEncoder().encode(`${h}.${p}`)
  const sig = Signature.from({ type: 'K1', r: rs.slice(0, 32), s: rs.slice(32, 64), recid: 0 })

  let signedUnderRotatedKey = false
  for (const w of params.authority) {
    let ok = false
    try {
      ok = sig.verifyMessage(signingInput, PublicKey.from(w.public_key))
    }
    catch {
      ok = false // некорректный ключ в хронологии — пропускаем, не валим всю проверку
    }
    if (!ok)
      continue
    const active = params.signedAtBlock >= w.valid_from_block
      && (w.valid_to_block === null || params.signedAtBlock <= w.valid_to_block)
    if (active)
      return { valid: true, matched_key: w.public_key }
    // подпись валидна, но этот ключ не был активен в момент подписи — продолжаем
    // искать (вдруг другой ключ окна подходит); запоминаем для точной причины.
    signedUnderRotatedKey = true
  }

  return {
    valid: false,
    reason: signedUnderRotatedKey ? 'key_not_active_at_signing' : 'signature_mismatch',
  }
}

import type { CoopChainLink } from '../certificate'
/**
 * Цепочка доверия: офлайн-проверка participant_certificate walk'ом
 * `ano → voskhod → vostok → participant` от embedded trust anchor.
 * Реализация verify — Story 4.4; чтение ключей `cert` из COOPOS — здесь.
 */
import { APIClient } from '@wharfkit/antelope'
import { base64url } from 'jose'
import { compareSchemaVersions } from '../certificate/schema-policy'
import { TRUST_ANCHOR_ANO_CERT_PUBKEY } from '../config/trust-anchor'
import { AuthV2Error, AuthV2ErrorCode } from '../errors'

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

export type VerifyOfflineReason =
  | 'malformed_certificate' // не compact JWS / нет обязательных claims (coop_chain, exp)
  | 'unsupported_alg' // alg ≠ ES256K
  | 'expired' // exp в прошлом относительно now
  | 'untrusted_anchor' // coop_chain не укоренён в известном trust-anchor `ano`
  | 'untrusted_issuer' // звено цепи (в т.ч. издатель) не совпало с доверенным кэшем ключей
  | 'signature_mismatch' // подпись не сходится с ключом издателя
  | 'unsupported_schema_version' // claim_schema_version старее min_supported_version политики

export interface VerifyOfflineResult {
  valid: boolean
  /** Причина отказа, если valid=false. Офлайн-отзыв (revoked) — вне MVP (Story 4.7). */
  reason?: VerifyOfflineReason
  /** Аккаунт-издатель (последнее звено coop_chain), под чьим ключом сошлась подпись. */
  issuer?: string
}

export interface VerifyOfflineOptions {
  /**
   * Офлайн-снимок доверенных cert-ключей известных кооперативов
   * (`chain_manifests_cache`): `account → Antelope public_key`. Источник доверия —
   * каждое звено `coop_chain` сертификата сверяется с этим набором (закрывает
   * подделку «свой leaf-ключ + настоящий ano в root»). Без него издатель не
   * подтверждается → `untrusted_issuer` (fail-closed). Наполнение кэша
   * (manifest-sync) — отдельная задача.
   */
  trustedKeys?: Record<string, string>
  /**
   * Доверенный якорь `ano.cert` (Antelope `PUB_K1_…`). По умолчанию —
   * `trustedKeys['ano']`, затем вшитый release-pinned `TRUST_ANCHOR_ANO_CERT_PUBKEY`.
   */
  trustAnchor?: string
  /**
   * Аккаунт, которым цепь обязана начинаться. По умолчанию `ano` — АНО, заверяющая
   * кооперативы. Пока её аккаунта нет в цепи, удостоверения укореняются на самом
   * кооперативе, и проверяющий обязан назвать его здесь явно: иначе укоренение
   * ничего не значит — цепь из одного звена подтверждает сама себя.
   */
  trustAnchorAccount?: string
  /** «Сейчас» в мс для проверки exp (инъекция для детерминизма/тестов). */
  now?: number
  /**
   * Минимально поддерживаемая версия схемы claims (Story 4.10). Резолвится хостом
   * из кэша политики (`createSchemaPolicyCache().getMinSupportedVersion`, TTL 24ч).
   * Если задана и `cert.claim_schema_version` старее неё → `unsupported_schema_version`.
   * Не задана → ось версии схемы не гейтит (крипто/exp/цепь остаются fail-closed).
   */
  minSchemaVersion?: string
}

/** Порядок группы secp256k1 (n) и его половина — для low-S нормализации подписи. */
const SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n
const SECP256K1_HALF_N = SECP256K1_N >> 1n

/**
 * Нормализовать S подписи R||S (64 байта) к нижней половине порядка кривой.
 * cert подписывает controller через jose+Node KeyObject, а Node-ECDSA может выдать
 * high-S; wharfkit/noble verify по умолчанию отвергает high-S (`lowS:true`).
 * Верификация secp256k1 инвариантна к `S ↔ n−S`, поэтому приведение к low-S делает
 * подпись принимаемой независимо от каноничности подписанта.
 */
function normalizeLowS(rs: Uint8Array): Uint8Array {
  let s = 0n
  for (const byte of rs.slice(32, 64))
    s = (s << 8n) | BigInt(byte)
  if (s <= SECP256K1_HALF_N)
    return rs
  let low = SECP256K1_N - s
  const out = new Uint8Array(rs) // копия R||S
  for (let i = 63; i >= 32; i--) {
    out[i] = Number(low & 0xFFn)
    low >>= 8n
  }
  return out
}

interface CertHead { alg?: string }
interface CertPayload { coop_chain?: CoopChainLink[], exp?: number, claim_schema_version?: string }

/**
 * Офлайн-валидация удостоверения `participant_certificate` без обращения к сети
 * (Story 4.4; Vision: NFC-карты, бумажный QR). Проверяет структуру/alg/exp,
 * укоренение `coop_chain` в trust-anchor `ano`, принадлежность звеньев доверенному
 * кэшу ключей и подпись против ключа издателя (последнее звено `coop_chain`).
 *
 * Полностью офлайн и fail-closed: без доверенного якоря/кэша вердикт всегда
 * `valid:false`. Отзыв ключа офлайн не проверяется (вне MVP — Story 4.7, Growth
 * FR65); компенсируется коротким TTL (Story 4.6).
 */
export async function verifyOffline(certificate: string, options: VerifyOfflineOptions = {}): Promise<VerifyOfflineResult> {
  const parts = certificate.split('.')
  if (parts.length !== 3)
    return { valid: false, reason: 'malformed_certificate' }
  const [h, p, s] = parts

  let head: CertHead
  let payload: CertPayload
  try {
    head = JSON.parse(new TextDecoder().decode(base64url.decode(h)))
    payload = JSON.parse(new TextDecoder().decode(base64url.decode(p)))
  }
  catch {
    return { valid: false, reason: 'malformed_certificate' }
  }
  if (head.alg !== 'ES256K')
    return { valid: false, reason: 'unsupported_alg' }

  const chain = payload.coop_chain
  if (!Array.isArray(chain) || chain.length === 0 || typeof payload.exp !== 'number')
    return { valid: false, reason: 'malformed_certificate' }

  const now = options.now ?? Date.now()
  if (now >= payload.exp * 1000)
    return { valid: false, reason: 'expired' }

  // Версия схемы (Story 4.10): если хост передал минимально поддерживаемую версию
  // (из кэша политики, TTL 24ч), отвергаем сертификаты старее неё — устаревшая схема
  // claims не должна проходить как валидная. Без minSchemaVersion ось не гейтит.
  if (options.minSchemaVersion !== undefined
    && compareSchemaVersions(payload.claim_schema_version ?? '0', options.minSchemaVersion) < 0) {
    return { valid: false, reason: 'unsupported_schema_version' }
  }

  // Якорь: цепь обязана начинаться с известного `ano`.
  const root = chain[0]
  const anchorAccount = options.trustAnchorAccount ?? 'ano'
  const anchor = options.trustAnchor ?? options.trustedKeys?.[anchorAccount] ?? TRUST_ANCHOR_ANO_CERT_PUBKEY
  if (!anchor || root.account !== anchorAccount || root.public_key !== anchor)
    return { valid: false, reason: 'untrusted_anchor' }

  // Звенья: при наличии кэша каждое звено должно совпасть с доверенным ключом.
  if (options.trustedKeys) {
    for (const link of chain) {
      if (options.trustedKeys[link.account] !== link.public_key)
        return { valid: false, reason: 'untrusted_issuer' }
    }
  }
  else {
    // Без кэша подтверждён только якорь; издателя доверять нельзя — fail-closed.
    return { valid: false, reason: 'untrusted_issuer' }
  }

  // Подпись: против ключа издателя (последнее звено coop_chain, оно же `kid`).
  const issuer = chain[chain.length - 1]
  let rs: Uint8Array
  try {
    rs = base64url.decode(s)
  }
  catch {
    return { valid: false, reason: 'malformed_certificate' }
  }
  if (rs.length !== 64)
    return { valid: false, reason: 'malformed_certificate' }

  const { PublicKey, Signature } = await import('@wharfkit/antelope')
  const normalized = normalizeLowS(rs)
  const signingInput = new TextEncoder().encode(`${h}.${p}`)
  let ok = false
  try {
    const sig = Signature.from({ type: 'K1', r: normalized.slice(0, 32), s: normalized.slice(32, 64), recid: 0 })
    ok = sig.verifyMessage(signingInput, PublicKey.from(issuer.public_key))
  }
  catch {
    ok = false // некорректный ключ/подпись в сертификате — не валим исключением
  }
  if (!ok)
    return { valid: false, reason: 'signature_mismatch' }

  return { valid: true, issuer: issuer.account }
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

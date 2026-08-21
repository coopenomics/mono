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
  | 'malformed_certificate' // не compact JWS либо нет обязательных claims
  | 'unsupported_alg' // alg ≠ ES256K
  | 'expired' // срок удостоверения истёк
  | 'no_trust_anchor' // проверяющему не задан корневой ключ — доверять не от чего
  | 'not_endorsed' // цепочка заверений пуста: кооператив никем не признан
  | 'broken_chain' // звено выдано не тем, кого признало предыдущее
  | 'endorsement_expired' // заверение в цепочке истекло
  | 'endorsement_invalid' // подпись заверения не сходится
  | 'foreign_chain' // заверение выдано в другой сети
  | 'issuer_mismatch' // удостоверение выпущено не тем, кого признаёт цепочка
  | 'signature_mismatch' // подпись удостоверения не сходится
  | 'unsupported_schema_version' // схема claims старее минимально поддерживаемой

export interface VerifyOfflineResult {
  valid: boolean
  /** Причина отказа, если valid=false. Отзыв офлайн не проверяется — см. короткий срок. */
  reason?: VerifyOfflineReason
  /** Кооператив, выпустивший удостоверение, — последнее звено цепочки заверений. */
  issuer?: string
  /** Цепочка признания от корня к издателю: имена по порядку. Для показа проверяющему. */
  chain?: string[]
}

export interface VerifyOfflineOptions {
  /**
   * Корневой ключ доверия — публичный ключ заверения АНО (`PUB_K1_…`), вшитый в
   * приложение проверки. Без него проверять нечем: доверие начинается здесь и
   * больше нигде. По умолчанию берётся вшитый `TRUST_ANCHOR_ANO_CERT_PUBKEY`.
   */
  trustAnchor?: string
  /** Имя корневого аккаунта; им обязана начинаться цепочка заверений. */
  trustAnchorAccount?: string
  /**
   * Идентификатор сети, в которой проверяющий признаёт заверения. Задан — заверения
   * из другой сети отвергаются; не задан — сеть не проверяется. Это и не даёт
   * перенести признание из испытательной сети в боевую.
   */
  chainId?: string
  /** «Сейчас» в мс (инъекция для детерминизма и тестов). */
  now?: number
  /**
   * Минимально поддерживаемая версия схемы claims. Резолвится хостом из кэша
   * политики. Не задана — ось версии не гейтит; крипто и сроки остаются строгими.
   */
  minSchemaVersion?: string
}

/** Порядок группы secp256k1 (n) и его половина — для low-S нормализации подписи. */
const SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n
const SECP256K1_HALF_N = SECP256K1_N >> 1n

/**
 * Тип подписанного заверения. Отличается от типа удостоверения намеренно: иначе
 * звено цепочки удалось бы предъявить вместо самого удостоверения.
 */
const ENDORSEMENT_TYP = 'coop-endorsement+jws'

/** Допуск на расхождение часов между выпустившим и проверяющим. */
const CLOCK_SKEW_SECONDS = 300

/**
 * Нормализовать S подписи R||S (64 байта) к нижней половине порядка кривой.
 * Подписывает Node через jose, а Node-ECDSA может выдать high-S; проверка
 * secp256k1 инвариантна к `S ↔ n−S`, поэтому приведение делает подпись
 * принимаемой независимо от каноничности подписанта.
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

interface CompactParts { head: Record<string, unknown>, payload: Record<string, unknown>, signingInput: Uint8Array, signature: Uint8Array }

/** Разобрать compact JWS на части. `null` — предъявлено не то. */
function splitCompact(jws: string): CompactParts | null {
  const parts = jws.split('.')
  if (parts.length !== 3)
    return null
  const [h, p, s] = parts
  try {
    return {
      head: JSON.parse(new TextDecoder().decode(base64url.decode(h))),
      payload: JSON.parse(new TextDecoder().decode(base64url.decode(p))),
      signingInput: new TextEncoder().encode(`${h}.${p}`),
      signature: base64url.decode(s),
    }
  }
  catch {
    return null
  }
}

/** Сходится ли подпись с указанным ключом. Некорректный ключ — тоже «не сходится». */
async function signatureMatches(parts: CompactParts, publicKey: string): Promise<boolean> {
  if (parts.signature.length !== 64)
    return false
  const { PublicKey, Signature } = await import('@wharfkit/antelope')
  const normalized = normalizeLowS(parts.signature)
  try {
    const sig = Signature.from({ type: 'K1', r: normalized.slice(0, 32), s: normalized.slice(32, 64), recid: 0 })
    return sig.verifyMessage(parts.signingInput, PublicKey.from(publicKey))
  }
  catch {
    return false
  }
}

/**
 * Офлайн-проверка удостоверения пайщика: ни одного обращения к сети.
 *
 * Проверяющий начинает с корневого ключа АНО, вшитого в приложение, и идёт по
 * цепочке заверений, которую удостоверение несёт внутри себя: каждое следующее
 * заверение обязано быть подписано ключом, который признало предыдущее. Последнее
 * звено называет кооператив и его ключ — им и должно быть подписано само
 * удостоверение.
 *
 * Почему цепочка едет внутри, а не читается из блокчейна: проверяющий на входе,
 * с планшетом без сети, обязан получить ответ здесь и сейчас. Заодно это снимает
 * прежнюю дыру — раньше ключи звеньев читались из цепи по именам, взятым из
 * самого предъявленного удостоверения, и любой кооператив мог поставить корень
 * первым звеном своей цепи: ключи-то настоящие. Теперь имя ничего не решает,
 * решает подпись.
 *
 * Отзыв офлайн не проверяется: подписанное не отзывается, и защитой служит
 * короткий срок — час у удостоверения, месяц у заверения кооператива.
 */
export async function verifyOffline(certificate: string, options: VerifyOfflineOptions = {}): Promise<VerifyOfflineResult> {
  const cert = splitCompact(certificate)
  if (!cert)
    return { valid: false, reason: 'malformed_certificate' }
  if (cert.head.alg !== 'ES256K')
    return { valid: false, reason: 'unsupported_alg' }

  const exp = cert.payload.exp
  const coopname = cert.payload.coopname
  if (typeof exp !== 'number' || typeof coopname !== 'string')
    return { valid: false, reason: 'malformed_certificate' }

  const now = options.now ?? Date.now()
  const nowSeconds = Math.floor(now / 1000)
  if (nowSeconds >= exp)
    return { valid: false, reason: 'expired' }

  if (options.minSchemaVersion !== undefined
    && compareSchemaVersions(String(cert.payload.claim_schema_version ?? '0'), options.minSchemaVersion) < 0) {
    return { valid: false, reason: 'unsupported_schema_version' }
  }

  const anchorKey = options.trustAnchor ?? TRUST_ANCHOR_ANO_CERT_PUBKEY
  if (!anchorKey)
    return { valid: false, reason: 'no_trust_anchor' }

  const endorsements = cert.payload.trust_chain
  if (!Array.isArray(endorsements) || endorsements.length === 0)
    return { valid: false, reason: 'not_endorsed' }

  // Идём от корня: доверенный ключ на каждом шаге — тот, который признало
  // предыдущее заверение. Первый ключ вшит, и подменить его предъявитель не может.
  let trustedKey = anchorKey
  let expectedIssuer = options.trustAnchorAccount ?? 'ano'
  const chain: string[] = [expectedIssuer]

  for (const raw of endorsements) {
    if (typeof raw !== 'string')
      return { valid: false, reason: 'malformed_certificate' }

    const link = splitCompact(raw)
    if (!link || link.head.alg !== 'ES256K' || link.head.typ !== ENDORSEMENT_TYP)
      return { valid: false, reason: 'endorsement_invalid' }

    if (link.payload.iss !== expectedIssuer)
      return { valid: false, reason: 'broken_chain' }

    const subject = link.payload.sub
    const grantedKey = link.payload.cert
    if (typeof subject !== 'string' || typeof grantedKey !== 'string')
      return { valid: false, reason: 'endorsement_invalid' }

    if (options.chainId !== undefined && link.payload.chain_id !== options.chainId)
      return { valid: false, reason: 'foreign_chain' }

    const linkExp = link.payload.exp
    if (typeof linkExp !== 'number' || nowSeconds >= linkExp)
      return { valid: false, reason: 'endorsement_expired' }

    const linkIat = link.payload.iat
    if (typeof linkIat === 'number' && linkIat - CLOCK_SKEW_SECONDS > nowSeconds)
      return { valid: false, reason: 'endorsement_invalid' }

    if (!(await signatureMatches(link, trustedKey)))
      return { valid: false, reason: 'endorsement_invalid' }

    trustedKey = grantedKey
    expectedIssuer = subject
    chain.push(subject)
  }

  // Удостоверение обязано быть выпущено тем, кем цепочка закончилась. Иначе
  // предъявитель приложил бы чужую, настоящую цепочку к своему удостоверению.
  if (expectedIssuer !== coopname)
    return { valid: false, reason: 'issuer_mismatch' }

  if (!(await signatureMatches(cert, trustedKey)))
    return { valid: false, reason: 'signature_mismatch' }

  return { valid: true, issuer: coopname, chain }
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

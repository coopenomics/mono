/**
 * Помощники внешних тестов CoopID: верификация личности пайщика, журнал сверок
 * и второй фактор. Здесь только действия и чтение через API — ассерты живут в
 * тестах.
 *
 * Уровни верификации пайщик видит в своём удостоверении (getMyCertificate):
 * это тот же вывод уровней, что отдают мутации верификации, только в форме
 * claim'а `verification_types`, как его получает проверяющая сторона.
 */
import crypto from 'node:crypto'
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { type GqlResponse, gql, gqlRaw } from '../core/client'
import { CHAIRMAN } from '../core/roles'

/** Кооперативный участок стенда: председатель — chairkrg. */
export const BRANCH = 'krg'

/** Коды отказа по входу (гость без токена). */
export const AUTH_CODES = new Set(['401', 'UNAUTHENTICATED', 'KIT_USER_NOT_AUTHORIZED'])

// ── Снимки сверки ──────────────────────────────────────────────────────────

/** Картинка 1×1 PNG. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

export interface PhotoInput {
  content_base64: string
  mime_type: string
  size_bytes: number
  checksum_sha256: string
  original_filename?: string | null
}

/**
 * Снимок сверки: PNG с уникальным хвостом после IEND — у каждого снимка своя
 * контрольная сумма, а значит и свой ключ в хранилище.
 */
export function photo(overrides: Partial<PhotoInput> = {}): PhotoInput {
  const body = Buffer.concat([PNG_1X1, crypto.randomBytes(16)])
  return {
    content_base64: body.toString('base64'),
    mime_type: 'image/png',
    size_bytes: body.byteLength,
    checksum_sha256: crypto.createHash('sha256').update(body).digest('hex'),
    original_filename: 'passport.png',
    ...overrides,
  }
}

export function photos(n: number): PhotoInput[] {
  return Array.from({ length: n }, () => photo())
}

// ── Верификация ────────────────────────────────────────────────────────────

export const LEVEL_FIELDS = 'type status source attested_by attested_in verified_at'

export interface Level {
  type: string
  status: string
  source: string
  attested_by: string | null
  attested_in: string | null
  verified_at: string
}

const VERIFY = `mutation($d:VerifyParticipantOnsiteInput!){ verifyParticipantOnsite(data:$d){ ${LEVEL_FIELDS} } }`
const UNVERIFY = `mutation($d:UnverifyParticipantInput!){ unverifyParticipant(data:$d){ ${LEVEL_FIELDS} } }`

export const IDENTITY_FIELDS = `username type full_name birthdate passport_series passport_number passport_issued_by
  passport_issued_at passport_code full_address inn ogrn representative_name representative_position representative_based_on`
const IDENTITY = `query($d:ParticipantIdentityForVerificationInput!){ participantIdentityForVerification(data:$d){ ${IDENTITY_FIELDS} } }`

/** Сверка личности на участке (braname) либо советом (braname не указан). */
export function verifyOnsite(token: string | null, username: string, opts: { braname?: string, photos?: PhotoInput[] } = {}): Promise<GqlResponse<{ verifyParticipantOnsite: Level[] }>> {
  const d: Record<string, unknown> = { username }
  if (opts.braname !== undefined)
    d.braname = opts.braname
  if (opts.photos !== undefined)
    d.photos = opts.photos
  return gqlRaw(token, VERIFY, { d })
}

/** Сверка, которая обязана пройти: уровни пайщика после неё. */
export async function verifyOk(token: string, username: string, opts: { braname?: string, photos?: PhotoInput[] } = {}): Promise<Level[]> {
  const r = await verifyOnsite(token, username, opts)
  if (r.errors.length)
    throw new Error(`verifyParticipantOnsite ${username}: ${r.errors.map(e => `[${e.code}] ${e.message}`).join('; ')}`)
  return r.data!.verifyParticipantOnsite
}

export function unverify(token: string | null, username: string): Promise<GqlResponse<{ unverifyParticipant: Level[] }>> {
  return gqlRaw(token, UNVERIFY, { d: { username } })
}

export function identityFor(token: string | null, username: string, braname?: string): Promise<GqlResponse<{ participantIdentityForVerification: Record<string, any> }>> {
  return gqlRaw(token, IDENTITY, { d: braname === undefined ? { username } : { username, braname } })
}

// ── Удостоверение ──────────────────────────────────────────────────────────

export interface CertLevel {
  type: string
  source: string
  verified_at: string
  attested_by?: string
  attested_in?: string
}

/** Уровни из удостоверения пайщика (claim `verification_types`). */
export async function certificateLevels(who: Who): Promise<CertLevel[]> {
  const d = await gql<any>(await tokenOf(who), 'query{ getMyCertificate{ participant_certificate } }')
  const jws = String(d.getMyCertificate.participant_certificate)
  const payload = JSON.parse(Buffer.from(jws.split('.')[1], 'base64url').toString('utf8'))
  return (payload.verification_types ?? []) as CertLevel[]
}

/** Верификации в строке аккаунта регистратора — как её отдаёт API. */
export async function chainVerifications(token: string, username: string): Promise<{ procedure: string, is_verified: boolean, verificator: string, notice: string }[]> {
  const d = await gql<any>(token, `query($d:GetAccountInput!){ getAccount(data:$d){ user_account{ verifications{ procedure is_verified verificator notice } } } }`, { d: { username } })
  return d.getAccount?.user_account?.verifications ?? []
}

// ── Журнал сверок ──────────────────────────────────────────────────────────

export const REVIEW_FIELDS = 'id username procedure braname verificator status photos_count decided_by decision_reason decided_at created_at'

export interface Review {
  id: string
  username: string
  procedure: string
  braname: string
  verificator: string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Revoked'
  photos_count: number
  decided_by: string | null
  decision_reason: string | null
  decided_at: string | null
  created_at: string
}

export const REVIEWS = `query($d:VerificationReviewsInput){ verificationReviews(data:$d){ ${REVIEW_FIELDS} } }`
export const REVIEW_PHOTOS = `query($d:VerificationReviewPhotosInput!){ verificationReviewPhotos(data:$d){ storage_key mime_type size_bytes read_url } }`
export const APPROVE = `mutation($d:ApproveVerificationInput!){ approveVerification(data:$d){ ${REVIEW_FIELDS} } }`
export const REJECT = `mutation($d:RejectVerificationInput!){ rejectVerification(data:$d){ ${REVIEW_FIELDS} } }`

/** Записи журнала по пайщику, от новой к старой (читает председатель). */
export async function reviewsOf(username: string): Promise<Review[]> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), REVIEWS, { d: { username, limit: 200 } })
  const rows = (d.verificationReviews as Review[]).filter(r => r.username === username)
  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
}

/** Единственная запись журнала по свежему пайщику. */
export async function onlyReviewOf(username: string): Promise<Review> {
  const rows = await reviewsOf(username)
  if (rows.length !== 1)
    throw new Error(`по ${username} ожидалась одна запись журнала, найдено ${rows.length}`)
  return rows[0]
}

// ── Второй фактор ──────────────────────────────────────────────────────────

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(secret: string): Buffer {
  let bits = ''
  for (const ch of secret.toUpperCase().replace(/=+$/, '').replace(/\s/g, ''))
    bits += BASE32.indexOf(ch).toString(2).padStart(5, '0')
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

/** Код приложения-аутентификатора (RFC 6238: HMAC-SHA1, шаг 30 с, 6 цифр). */
export function totpCode(secret: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(nowSec / 30)))
  const digest = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0F
  const binary = ((digest[offset] & 0x7F) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3]
  return String(binary % 1_000_000).padStart(6, '0')
}

/** Пайщик подключает приложение-аутентификатор: секрет и первый код. */
export async function enrollTotp(token: string): Promise<string> {
  const e = await gql<any>(token, 'mutation{ enrollTwoFactor{ secret otpauth_uri } }')
  const secret = e.enrollTwoFactor.secret as string
  await gql(token, 'mutation($d:TwoFactorCodeInput!){ activateTwoFactor(data:$d) }', { d: { code: totpCode(secret) } })
  return secret
}

export const LOGIN_FACTORS = 'query{ getLoginFactors{ totp_enrolled totp_enabled } }'
export const PARTICIPANT_LOGIN_SECURITY = 'query($d:ResetParticipantTwoFactorInput!){ getParticipantLoginSecurity(data:$d){ totp_enrolled totp_enabled } }'
export const RESET_TWO_FACTOR = 'mutation($d:ResetParticipantTwoFactorInput!){ resetParticipantTwoFactor(data:$d) }'

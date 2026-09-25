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
import { sealedVault } from './coopid-b.helpers'
import ecc from 'eosjs-ecc'
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { type GqlResponse, gql, gqlRaw } from '../core/client'
import { signDocument } from '../core/documents'
import { API_URL, CHAIN_URL, COOP } from '../core/env'
import { CHAIRMAN } from '../core/roles'
import { waitFor } from '../core/wait'
import { totp } from '../core/totp'

/** Кооперативный участок стенда: председатель — chairkrg. */
export const BRANCH = 'krg'

/** Коды отказа по входу (гость без токена). */

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




/** Пайщик подключает приложение-аутентификатор: секрет и первый код. */
export async function enrollTotp(token: string): Promise<string> {
  const e = await gql<any>(token, 'mutation{ enrollTwoFactor{ secret otpauth_uri } }')
  const secret = e.enrollTwoFactor.secret as string
  await gql(token, 'mutation($d:TwoFactorCodeInput!){ activateTwoFactor(data:$d) }', { d: { code: totp(secret) } })
  return secret
}

export const LOGIN_FACTORS = 'query{ getLoginFactors{ totp_enrolled totp_enabled } }'
export const PARTICIPANT_LOGIN_SECURITY = 'query($d:ResetParticipantTwoFactorInput!){ getParticipantLoginSecurity(data:$d){ totp_enrolled totp_enabled } }'
export const RESET_TWO_FACTOR = 'mutation($d:ResetParticipantTwoFactorInput!){ resetParticipantTwoFactor(data:$d) }'

// ── Стол заказов для свежего пайщика ───────────────────────────────────────

/** Шаблон оферты ЦПП «Стол заказов» (cooptypes 1102.MarketplaceOffer). */
const MARKETPLACE_OFFER_REGISTRY_ID = 1102

/**
 * Свежий пайщик подключается к Столу заказов так, как это делает его стол:
 * инстанс оферты → подпись ключом → marketplaceSignOnboardingOffer. Подпись
 * программы доходит до зеркала из wallet::users с отставанием на блок.
 */
export async function joinMarketplace(who: Who, token: string): Promise<void> {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = await gql<any>(token, `mutation($i:GenerateAnyDocumentInput!){
    generateDocument(input:$i){ full_title html hash meta binary }
  }`, {
    i: {
      data: {
        registry_id: MARKETPLACE_OFFER_REGISTRY_ID,
        coopname: COOP,
        username: who.account,
        marketplace_agreement_number: crypto.randomBytes(8).toString('hex').toUpperCase(),
        marketplace_agreement_created_at: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`,
      },
    },
  })
  const signed = await signDocument(who.wif, d.generateDocument, who.account, 1)
  await gql(token, `mutation($i:MarketplaceSignOnboardingOfferInput!){
    marketplaceSignOnboardingOffer(input:$i){ requires_gate }
  }`, { i: { document: signed } })
  await waitFor(async () => {
    const s = (await gql<any>(token, 'query{ marketplaceOnboardingState{ requires_gate } }')).marketplaceOnboardingState
    return s.requires_gate === false ? true : null
  }, { timeoutMs: 60_000, intervalMs: 1_000, label: `подпись оферты ${who.account}` })
}

// ── Пароль пайщика ─────────────────────────────────────────────────────────

/**
 * Пайщик ставит пароль так, как это делает его стол при переходе на вход по
 * паролю (REST `coop/migration`, SDK migrate): подпись ключом канонического
 * сообщения с хэшем пароля и зашифрованный блоб ключа. Это подготовка
 * состояния — факторы входа надстраиваются только над паролем. Сервер блоб не
 * расшифровывает, поэтому содержимое блоба в тесте условное.
 *
 * После установки пароля вход подписью закрыт: токен пайщика берётся ДО.
 */
export async function setPassword(who: Who): Promise<Response> {
  const info: any = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
  const ts = info.head_block_time as string
  const password = `Api-tests-${crypto.randomBytes(6).toString('hex')}1!`
  const pwHash = crypto.createHash('sha256').update(password, 'utf8').digest('hex')
  const message = JSON.stringify({ pw_hash: pwHash, purpose: 'coopid-key-migration', ts })
  const signature = ecc.sign(message, who.wif)
  return fetch(`${API_URL.replace(/\/v1\/graphql\/?$/, '')}/coop/migration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: who.email,
      timestamp: ts,
      signature,
      new_password: password,
      vault: sealedVault(),
    }),
  })
}

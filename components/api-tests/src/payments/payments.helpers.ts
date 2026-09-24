/**
 * Помощники платежей ядра (gateway) и реквизитов пайщика: только действия и
 * чтение через API — ассерты живут в тестах.
 */
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import type { Who } from '../core'
import { CHAIN_URL, REPO_ROOT, gql } from '../core'

/** Поля платежа, которые читают тесты. */
export const PAYMENT_FIELDS = 'id hash username status type direction quantity symbol message blockchain_data can_change_status is_final payment_details{ amount_plus_fee amount_without_fee data }'

export const CREATE_DEPOSIT = `mutation($d:CreateDepositPaymentInput!){ createDepositPayment(data:$d){ ${PAYMENT_FIELDS} } }`
export const SET_STATUS = `mutation($d:SetPaymentStatusInput!){ setPaymentStatus(data:$d){ ${PAYMENT_FIELDS} } }`
export const GET_PAYMENTS = `query($d:PaymentFiltersInput,$o:PaginationInput){ getPayments(data:$d, options:$o){ totalCount items{ ${PAYMENT_FIELDS} } } }`

export async function createDeposit(token: string, username: string, quantity: number, symbol = 'RUB'): Promise<any> {
  const d = await gql<any>(token, CREATE_DEPOSIT, { d: { username, quantity, symbol } })
  return d.createDepositPayment
}

export async function listPayments(token: string, filters: Record<string, unknown>): Promise<any[]> {
  const d = await gql<any>(token, GET_PAYMENTS, { d: filters, o: { page: 1, limit: 100, sortOrder: 'DESC' } })
  return d.getPayments.items
}

/** Платёж по хэшу глазами того, кто спрашивает (null — не видно). */
export async function paymentByHash(token: string, hash: string, username?: string): Promise<any | null> {
  const items = await listPayments(token, username ? { hash, username } : { hash })
  return items.find(p => p.hash === hash) ?? null
}

// ── Реквизиты ──────────────────────────────────────────────────────────────

export const METHOD_FIELDS = 'method_id username method_type is_default data{ __typename ... on SbpAccount{ phone } ... on BankAccount{ bank_name account_number currency details{ bik corr } } }'

export const ADD_METHOD = `mutation($d:AddPaymentMethodInput!){ addPaymentMethod(data:$d){ ${METHOD_FIELDS} } }`
export const UPDATE_BANK = `mutation($d:UpdateBankAccountInput!){ updateBankAccount(data:$d){ ${METHOD_FIELDS} } }`
export const DELETE_METHOD = 'mutation($d:DeletePaymentMethodInput!){ deletePaymentMethod(data:$d) }'
export const GET_METHODS = `query($d:GetPaymentMethodsInput){ getPaymentMethods(data:$d){ items{ ${METHOD_FIELDS} } } }`

export function randomPhone(): string {
  return `+79${String(crypto.randomInt(0, 1_000_000_000)).padStart(9, '0')}`
}

export function bankAccount(bankName: string): Record<string, unknown> {
  const digits = (n: number) => Array.from({ length: n }, () => crypto.randomInt(0, 10)).join('')
  return {
    account_number: `40817810${digits(12)}`,
    bank_name: bankName,
    currency: 'RUB',
    details: { bik: `04452${digits(4)}`, corr: `30101810${digits(12)}` },
  }
}

export async function addSbpMethod(token: string, username: string, phone = randomPhone()): Promise<any> {
  const d = await gql<any>(token, ADD_METHOD, { d: { username, is_default: true, sbp_data: { phone } } })
  return d.addPaymentMethod
}

export async function methodsOf(token: string, username: string): Promise<any[]> {
  const d = await gql<any>(token, GET_METHODS, { d: { username, page: 1, limit: 100, sortOrder: 'ASC' } })
  return d.getPaymentMethods.items
}

// ── Чеки об оплате ─────────────────────────────────────────────────────────

export const PAYMENT_FILE_FIELDS = 'id coopname payment_hash kind checksum_sha256 mime_type size_bytes storage_key original_filename uploaded_by_username read_url'
export const UPLOAD_PROOF = `mutation($d:UploadPaymentProofInput!){ uploadPaymentProof(data:$d){ ${PAYMENT_FILE_FIELDS} } }`
export const PAYMENT_PROOFS = 'query($c:String!,$h:String!){ paymentProofs(coopname:$c, payment_hash:$h){ id payment_hash kind checksum_sha256 uploaded_by_username } }'
export const PAYMENT_FILE = `query($id:Int!){ paymentFile(id:$id){ ${PAYMENT_FILE_FIELDS} } }`

/** Картинка чека: заголовок PNG и случайный хвост — содержимое каждого вызова своё (чек-дубль сервер отвергает). */
export function proofContent(): { content_base64: string, size_bytes: number, checksum_sha256: string } {
  const body = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), crypto.randomBytes(48)])
  return {
    content_base64: body.toString('base64'),
    size_bytes: body.byteLength,
    checksum_sha256: crypto.createHash('sha256').update(body).digest('hex'),
  }
}

// ── Пайщик с заданным началом имени ────────────────────────────────────────

/**
 * Новый пайщик, чьё имя начинается с имени другого (ekaterina → ekaterinaXYZ).
 * Нужен проверке точного отбора платежей по имени: поиск по подстроке отдавал
 * вместе с платежами пайщика платежи тех, чьё имя содержит его имя (3f22ba9d792).
 * Заводится тем же скриптом стенда, что freshMember (core/participants.ts), —
 * там имя всегда случайное.
 */
export function memberNamedAfter(base: string): Who {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz12345'
  const bytes = crypto.randomBytes(12)
  let account = base
  for (let i = 0; account.length < 12; i++)
    account += alphabet[bytes[i] % alphabet.length]
  if (account === base)
    throw new Error(`имя ${base} уже длиной 12 — продолжить его нельзя`)
  const email = `${account}@api-tests.coop`
  const r = spawnSync(
    'pnpm',
    ['--filter', '@coopenomics/boot', 'exec', 'esno', 'src/scripts/add-plain-participant.ts', account, email, 'Тест', 'Внешнийслой', 'Проверочный'],
    { cwd: REPO_ROOT, env: { ...process.env, CHAIN_URL }, encoding: 'utf8' },
  )
  if (r.status !== 0)
    throw new Error(`add-plain-participant ${account} упал:\n${(r.stderr || r.stdout).slice(-2000)}`)
  const last = (r.stdout || '').split('\n').filter(l => l.trim()).pop() ?? ''
  const j = JSON.parse(last)
  if (!j.wif)
    throw new Error(`add-plain-participant ${account} не вернул ключ`)
  return { account, email, wif: j.wif }
}

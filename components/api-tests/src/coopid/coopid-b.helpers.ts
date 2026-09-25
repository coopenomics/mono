/**
 * Помощники внешних тестов CoopID (подтверждение почты, восстановление доступа,
 * клиент card.coop). Только действия и чтение — проверки живут в тестах.
 *
 * Три вещи здесь сверх общего ядра:
 *  - адрес клиента. Лимиты открытых ручек (коды почты, регистрация,
 *    восстановление) считаются по IP, а все файлы прогона ходят с одного
 *    адреса. Стенд слушает контроллер напрямую, без nginx, и доверяет
 *    X-Forwarded-For (`trust proxy`) — каждый тест называется своим адресом и
 *    не выедает чужой лимит. На узлах кооперативов внешний nginx этот
 *    заголовок затирает (см. components/controller/src/index.ts).
 *  - почтовый ящик. Письма на стенде никуда не уходят; вне production
 *    контроллер печатает код подтверждения почты в свой журнал, и тест читает
 *    его оттуда — как пайщик читал бы письмо. База для этого не трогается.
 *  - внутренний контур claims. Его зовёт authentik с общим секретом
 *    `authentik_webhook_token`; тест говорит от его лица тем же секретом из
 *    каталога секретов стенда.
 */
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { GqlError, GqlResponse } from '../core/client'
import { ApiError, gqlRaw } from '../core/client'
import { API_URL, COOP, REPO_ROOT } from '../core/env'
import { tokenOf } from '../core/auth'
import { randomAccount, registerCandidate as registerCoreCandidate, type Candidate } from '../core/participants'
import { totp } from '../core/totp'
import { CHAIRMAN } from '../core/roles'
import { waitFor } from '../core/wait'

/** Корень HTTP контроллера: REST-ручки CoopID живут рядом с /v1/graphql. */
export const API_ORIGIN = API_URL.replace(/\/v1\/graphql\/?$/, '')

/** Адрес клиента под тест: 10.x.y.z из случайных байтов. */
export function uniqueIp(): string {
  const b = crypto.randomBytes(3)
  return `10.${b[0]}.${b[1]}.${Math.max(1, b[2])}`
}

/** Незнакомый стенду адрес почты (строчными — как его нормализует сервер). */
export function uniqueEmail(prefix = 'ev'): string {
  return `${randomAccount(prefix)}@api-tests.coop`
}

/** GraphQL от имени клиента с заданным адресом (X-Forwarded-For). */
export async function gqlFrom<T = any>(ip: string, token: string | null, query: string, variables?: unknown): Promise<GqlResponse<T>> {
  return gqlRaw<T>(token, query, variables, { 'X-Forwarded-For': ip })
}

/** То же, но без ошибок — иначе ApiError. */
export async function gqlOkFrom<T = any>(ip: string, token: string | null, query: string, variables?: unknown): Promise<T> {
  const r = await gqlFrom<T>(ip, token, query, variables)
  if (r.errors.length)
    throw new ApiError(r.errors, r.status)
  return r.data as T
}

export interface RestResponse {
  status: number
  body: any
  text: string
}

/**
 * Зашифрованный блоб хранилища ключа — формы, которую присылает клиент при
 * переносе и восстановлении. Содержимое случайное: сервер его не расшифровывает.
 */
export function sealedVault(): Record<string, string> {
  const b64 = (n: number) => crypto.randomBytes(n).toString('base64url')
  return { cipher_version: 'v1', kdf_version: 'v1', salt: b64(16), nonce: b64(12), ciphertext: b64(64), auth_tag: b64(16) }
}

/** REST-ручка контроллера (CoopID живёт на REST: /coop/...). */
export async function rest(method: 'GET' | 'POST', route: string, opts: { ip?: string, body?: unknown, headers?: Record<string, string> } = {}): Promise<RestResponse> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (opts.ip)
    headers['X-Forwarded-For'] = opts.ip
  if (opts.body !== undefined)
    headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API_ORIGIN}${route}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const text = await res.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  }
  catch {
    body = null
  }
  return { status: res.status, body, text }
}

// ── Подтверждение почты ────────────────────────────────────────────────────

export const REQUEST_EMAIL_CODE = `mutation($d:RequestEmailVerificationInputDTO!){
  requestEmailVerification(data:$d){ cooldown_seconds expires_seconds }
}`

export const CONFIRM_EMAIL_CODE = `mutation($d:ConfirmEmailVerificationInputDTO!){
  confirmEmailVerification(data:$d)
}`

/** Тип уведомления «код подтверждения почты» (@coopenomics/notifications). */
export const WF_EMAIL_VERIFICATION = 'verifikatsiya-email'
/** Тип уведомления «ссылка восстановления доступа». */
export const WF_RECOVERY = 'vosstanovlenie-dostupa'

export async function requestEmailCode(ip: string, email: string): Promise<GqlResponse<any>> {
  return gqlFrom(ip, null, REQUEST_EMAIL_CODE, { d: { email } })
}

export async function confirmEmailCode(ip: string, email: string, code: string): Promise<GqlResponse<any>> {
  return gqlFrom(ip, null, CONFIRM_EMAIL_CODE, { d: { email, code } })
}

/** Журнал контейнера контроллера с момента `since` (docker compose стенда). */
function controllerLog(since: Date): string {
  const r = spawnSync(
    'docker',
    ['compose', 'logs', '--no-color', '--since', since.toISOString(), 'coopback'],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  )
  if (r.status !== 0)
    throw new Error(`docker compose logs coopback упал: ${(r.stderr || '').slice(-500)}`)
  return `${r.stdout}\n${r.stderr}`
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Код из «письма»: последняя строка журнала контроллера с кодом на этот адрес.
 * `since` — момент перед запросом кода (с запасом на расхождение часов).
 */
export async function mailboxCode(email: string, since: Date): Promise<string> {
  const re = new RegExp(`код подтверждения почты для ${escapeRe(email.trim().toLowerCase())}: (\\d{6})`, 'g')
  const from = new Date(since.getTime() - 5_000)
  return waitFor(async () => {
    const found = [...controllerLog(from).matchAll(re)]
    return found.length ? found[found.length - 1][1] : null
  }, { timeoutMs: 30_000, intervalMs: 1_000, label: `код подтверждения для ${email} в журнале контроллера` })
}

/** Запросить код и прочитать его из «письма». */
export async function requestAndReadCode(ip: string, email: string): Promise<string> {
  const since = new Date()
  const r = await requestEmailCode(ip, email)
  if (r.errors.length)
    throw new ApiError(r.errors, r.status)
  return mailboxCode(email, since)
}

/** Неверный код той же длины, заведомо отличный от верного. */
export function wrongCode(code: string): string {
  return code.split('').map(d => String((Number(d) + 1) % 10)).join('')
}

// ── Журнал уведомлений (стол председателя) ────────────────────────────────

export interface OutboxRow {
  id: string
  workflowId: string
  channel: string
  recipientSubscriberId: string
  recipientUsername: string | null
  status: string
  createdAt: string
}

const NOTIFICATIONS = `query($f:NotificationsFilterInput!,$p:PaginationInput!){
  getNotifications(filter:$f, pagination:$p){
    totalCount
    items{ id workflowId channel recipientSubscriberId recipientUsername status createdAt }
  }
}`

/** Письма в очереди Центра уведомлений по типу и получателю — глазами председателя. */
export async function outbox(filter: { workflowId: string, recipientSubscriberId?: string }, limit = 50): Promise<{ totalCount: number, items: OutboxRow[] }> {
  const d = await gqlOkFrom<any>(uniqueIp(), await tokenOf(CHAIRMAN), NOTIFICATIONS, {
    f: { coopname: COOP, ...filter },
    p: { page: 1, limit, sortOrder: 'DESC' },
  })
  return d.getNotifications
}

/** Адресат письма, у которого ещё нет учётной записи: синтетический подписчик. */
export function emailSubscriber(email: string): string {
  return `email:${email.trim().toLowerCase()}`
}

// ── Регистрация кандидата ──────────────────────────────────────────────────

export type { Candidate }

/**
 * Кандидат в пайщики: учётная запись, созданная открытой регистрацией
 * (шаг рабочего стола registerAccount), без записи в цепи. У него есть
 * адрес Центра уведомлений (subscriber_id) и токен доступа.
 */
export async function registerCandidate(ip: string, email: string): Promise<Candidate> {
  return registerCoreCandidate({ prefix: 'cb', email, ip })
}

const ACCOUNT_EMAIL = `query($d:GetAccountInput!){ getAccount(data:$d){ username provider_account{ email is_email_verified } } }`

/** Подтверждена ли почта пайщика — глазами председателя. */
export async function isEmailVerified(username: string): Promise<boolean> {
  const d = await gqlOkFrom<any>(uniqueIp(), await tokenOf(CHAIRMAN), ACCOUNT_EMAIL, { d: { username } })
  return Boolean(d.getAccount.provider_account.is_email_verified)
}

// ── Второй фактор (TOTP, RFC 6238: SHA1, 6 цифр, шаг 30 с) ─────────────────



// ── Внутренний контур claims ──────────────────────────────────────────────

/** Секрет authentik→контроллер из каталога секретов стенда. */
export function webhookToken(): string {
  const file = path.join(REPO_ROOT, 'infra/coopid/secrets/authentik_webhook_token')
  const token = fs.readFileSync(file, 'utf8').trim()
  if (!token)
    throw new Error(`пустой ${file}: стенд без секретов CoopID`)
  return token
}

export async function participantClaims(username: string | null, token: string | null): Promise<RestResponse> {
  const q = username === null ? '' : `?username=${encodeURIComponent(username)}`
  const headers: Record<string, string> = {}
  if (token !== null)
    headers['x-authentik-webhook-token'] = token
  return rest('GET', `/coop/internal/participant-claims${q}`, { headers })
}

/** Полезная нагрузка JWT без проверки подписи. */
export function jwtPayload(jwt: string): any {
  const part = jwt.split('.')[1]
  return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
}

export { totp }

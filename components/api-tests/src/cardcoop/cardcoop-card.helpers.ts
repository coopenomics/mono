/**
 * Помощники внешних тестов «Карты кооператора» (расширение cardcoop).
 *
 * Сеть карт (card.coop) — другой узел, на стенде его нет. Тест играет её роль
 * ровно в той мере, в какой её роль видна кооперативу снаружи:
 *
 * - публикует ключ подписи уведомлений в цепи — разрешением `ano@cardcoop`, как
 *   это делает сама сеть (аккаунт `ano` делегирует active кооперативу стенда);
 * - подписывает уведомления этим ключом и шлёт их в REST-приёмник расширения.
 *
 * Адрес сети в настройках расширения тест переводит на заведомо недоступный:
 * иначе стенд доставлял бы тестовые свидетельства на боевой id.card.coop, а их
 * исход (принят / отвергнут / не доставлен) зависел бы от чужого узла. С
 * недоступным адресом исход один — свидетельство остаётся в ожидании доставки.
 * Всё, что требует ответа сети (принятие свидетельства, JWKS грантов), на
 * стенде непроверяемо и тестами не изображается.
 */
import crypto from 'node:crypto'
import { Numeric } from 'eosjs'
import ecc from 'eosjs-ecc'
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { rpc, tableRows, transact } from '../core/chain'
import { gql } from '../core/client'
import { API_URL, COOP } from '../core/env'
import { CHAIRMAN } from '../core/roles'
import { waitFor } from '../core/wait'
import { COOP_SIGNER } from '../core/wallet'

/** Корень REST-ручек контроллера: адрес GraphQL без `/v1/graphql`. */
export const BASE_URL = API_URL.replace(/\/v1\/graphql\/?$/, '')

/** Приёмник уведомлений сети карт. */
export const WEBHOOK_URL = `${BASE_URL}/v1/extensions/cardcoop/webhooks`

/** Ручка выдачи анкеты по гранту. */
export const DISCLOSURE_URL = `${BASE_URL}/v1/extensions/cardcoop/disclosures`

/**
 * Адрес сети карт на время тестов: внутри контейнера контроллера порт 9 закрыт,
 * соединение отвергается сразу. Косая черта в конце намеренная — адрес выпуска
 * карты обязан собираться без двойной черты.
 */
export const UNREACHABLE_NETWORK = 'http://127.0.0.1:9/'

/** Аккаунт сети в цепи и разрешение с ключом подписи уведомлений. */
export const NETWORK_ACCOUNT = 'ano'
export const WEBHOOK_PERMISSION = 'cardcoop'

export const MY_CARD = 'query{ cardcoopMyCard{ issued cardNumber state memberSince enterUrl } }'

export interface MyCard {
  issued: boolean
  cardNumber: string | null
  state: string | null
  memberSince: string | null
  enterUrl: string
}

export async function myCard(token: string): Promise<MyCard> {
  const d = await gql<{ cardcoopMyCard: MyCard }>(token, MY_CARD)
  return d.cardcoopMyCard
}

// ── Настройки расширения ─────────────────────────────────────────────────

/**
 * Переводит расширение на недоступный адрес сети. Идемпотентно: если адрес уже
 * стоит, расширение не перезапускается. Перезапуск идёт фоном после ответа
 * мутации, поэтому ждём, пока новый адрес станет виден в `cardcoopMyCard`.
 *
 * Обратно адрес не возвращается намеренно: возврат перезапустил бы расширение
 * с боевым адресом, и фоновая публикация ключа сети могла бы перетереть ключ,
 * который публикует следующий файл тестов.
 */
export async function isolateFromNetwork(probe: string): Promise<void> {
  const chairman = await tokenOf(CHAIRMAN)
  const d = await gql<any>(chairman, 'query($d:GetExtensionsInput){ getExtensions(data:$d){ name enabled config } }', { d: { name: 'cardcoop' } })
  const ext = (d.getExtensions as any[]).find(e => e.name === 'cardcoop')
  if (!ext)
    throw new Error('расширение cardcoop не установлено на стенде')
  const config = { ...(ext.config ?? {}) }
  if (config.api_url !== UNREACHABLE_NETWORK || !ext.enabled) {
    await gql(chairman, 'mutation($d:ExtensionInput!){ updateExtension(data:$d){ name enabled } }', {
      d: { name: 'cardcoop', enabled: true, config: { ...config, api_url: UNREACHABLE_NETWORK } },
    })
  }
  await waitFor(async () => {
    const card = await myCard(probe)
    return card.enterUrl.startsWith(UNREACHABLE_NETWORK.replace(/\/+$/, '')) ? true : null
  }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'расширение cardcoop перезапущено с недоступным адресом сети' })
}

// ── Ключ уведомлений сети в цепи ─────────────────────────────────────────

export interface NetworkKey { wif: string, pub: string }

export async function newKey(): Promise<NetworkKey> {
  const wif = await ecc.randomKey()
  return { wif, pub: ecc.privateToPublic(wif) }
}

/** Ключи разрешения `ano@cardcoop` в цепи; null — разрешения нет. */
export async function webhookPermissionKeys(): Promise<string[] | null> {
  const acc: any = await rpc.get_account(NETWORK_ACCOUNT)
  const perm = (acc.permissions ?? []).find((p: any) => p.perm_name === WEBHOOK_PERMISSION)
  return perm ? (perm.required_auth.keys as any[]).map(k => normalizeKey(k.key)) : null
}

function normalizeKey(key: string): string {
  return Numeric.publicKeyToString(Numeric.stringToPublicKey(key))
}

/**
 * Публикует ключи разрешения так же, как сеть: updateauth от имени `ano`,
 * подписывает кооператив, которому делегирован active. Ключи в полномочии цепь
 * требует упорядоченными по двоичному образу.
 */
export async function publishWebhookKeys(pubs: string[]): Promise<void> {
  const sorted = [...pubs].sort((a, b) =>
    Buffer.compare(Buffer.from(Numeric.stringToPublicKey(a).data), Buffer.from(Numeric.stringToPublicKey(b).data)))
  await transact(COOP_SIGNER, [{
    account: 'eosio',
    name: 'updateauth',
    authorization: [{ actor: NETWORK_ACCOUNT, permission: 'active' }],
    data: {
      account: NETWORK_ACCOUNT,
      permission: WEBHOOK_PERMISSION,
      parent: 'active',
      auth: { threshold: 1, keys: sorted.map(key => ({ key, weight: 1 })), accounts: [], waits: [] },
    },
  }])
  const wanted = sorted.map(normalizeKey).sort().join(',')
  await waitFor(async () => ((await webhookPermissionKeys()) ?? []).sort().join(',') === wanted ? true : null,
    { timeoutMs: 30_000, label: 'ключ уведомлений сети виден в цепи' })
}

/** Снимает разрешение `ano@cardcoop`, если оно есть. */
export async function unpublishWebhookKey(): Promise<void> {
  if (await webhookPermissionKeys() === null)
    return
  await transact(COOP_SIGNER, [{
    account: 'eosio',
    name: 'deleteauth',
    authorization: [{ actor: NETWORK_ACCOUNT, permission: 'active' }],
    data: { account: NETWORK_ACCOUNT, permission: WEBHOOK_PERMISSION },
  }])
  await waitFor(async () => await webhookPermissionKeys() === null ? true : null,
    { timeoutMs: 30_000, label: 'разрешение ano@cardcoop снято в цепи' })
}

// ── Уведомления сети ─────────────────────────────────────────────────────

/**
 * Канонический образ плоского документа (JCS, RFC 8785): ключи по порядку,
 * значения — строки и null. Уведомления сети другого не содержат.
 */
export function canonical(doc: Record<string, unknown>): string {
  return `{${Object.keys(doc).filter(k => doc[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${JSON.stringify(doc[k])}`).join(',')}}`
}

/** Подпись уведомления: sha256 канонического образа, ключ K1 — как у сети. */
export function signNotification(doc: Record<string, unknown>, wif: string): string {
  return ecc.signHash(ecc.sha256(Buffer.from(canonical(doc), 'utf8'), 'hex'), wif)
}

export interface RestResponse { status: number, body: any }

export async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<RestResponse> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const text = await res.text()
  let parsed: any = text
  try {
    parsed = JSON.parse(text)
  }
  catch {}
  return { status: res.status, body: parsed }
}

/** Шлёт уведомление; `signature: null` — без заголовка подписи. */
export async function postWebhook(doc: Record<string, unknown>, signature: string | null): Promise<RestResponse> {
  return postJson(WEBHOOK_URL, doc, signature ? { 'x-cardcoop-signature': signature } : {})
}

/** Подписать и отправить. */
export async function sendSigned(doc: Record<string, unknown>, key: NetworkKey): Promise<RestResponse> {
  return postWebhook(doc, signNotification(doc, key.wif))
}

/** Идентификатор пайщика в токене (`sub`) — его сеть присылает как `external_subject`. */
export function subjectOf(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  return String(payload.sub)
}

/** Уведомление о новой связи карты с кооперативом. */
export function linkCreated(subject: string, cardId: string, cardNumber?: string | null, coopname = COOP): Record<string, unknown> {
  return {
    event: 'link.created',
    card_id: cardId,
    ...(cardNumber !== undefined ? { card_number: cardNumber } : {}),
    coopname,
    external_subject: subject,
    origin: 'api-tests',
    occurred_at: new Date().toISOString(),
    event_id: crypto.randomUUID(),
  }
}

/** Номер карты: шестнадцать цифр, как печатает сеть. */
export function randomCardNumber(): string {
  return Array.from(crypto.randomBytes(16), b => String(b % 10)).join('')
}

// ── Реестр пайщиков цепи ─────────────────────────────────────────────────

/** Дата приёма пайщика по строке `soviet::participants` (UTC, YYYY-MM-DD). */
export async function chainMemberSince(username: string): Promise<string | null> {
  const rows = await tableRows<any>('soviet', COOP, 'participants', { lower: username, upper: username })
  const row = rows.find(r => r.username === username)
  if (!row)
    return null
  const v = String(row.created_at)
  return new Date(/[zZ]$/.test(v) ? v : `${v}Z`).toISOString().slice(0, 10)
}

/**
 * Свежий пайщик виден контроллеру как принятый: он заведён в цепь мимо
 * контроллера, и выпуск свидетельства читает дату приёма через аккаунт.
 */
export async function waitParticipantVisible(who: Who, token: string): Promise<void> {
  await waitFor(async () => {
    const d = await gql<any>(token, 'query($d:GetAccountInput!){ getAccount(data:$d){ participant_account{ created_at } } }', { d: { username: who.account } })
    return d.getAccount?.participant_account?.created_at ? true : null
  }, { timeoutMs: 60_000, intervalMs: 1_000, label: `пайщик ${who.account} виден в реестре` })
}

/** Ждать, пока фоновый выпуск по уведомлению не отразится на карте пайщика. */
export async function waitCard(token: string, check: (c: MyCard) => boolean, label: string): Promise<MyCard> {
  return waitFor(async () => {
    const c = await myCard(token)
    return check(c) ? c : null
  }, { timeoutMs: 30_000, intervalMs: 500, label })
}

/** timing: backoff — фоновая доставка свидетельства в недоступную сеть: пять попыток с паузами 1+2+4+8 c. */
export const DELIVERY_EXHAUSTED_MS = 20_000

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

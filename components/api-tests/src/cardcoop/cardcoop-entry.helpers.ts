/**
 * Помощники внешних тестов карты кооператора (cardcoop.*).
 *
 * Сети card.coop на стенде нет, и заглушки ей тест не подставляет. Снаружи
 * доступны две двери расширения, которые сеть не открывает сама:
 *
 * - уведомления сети (`POST /v1/extensions/cardcoop/webhooks`) — их подпись
 *   проверяется ключом разрешения `ano@cardcoop` ИЗ ЦЕПИ. Тест публикует в цепь
 *   свой ключ (как это делает оператор, `updateauth` по делегированным правам) и
 *   подписывает уведомление им — то есть говорит с кооперативом ровно тем
 *   каналом, каким говорит сеть;
 * - адрес сети в настройках расширения (`updateExtension`, председатель). Для
 *   проверок «сеть недоступна» он переводится на закрытый порт, для «сеть
 *   ответила отказом 4xx» — на узел цепи стенда, который на незнакомый путь
 *   отвечает 404. Исходный адрес возвращается после файла.
 *
 * Проверяемое читается только через API: `cardcoopMyCard` показывает журнал
 * свидетельств и ожидающих связей кооператива.
 */
import crypto from 'node:crypto'
import ecc from 'eosjs-ecc'
import {
  API_URL,
  CHAIRMAN,
  COOP,
  DEFAULT_WIF,
  gql,
  randomAccount,
  tokenOf,
  transact,
  waitFor,
} from '../core'

/** Адрес контроллера без пути GraphQL — у расширения есть REST-ручки. */
export const BACKEND_URL = API_URL.replace(/\/v1\/graphql\/?$/, '')

/** Закрытый порт внутри контейнера контроллера: соединение отвергается сразу. */
export const UNREACHABLE_NETWORK_URL = 'http://127.0.0.1:9'

/**
 * Узел цепи стенда по имени сервиса компоуза (так его зовёт и контроллер,
 * BLOCKCHAIN_RPC). На незнакомый путь nodeos отвечает 404 — для доставки это
 * отказ по существу (4xx), а не недоступность.
 */
export const REFUSING_NETWORK_URL = 'http://node:8888'

// ─── токены ──────────────────────────────────────────────────────────────────

/** `sub` токена доступа — идентификатор пользователя ядра, его сеть называет `external_subject`. */
export function tokenSubject(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'))
  if (!payload?.sub)
    throw new Error('в токене нет sub')
  return String(payload.sub)
}

// ─── карта в столе ───────────────────────────────────────────────────────────

export interface MyCard {
  issued: boolean
  cardNumber: string | null
  state: 'Pending' | 'Active' | 'Revoked' | 'Rejected' | null
  memberSince: string | null
  enterUrl: string
}

const MY_CARD = `query { cardcoopMyCard { issued cardNumber state memberSince enterUrl } }`

export async function myCard(token: string): Promise<MyCard> {
  return (await gql<{ cardcoopMyCard: MyCard }>(token, MY_CARD)).cardcoopMyCard
}

// ─── настройки расширения ────────────────────────────────────────────────────

const GET_EXTENSION = `query($d: GetExtensionsInput){ getExtensions(data: $d){ name enabled is_installed config } }`
const UPDATE_EXTENSION = `mutation($d: ExtensionInput!){ updateExtension(data: $d){ name config } }`

interface CardcoopExtensionState {
  enabled: boolean
  config: Record<string, unknown>
}

async function readExtension(): Promise<CardcoopExtensionState> {
  const token = await tokenOf(CHAIRMAN)
  const d = await gql<any>(token, GET_EXTENSION, { d: { name: 'cardcoop' } })
  const ext = (d.getExtensions as any[]).find(e => e.name === 'cardcoop')
  if (!ext?.is_installed)
    throw new Error('расширение cardcoop на стенде не установлено')
  return { enabled: Boolean(ext.enabled), config: ext.config ?? {} }
}

/**
 * Переводит адрес сети и ждёт, пока расширение перечитает настройки: изменение
 * перезапускает расширение фоном, а новый адрес виден в ссылке выпуска карты.
 */
async function applyNetworkUrl(ext: CardcoopExtensionState, apiUrl: string): Promise<void> {
  const token = await tokenOf(CHAIRMAN)
  await gql(token, UPDATE_EXTENSION, {
    d: { name: 'cardcoop', enabled: ext.enabled, config: { ...ext.config, api_url: apiUrl } },
  })
  const expected = `${apiUrl.replace(/\/+$/, '')}/enter/${COOP}`
  await waitFor(async () => ((await myCard(token)).enterUrl === expected ? true : null), {
    timeoutMs: 60_000,
    label: `расширение cardcoop перечитало api_url=${apiUrl}`,
  })
}

export interface NetworkSwitch {
  /** Перевести адрес сети ещё раз (исходный всё равно вернёт restore). */
  set: (apiUrl: string) => Promise<void>
  /** Вернуть адрес, который был до теста. */
  restore: () => Promise<void>
}

/** Переводит адрес сети карт на заданный; `restore` возвращает прежний. */
export async function switchNetwork(apiUrl: string): Promise<NetworkSwitch> {
  const original = await readExtension()
  await applyNetworkUrl(original, apiUrl)
  return {
    set: (url: string) => applyNetworkUrl(original, url),
    restore: async () => {
      const current = await readExtension()
      await applyNetworkUrl(current, String(original.config.api_url))
    },
  }
}

// ─── уведомления сети ────────────────────────────────────────────────────────

/** Ключ, которым тест подписывает уведомления за сеть; один на прогон. */
const NETWORK_WIF = ecc.seedPrivate(`api-tests cardcoop network ${crypto.randomUUID()}`)
const NETWORK_PUBLIC = ecc.privateToPublic(NETWORK_WIF)

/**
 * Публикует ключ уведомлений в `ano@cardcoop`. АНО передала active оператору
 * (boot: delegate_active_to) — подписывает ключ стенда, как у оператора.
 */
export async function publishNetworkKey(): Promise<void> {
  await transact({ account: COOP, email: '', wif: DEFAULT_WIF }, [{
    account: 'eosio',
    name: 'updateauth',
    authorization: [{ actor: 'ano', permission: 'active' }],
    data: {
      account: 'ano',
      permission: 'cardcoop',
      parent: 'active',
      auth: { threshold: 1, keys: [{ key: NETWORK_PUBLIC, weight: 1 }], accounts: [], waits: [] },
    },
  }])
}

/** JSON с упорядоченными ключами (RFC 8785 для плоского объекта строк) — то, что подписывает сеть. */
export function canonicalJson(body: Record<string, string | null>): string {
  return `{${Object.keys(body).sort().map(k => `${JSON.stringify(k)}:${JSON.stringify(body[k])}`).join(',')}}`
}

export interface WebhookResponse {
  status: number
  body: any
}

/** Уведомление в приёмник расширения; `signature: null` — без подписи, строка — как есть. */
export async function postWebhook(body: Record<string, string | null>, signature: string | null): Promise<WebhookResponse> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (signature !== null)
    headers['x-cardcoop-signature'] = signature
  const res = await fetch(`${BACKEND_URL}/v1/extensions/cardcoop/webhooks`, { method: 'POST', headers, body: JSON.stringify(body) })
  const text = await res.text()
  let parsed: any = text
  try {
    parsed = JSON.parse(text)
  }
  catch {}
  return { status: res.status, body: parsed }
}

/** Подпись уведомления ключом сети (sha256 канонического JSON). */
export function signAsNetwork(body: Record<string, string | null>): string {
  return ecc.signHash(ecc.sha256(Buffer.from(canonicalJson(body), 'utf8'), 'hex'), NETWORK_WIF)
}

/**
 * Уведомление, подписанное за сеть.
 *
 * Ключ в `ano@cardcoop` может переписать сам оператор стенда: при каждом
 * перезапуске расширения он сверяет его с сетью и публикует ключ сети. Если
 * подпись не сошлась, ключ публикуется заново и уведомление повторяется.
 */
export async function sendAsNetwork(body: Record<string, string | null>): Promise<WebhookResponse> {
  let last: WebhookResponse | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    last = await postWebhook(body, signAsNetwork(body))
    if (last.body?.code !== 'CARDCOOP_NOTIFICATION_SIGNATURE_MISMATCH')
      return last
    await publishNetworkKey()
    // timing: backoff — ключ переписан перезапуском расширения; даём цепи принять новую публикацию
    await new Promise(r => setTimeout(r, 1_000))
  }
  return last as WebhookResponse
}

/** Новая карта для теста: идентификатор сети и номер из шестнадцати цифр. */
export function newCard(): { cardId: string, cardNumber: string } {
  const digits = Array.from(crypto.randomBytes(16), b => String(b % 10)).join('')
  return { cardId: crypto.randomUUID(), cardNumber: digits.replace(/(\d{4})(?=\d)/g, '$1 ') }
}

/** Уведомление «держатель связал карту с кооперативом». */
export function linkCreated(card: { cardId: string, cardNumber: string }, subject: string): Record<string, string | null> {
  return {
    event: 'link.created',
    event_id: crypto.randomUUID(),
    card_id: card.cardId,
    card_number: card.cardNumber,
    coopname: COOP,
    external_subject: subject,
    origin: 'api-tests',
    occurred_at: new Date().toISOString(),
  }
}

/** Уведомление «держатель удалил карту». */
export function cardDeleted(cardId: string): Record<string, string | null> {
  return {
    event: 'card.deleted',
    event_id: crypto.randomUUID(),
    card_id: cardId,
    occurred_at: new Date().toISOString(),
  }
}

// ─── вступающий ──────────────────────────────────────────────────────────────

export interface Candidate {
  username: string
  token: string
  subject: string
}

const REGISTER = `mutation($d: RegisterAccountInput!){ registerAccount(data: $d){ account{ username } tokens{ access{ token } } } }`

/**
 * Кандидат: учётная запись заведена регистрацией стола, в цепи его ещё нет и
 * решения совета о приёме не было.
 */
export async function registerCandidate(prefix = 'ccj'): Promise<Candidate> {
  const username = randomAccount(prefix)
  const wif = await ecc.randomKey()
  const email = `${username}@api-tests.coop`
  const d = await gql<any>(null, REGISTER, {
    d: {
      email,
      type: 'individual',
      username,
      public_key: ecc.privateToPublic(wif),
      individual_data: {
        first_name: 'Кандидат',
        last_name: 'Картадо',
        middle_name: 'Приёмович',
        birthdate: '1990-01-01',
        phone: '+70000000000',
        full_address: 'Тестовый адрес',
      },
    },
  })
  const token = d.registerAccount.tokens.access.token as string
  return { username, token, subject: tokenSubject(token) }
}

/**
 * Приём пайщика записью цепи (`registrator::adduser` от кооператива) — тот же
 * путь, что импорт действующего пайщика оператором. Заканчивается inline
 * `soviet::addpartcpnt` с моментом приёма `createdAt` (UTC, без зоны).
 */
export async function admitByChain(username: string, createdAt: string): Promise<void> {
  await transact({ account: COOP, email: '', wif: DEFAULT_WIF }, [{
    account: 'registrator',
    name: 'adduser',
    authorization: [{ actor: COOP, permission: 'active' }],
    data: {
      coopname: COOP,
      referer: '',
      username,
      type: 'individual',
      created_at: createdAt,
      initial: '100.0000 RUB',
      minimum: '100.0000 RUB',
      spread_initial: false,
      meta: 'api-tests: приём кандидата с картой',
      registration_hash: crypto.randomBytes(32).toString('hex'),
    },
  }])
}

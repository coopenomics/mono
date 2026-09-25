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
  CHAIRMAN,
  COOP,
  DEFAULT_WIF,
  gql,
  randomAccount,
  tokenOf,
  transact,
  waitFor,
} from '../core'
import { registerCandidate as registerCoreCandidate } from '../core/participants'
import { myCard, postWebhook, publishWebhookKeys, signNotification, subjectOf, type RestResponse } from './cardcoop-card.helpers'



/**
 * Узел цепи стенда по имени сервиса компоуза (так его зовёт и контроллер,
 * BLOCKCHAIN_RPC). На незнакомый путь nodeos отвечает 404 — для доставки это
 * отказ по существу (4xx), а не недоступность.
 */
export const REFUSING_NETWORK_URL = 'http://node:8888'

// ─── токены ──────────────────────────────────────────────────────────────────


// ─── карта в столе ───────────────────────────────────────────────────────────



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
  await publishWebhookKeys([NETWORK_PUBLIC])
}




/** Подпись уведомления ключом сети (sha256 канонического JSON). */
export function signAsNetwork(body: Record<string, unknown>): string {
  return signNotification(body, NETWORK_WIF)
}

/**
 * Уведомление, подписанное за сеть.
 *
 * Ключ в `ano@cardcoop` может переписать сам оператор стенда: при каждом
 * перезапуске расширения он сверяет его с сетью и публикует ключ сети. Если
 * подпись не сошлась, ключ публикуется заново и уведомление повторяется.
 */
export async function sendAsNetwork(body: Record<string, unknown>): Promise<RestResponse> {
  let last: RestResponse | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    last = await postWebhook(body, signAsNetwork(body))
    if (last.body?.code !== 'CARDCOOP_NOTIFICATION_SIGNATURE_MISMATCH')
      return last
    await publishNetworkKey()
    // timing: backoff — ключ переписан перезапуском расширения; даём цепи принять новую публикацию
    await new Promise(r => setTimeout(r, 1_000))
  }
  return last as RestResponse
}

/** Новая карта для теста: идентификатор сети и номер из шестнадцати цифр. */
export function newCard(): { cardId: string, cardNumber: string } {
  const digits = Array.from(crypto.randomBytes(16), b => String(b % 10)).join('')
  return { cardId: crypto.randomUUID(), cardNumber: digits.replace(/(\d{4})(?=\d)/g, '$1 ') }
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

/**
 * Кандидат: учётная запись заведена регистрацией стола, в цепи его ещё нет и
 * решения совета о приёме не было.
 */
export async function registerCandidate(prefix = 'ccj'): Promise<Candidate> {
  const c = await registerCoreCandidate({ prefix })
  return { username: c.username, token: c.token, subject: subjectOf(c.token) }
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

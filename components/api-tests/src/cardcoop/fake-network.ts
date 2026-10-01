/**
 * Подставная сеть карт кооператора: адрес сети в настройках расширения
 * переводится на подставной узел стенда (core/stub), и тест играет card.coop
 * с обеих сторон — шлёт подписанные уведомления и отвечает на запросы
 * кооператива так, как ответила бы сеть: приняла, отвергла, недоступна.
 *
 * Чем это отличается от «сеть недоступна» (UNREACHABLE_NETWORK): там исход
 * доставки один — ожидание; здесь видно, ЧТО кооператив отправил и как он
 * ведёт себя на каждый ответ сети.
 */
import crypto from 'node:crypto'
import ecc from 'eosjs-ecc'
import { expect } from 'vitest'
import type { Who } from '../core'
import { COOP, STUB_URL, type StubRequest, admitCandidate, gqlRaw, randomAccount, stubRequests, stubReset, stubRoute, waitFor } from '../core'
import { type AccountKind, freshKeyPair, registerInput } from '../platform/platform-b.helpers'
import { MY_CARD, type MyCard, linkCreated, normalizeKey, permissionKeys, subjectOf } from './cardcoop-card.helpers'
import { type NetworkSwitch, networkPublicKey, newCard, publishNetworkKey, sendAsNetwork, switchNetwork } from './cardcoop-entry.helpers'

export const ATTESTATIONS = '/v1/attestations'

/**
 * Переводит кооператив на подставную сеть. Узел отвечает на служебные запросы
 * старта (ключ уведомлений, объявление допусков, подключение) — исход
 * свидетельств каждый случай задаёт сам.
 */
export async function joinFakeNetwork(): Promise<NetworkSwitch> {
  await stubReset()
  await stubRoute('GET', '/v1/webhooks/public-key', { status: 200, body: { publicKey: networkPublicKey() } })
  await stubRoute('POST', '/v1/registrar/announce', { status: 200, body: {} })
  await stubRoute('POST', '/v1/coops/connect', { status: 200, body: {} })
  const network = await switchNetwork(STUB_URL)
  await publishNetworkKey()
  return network
}

/** Канонический JSON (RFC 8785 в объёме наших документов): ключи по алфавиту на всех уровнях. */
export function canonicalDeep(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(canonicalDeep).join(',')}]`
  if (value && typeof value === 'object') {
    const doc = value as Record<string, unknown>
    return `{${Object.keys(doc).filter(k => doc[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonicalDeep(doc[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** Ключ заверения кооператива в цепи (`<кооператив>@cert`). */
export async function coopCertKey(): Promise<string> {
  const keys = await permissionKeys(COOP, 'cert')
  if (!keys?.length)
    throw new Error(`у кооператива ${COOP} нет ключа заверения в цепи (разрешение cert)`)
  return keys[0]
}

/** Чьим ключом подписан документ: открытый ключ восстанавливается из подписи канонического образа. */
export function signerOf(envelope: { payload: unknown, signature: string }): string {
  return normalizeKey(ecc.recover(envelope.signature, canonicalDeep(envelope.payload)))
}

/** Документы, которые кооператив отправил сети по этому пути и этой карте/свидетельству. */
export async function sentTo(path: string, match: (body: any) => boolean = () => true): Promise<StubRequest[]> {
  return (await stubRequests(path)).filter(r => r.method === 'POST' && match(r.body))
}

/** Ждёт, пока кооператив отправит сети документ, и возвращает все отправки. */
export async function awaitSent(path: string, match: (body: any) => boolean, atLeast = 1, label = `документ ушёл в сеть (${path})`): Promise<StubRequest[]> {
  return waitFor(async () => {
    const sent = await sentTo(path, match)
    return sent.length >= atLeast ? sent : null
  }, { timeoutMs: 90_000, intervalMs: 1_000, label })
}

// ── Пайщики с известной анкетой и их карты ─────────────────────────────────

const REGISTER = `mutation($d:RegisterAccountInput!){ registerAccount(data:$d){ tokens{ access{ token } } account{ username } } }`

export const sha256 = (value: unknown): string => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')

export interface Member extends Who { token: string, data: Record<string, any> }

/** Пайщик с известной анкетой: регистрация через API и приём в цепи. */
export async function memberWithProfile(prefix: string, kind: AccountKind, data: Record<string, any>): Promise<Member> {
  const account = randomAccount(prefix)
  const { wif, publicKey } = await freshKeyPair()
  const r = await gqlRaw<any>(null, REGISTER, { d: registerInput(account, publicKey, kind, data) })
  expect(r.errors, `регистрация ${account}`).toEqual([])
  await admitCandidate(account)
  return { account, email: `${account}@api-tests.coop`, wif, token: r.data.registerAccount.tokens.access.token, data }
}

export async function cardOf(member: Member): Promise<MyCard | null> {
  const r = await gqlRaw<{ cardcoopMyCard: MyCard }>(member.token, MY_CARD)
  return r.errors.length ? null : r.data!.cardcoopMyCard
}

/** Сеть прислала уведомление о связи карты пайщика. */
export async function linkCard(member: Member): Promise<{ cardId: string, cardNumber: string }> {
  const card = newCard()
  const res = await sendAsNetwork(linkCreated(subjectOf(member.token), card.cardId, card.cardNumber))
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  expect(res.body?.accepted).toBe(true)
  return card
}

export async function cardState(member: Member, state: MyCard['state'], label: string): Promise<MyCard> {
  return waitFor(async () => {
    const card = await cardOf(member)
    return card?.state === state ? card : null
  }, { timeoutMs: 120_000, intervalMs: 1_000, label })
}

// ── Гранты раскрытия анкеты ────────────────────────────────────────────────

export const JWKS = '/v1/disclosures/jwks'
export const DELIVERED = '/v1/disclosures/delivered'

/** Ключ подписи грантов: закрытая часть у «сети», открытая — в JWKS. */
export interface GrantKey { privateKey: crypto.KeyObject, jwk: Record<string, unknown>, kid: string }

export function grantKey(): GrantKey {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' })
  const kid = crypto.randomUUID()
  return { privateKey, kid, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'ES256K', use: 'sig' } }
}

/** Утверждения гранта: держатель карты разрешил кооперативу `aud` взять анкету у нас. */
export function grantClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  return {
    iss: 'card.coop',
    sub: crypto.randomUUID(),
    aud: 'othercoop',
    from: COOP,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + 300,
    ...overrides,
  }
}

/** Грант в формате card.coop: compact JWS, ES256K. `header` меняет заголовок (тип, отпечаток ключа). */
export function mintGrant(key: GrantKey, claims: Record<string, unknown>, header: Record<string, unknown> = {}): string {
  const head = Buffer.from(JSON.stringify({ alg: 'ES256K', typ: 'cardcoop-grant+jws', kid: key.kid, ...header })).toString('base64url')
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const signature = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: key.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  return `${head}.${body}.${signature}`
}

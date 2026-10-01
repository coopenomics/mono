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
import ecc from 'eosjs-ecc'
import { COOP, STUB_URL, type StubRequest, stubRequests, stubReset, stubRoute, waitFor } from '../core'
import { normalizeKey, permissionKeys } from './cardcoop-card.helpers'
import { type NetworkSwitch, networkPublicKey, publishNetworkKey, switchNetwork } from './cardcoop-entry.helpers'

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

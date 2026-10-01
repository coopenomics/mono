/**
 * Вход по карте кооператора снаружи (test-registry/cardcoop.entry.yaml,
 * cardcoop.registry-connect.yaml).
 *
 * Первая часть — кооператив к сети не подключён: реквизитов клиента сеть ему
 * не выдавала. Проверяется всё, что обязано работать без сети: честная
 * недоступность входа, отказ держателя и возврат с неначатым входом ведут на
 * страницу с флагом, а не в тупик; сессии, которых не было, ничего не отдают.
 *
 * Вторая часть — сеть играет подставной узел стенда (core/stub). Он принимает
 * допуск оператора и подключение, выдаёт реквизиты «Входа с CardCOOP», меняет
 * код на токен и отвечает за кооператив-источник анкеты. Порядок частей важен:
 * принятое подключение кооператив запоминает, и «не подключён» после него уже
 * не проверить — поэтому всё лежит в одном файле.
 */
import crypto from 'node:crypto'
import ecc from 'eosjs-ecc'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  CHAIRMAN,
  COOP,
  COOP_SIGNER,
  STUB_URL,
  caseName,
  completeExit,
  gql,
  gqlRaw,
  randomAccount,
  rpc,
  stubRequests,
  stubRoute,
  tokenOf,
  transact,
  waitFor,
} from '../core'
import { individualData } from '../platform/platform-b.helpers'
import { quietWindow } from '../platform/platform-a.helpers'
import { BASE_URL, linkCreated, myCard, newKey, normalizeKey, permissionKeys } from './cardcoop-card.helpers'
import { type NetworkSwitch, networkPublicKey, newCard, registerCandidate, sendAsNetwork } from './cardcoop-entry.helpers'
import {
  ANNOUNCE,
  ATTESTATIONS,
  CONNECT,
  PUBLIC_KEY,
  canonicalDeep,
  cardState,
  coopCertKey,
  joinFakeNetwork,
  linkCard,
  memberWithProfile,
  sentTo,
  signerOf,
} from './fake-network'


const ENTRY_BASE = `${BASE_URL}/v1/extensions/cardcoop/entry`

/** Куда уводит браузер ручка входа (без следования за редиректом). */
async function redirectOf(path: string): Promise<{ status: number, location: string }> {
  const res = await fetch(`${ENTRY_BASE}${path}`, { redirect: 'manual' })
  return { status: res.status, location: res.headers.get('location') ?? '' }
}

/** Страница входа по карте в столе этого кооператива. */
const entryPage = (query: string) => new RegExp(`/${COOP}/auth/cardcoop-entry\\?${query.replace('?', '\\?')}$`)

const ENTRY = `query($d: CardcoopEntryInput!){ cardcoopEntry(data: $d){ id outcome status cardNumber username memberships{ coopname } } }`
const TAKE_PROFILE = `mutation($d: CardcoopEntryInput!){ cardcoopTakeEntryProfile(data: $d){ subjectType profile } }`
const REQUEST_DISCLOSURE = `mutation($d: CardcoopRequestEntryDisclosureInput!){ cardcoopRequestEntryDisclosure(data: $d){ id status } }`

describe('cardcoop.entry: вход по карте без подключения к сети', () => {
  it(caseName('cc.entry.side.01', 'кооператив не подключён к сети: вход честно недоступен, кнопке некуда вести'), async () => {
    const available = await gqlRaw<{ cardcoopEntryAvailable: boolean }>(null, `query { cardcoopEntryAvailable }`)
    expect(available.errors).toEqual([])
    expect(available.data?.cardcoopEntryAvailable).toBe(false)

    // Начало входа не уводит на card.coop без реквизитов клиента — страница стола
    // объясняет, что вход по карте недоступен.
    const start = await redirectOf('/start')
    expect(start.status).toBe(302)
    expect(start.location).toMatch(entryPage('error=unavailable'))
  })

  it(caseName('cc.entry.side.01', 'отказ держателя на card.coop ведёт в «заполнить руками», а не в тупик'), async () => {
    const back = await redirectOf(`/callback?error=access_denied&state=${crypto.randomUUID()}`)
    expect(back.status).toBe(302)
    expect(back.location).toMatch(entryPage('error=cancelled'))

    // Возврат без кода — то же: сессии без кода не бывает.
    const noCode = await redirectOf(`/callback?state=${crypto.randomUUID()}`)
    expect(noCode.location).toMatch(entryPage('error=cancelled'))
  })

  it(caseName('cc.entry.side.01', 'возврат с state, которого кооператив не выдавал, не принимается'), async () => {
    const state = crypto.randomBytes(24).toString('base64url')
    const first = await redirectOf(`/callback?state=${state}&code=${crypto.randomUUID()}`)
    expect(first.status).toBe(302)
    expect(first.location).toMatch(entryPage('error=failed'))

    // Повтор того же возврата — тот же отказ: сессия входа не рождается.
    const again = await redirectOf(`/callback?state=${state}&code=${crypto.randomUUID()}`)
    expect(again.location).toMatch(entryPage('error=failed'))
    expect(again.location).not.toContain('entry=')
  })

  it(caseName('cc.entry.break.02', 'перебор идентификатора сессии получает отказ, а не анкету'), async () => {
    const guessed = crypto.randomUUID()

    const session = await gqlRaw(null, ENTRY, { d: { entry_id: guessed } })
    expect(session.data?.cardcoopEntry ?? null).toBeNull()
    expect(session.errors[0]?.code).toBe('CARDCOOP_ENTRY_SESSION_NOT_FOUND')

    const profile = await gqlRaw(null, TAKE_PROFILE, { d: { entry_id: guessed } })
    expect(profile.data?.cardcoopTakeEntryProfile ?? null).toBeNull()
    expect(profile.errors[0]?.code).toBe('CARDCOOP_ENTRY_SESSION_NOT_FOUND')

    // Повтор того же чтения ничего не меняет.
    const again = await gqlRaw(null, TAKE_PROFILE, { d: { entry_id: guessed } })
    expect(again.data?.cardcoopTakeEntryProfile ?? null).toBeNull()
    expect(again.errors[0]?.code).toBe('CARDCOOP_ENTRY_SESSION_NOT_FOUND')

    // Запрос раскрытия по чужой сессии тоже не уходит в сеть.
    const disclose = await gqlRaw(null, REQUEST_DISCLOSURE, { d: { entry_id: guessed, from_coopname: 'voskhod' } })
    expect(disclose.data?.cardcoopRequestEntryDisclosure ?? null).toBeNull()
    expect(disclose.errors[0]?.code).toBe('CARDCOOP_ENTRY_SESSION_NOT_FOUND')
  })
})

// ── Подставная сеть: подключение и вход по карте ───────────────────────────

/** Несекретные реквизиты клиента card.coop в CoopID стенда (scripts/blackbox/stack.sh). */
const OIDC_CLIENT_ID = process.env.BLACKBOX_CARDCOOP_CLIENT_ID ?? ''
const OIDC_ISSUER = process.env.BLACKBOX_CARDCOOP_OIDC_ISSUER ?? ''

/** Реквизиты «Входа с CardCOOP», которые сеть выдаёт в ответ на подключение. */
const RP = {
  clientId: `rp-${crypto.randomUUID()}`,
  clientSecret: `secret-${crypto.randomUUID()}`,
  issuer: 'https://id.card.coop/application/o/cardcoop/',
}

const TOKEN = '/application/o/token/'
const DISCLOSURES = '/v1/disclosures'
const CALLBACK_URL = `${BASE_URL}/v1/extensions/cardcoop/entry/callback`
const ENTRY_FULL = `query($d: CardcoopEntryInput!){ cardcoopEntry(data: $d){
  id outcome status cardNumber username networkUrl memberships{ coopname displayName memberSince } } }`
const AVAILABLE = 'query { cardcoopEntryAvailable }'

async function entryAvailable(): Promise<boolean> {
  const r = await gqlRaw<{ cardcoopEntryAvailable: boolean }>(null, AVAILABLE)
  expect(r.errors).toEqual([])
  return Boolean(r.data?.cardcoopEntryAvailable)
}

/** Число обращений кооператива к сети по пути — по нему видно, что расширение перезапустилось. */
async function hits(path: string, method = 'POST'): Promise<number> {
  return (await stubRequests(path)).filter(r => r.method === method).length
}

/** Утверждения токена сети для карты. */
function tokenClaims(cardId: string, memberships: Record<string, unknown>[], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  return { iss: RP.issuer, aud: RP.clientId, sub: cardId, card_number: '1234 5678 9012 3456', iat: now, exp: now + 300, memberships, ...overrides }
}

/** Токен сети. Подпись кооператив не проверяет: токен приходит прямым обменом у издателя. */
function idToken(claims: Record<string, unknown>): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')
  return `${b64({ alg: 'ES256', typ: 'JWT' })}.${b64(claims)}.${Buffer.from('подпись издателя').toString('base64url')}`
}

interface Entered {
  /** Куда кооператив увёл браузер в начале входа. */
  authorize: URL
  /** Куда кооператив вернул браузер после обмена кода. */
  location: string
  /** Сессия входа; null — возврат не принят. */
  entryId: string | null
  code: string
}

/** Вход по карте целиком: начало, «согласие держателя» и возврат с кодом. */
async function enter(claims: Record<string, unknown>, tokenResponse?: { status: number, body: unknown }): Promise<Entered> {
  const start = await redirectOf('/start')
  expect(start.status).toBe(302)
  const authorize = new URL(start.location)
  const code = crypto.randomUUID()
  await stubRoute('POST', TOKEN, tokenResponse ?? { status: 200, body: { id_token: idToken(claims) } })
  const back = await redirectOf(`/callback?state=${encodeURIComponent(authorize.searchParams.get('state') ?? '')}&code=${code}`)
  expect(back.status).toBe(302)
  const entryId = new URL(back.location, BASE_URL).searchParams.get('entry')
  return { authorize, location: back.location, entryId, code }
}

async function entryOf(entryId: string): Promise<any> {
  const r = await gqlRaw<any>(null, ENTRY_FULL, { d: { entry_id: entryId } })
  expect(r.errors, JSON.stringify(r.errors)).toEqual([])
  return r.data.cardcoopEntry
}

async function entryAt(entryId: string, status: string, label: string): Promise<any> {
  return waitFor(async () => {
    const e = await entryOf(entryId)
    return e.status === status ? e : null
  }, { timeoutMs: 60_000, intervalMs: 500, label })
}

/** Кооператив-источник анкеты: аккаунта у него нет, есть заверение АНО в цепи на его ключ. */
interface Source { coopname: string, wif: string, pub: string, path: string }

async function endorsedSource(expiresInSeconds = 3_600): Promise<Source> {
  const coopname = randomAccount('src')
  const key = await newKey()
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString().slice(0, 19)
  // АНО передала active оператору стенда — заверение выпускается его ключом.
  await transact(COOP_SIGNER, [{
    account: 'ano',
    name: 'endorse',
    authorization: [{ actor: 'ano', permission: 'active' }],
    data: { issuer: 'ano', subject: coopname, chain_id: (await rpc.get_info()).chain_id, cert_key: key.pub, expires_at: expiresAt, credential: 'api-tests: заверение источника анкеты' },
  }])
  return { coopname, wif: key.wif, pub: key.pub, path: `/source/${coopname}/disclosures` }
}

/** Анкета кандидата конвертом источника. */
function profileEnvelope(source: Source, doc: { grantJti: string, cardId: string }, overrides: Record<string, unknown> = {}, signer = source.wif) {
  const payload = {
    type: 'disclosure_profile',
    coopname: source.coopname,
    card_id: doc.cardId,
    to_coopname: COOP,
    grant_jti: doc.grantJti,
    issued_at: new Date().toISOString(),
    subject_type: 'individual',
    profile: { first_name: 'Мария', last_name: 'Переносова', middle_name: 'Ивановна', phone: '+79000000001' },
    ...overrides,
  }
  return { payload, signature: ecc.sign(canonicalDeep(payload), signer), chain: [] }
}

describe.skipIf(!OIDC_CLIENT_ID)('cardcoop: подставная сеть карт — подключение и вход по карте', () => {
  let network: NetworkSwitch
  let certKey = ''
  let chainId = ''
  let connectDoc: any
  let flip = false

  /** Перезапуск расширения: меняется запись адреса сети, сам адрес тот же. */
  async function restartExtension(): Promise<void> {
    flip = !flip
    await network.set(flip ? `${STUB_URL}/` : STUB_URL)
  }

  /** Перезапуск дошёл до конца служебных запросов: ключ уведомлений спрошен заново. */
  async function restartAndSettle(): Promise<void> {
    const before = await hits(PUBLIC_KEY, 'GET')
    await restartExtension()
    await waitFor(async () => ((await hits(PUBLIC_KEY, 'GET')) > before ? true : null),
      { timeoutMs: 60_000, intervalMs: 500, label: 'расширение перезапустилось и спросило ключ уведомлений сети' })
  }

  beforeAll(async () => {
    network = await joinFakeNetwork()
    certKey = await coopCertKey()
    chainId = (await rpc.get_info()).chain_id
  }, 300_000)

  afterAll(async () => {
    await stubRoute('GET', PUBLIC_KEY, { status: 200, body: { publicKey: networkPublicKey() } })
    await network?.restore()
  })

  describe('подключение к сети', () => {
    it(caseName('cc.connect.break.01', 'сеть недоступна на старте — кооператив работает, подключение не засчитано и повторяется следующим стартом'), async () => {
      await stubRoute('POST', CONNECT, { status: 503, body: { error: 'сеть на обслуживании' } })
      const from = Date.now()
      await restartExtension()
      // Пять попыток доставки с растущей задержкой — около четверти минуты.
      const attempts = await waitFor(async () => {
        const sent = (await sentTo(CONNECT, body => body?.payload?.type === 'coop_connect')).filter(r => Date.parse(r.at) >= from)
        return sent.length >= 5 ? sent : null
      }, { timeoutMs: 90_000, intervalMs: 1_000, label: 'пять попыток подключения к недоступной сети' })
      expect(attempts).toHaveLength(5)
      expect(await entryAvailable(), 'неудача не запомнена как успех').toBe(false)
      expect((await myCard(await tokenOf(CHAIRMAN))).enterUrl, 'расширение работает').toContain(STUB_URL)
    })

    it(caseName('cc.announce.happy.02', 'оператор объявляет допуск самому себе раньше подключения; принятое второй раз не объявляется'), async () => {
      await stubRoute('POST', ANNOUNCE, { status: 200, body: {} })
      await stubRoute('POST', CONNECT, { status: 200, body: { rpClient: RP } })
      const from = Date.now()
      await restartExtension()
      await waitFor(async () => ((await entryAvailable()) ? true : null), { timeoutMs: 90_000, intervalMs: 1_000, label: 'сеть приняла подключение и выдала реквизиты входа' })

      const announces = (await sentTo(ANNOUNCE, body => body?.payload?.subject === COOP)).filter(r => Date.parse(r.at) >= from)
      expect(announces, 'допуск оператора объявлен один раз').toHaveLength(1)
      const announce = announces[0]
      expect(announce.body.payload).toMatchObject({ type: 'coop_admission', coopname: COOP, subject: COOP, chain_id: chainId })
      expect(announce.body.payload.display_name).toBeTruthy()
      expect(signerOf(announce.body)).toBe(certKey)

      const connects = (await sentTo(CONNECT)).filter(r => Date.parse(r.at) >= from)
      expect(connects).toHaveLength(1)
      connectDoc = connects[0].body
      // Порядок на старте: допуски, затем подключение — сеть принимает параметры только допущенного.
      expect(Date.parse(announce.at)).toBeLessThanOrEqual(Date.parse(connects[0].at))

      // cardcoop.registry.admission.side.backfill-active: кооператив цепи без
      // доставленной записи получил допуск; доставленное повторно не уходит.
      const announcesBefore = await hits(ANNOUNCE)
      await restartAndSettle()
      await quietWindow(4_000)
      expect(await hits(ANNOUNCE), 'принятый допуск повторно не объявлен').toBe(announcesBefore)
    })

    it(caseName('cc.announce.side.02', 'оператор сети определяется именем кооператива: допуски объявляются без флага в настройках'), async () => {
      const d = await gql<any>(await tokenOf(CHAIRMAN), 'query($d: GetExtensionsInput){ getExtensions(data: $d){ name config } }', { d: { name: 'cardcoop' } })
      const config = (d.getExtensions as any[]).find(e => e.name === 'cardcoop')?.config ?? {}
      expect(config.announce_as_operator ?? false, 'флаг «я — оператор» не выставлен').toBe(false)
      expect((await sentTo(ANNOUNCE, body => body?.payload?.subject === COOP)).length, 'допуск при этом объявлен').toBeGreaterThan(0)
    })

    it(caseName('cc.connect.happy.01', 'на сеть уходит подписанный документ подключения: издатель, клиент и адреса приёмников расширения'), () => {
      expect(connectDoc.payload).toMatchObject({
        type: 'coop_connect',
        coopname: COOP,
        chain_id: chainId,
        oidc_issuer: OIDC_ISSUER,
        oidc_client_id: OIDC_CLIENT_ID,
        attestation_callback_url: `${BASE_URL}/v1/extensions/cardcoop/webhooks`,
        disclosure_url: `${BASE_URL}/v1/extensions/cardcoop/disclosures`,
        entry_callback_url: CALLBACK_URL,
      })
      expect(String(connectDoc.payload.oidc_client_secret).length).toBeGreaterThan(8)
      expect(Number.isNaN(Date.parse(connectDoc.payload.issued_at))).toBe(false)
      expect(signerOf(connectDoc)).toBe(certKey)
    })

    it(caseName('cc.connect.happy.03', 'в документе подключения — наименование кооператива из его реквизитов, а не имя аккаунта'), () => {
      expect(connectDoc.payload.display_name).toBeTruthy()
      expect(connectDoc.payload.display_name).not.toBe(COOP)
    })

    it(caseName('cc.connect.side.02', 'принятое с реквизитами клиента подключение повторно не отправляется'), async () => {
      const before = await hits(CONNECT)
      await restartAndSettle()
      await quietWindow(4_000)
      expect(await hits(CONNECT)).toBe(before)
      expect(await entryAvailable()).toBe(true)
    })

    it(caseName('cc.webhook-key.happy.01', 'ключ уведомлений сети в цепи не тот — оператор берёт его у сети и публикует разрешением cardcoop у ano'), async () => {
      const rotated = await newKey()
      await stubRoute('GET', PUBLIC_KEY, { status: 200, body: { publicKey: rotated.pub } })
      await restartExtension()
      const published = await waitFor(async () => {
        const keys = await permissionKeys('ano', 'cardcoop')
        return keys?.length === 1 && keys[0] === normalizeKey(rotated.pub) ? keys : null
      }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'новый ключ уведомлений сети опубликован в цепи' })
      expect(published).toEqual([normalizeKey(rotated.pub)])

      // cc.webhook-key.side.01: сеть не ответила — ключ в цепи прежний, расширение работает.
      await stubRoute('GET', PUBLIC_KEY, { status: 503, body: { error: 'сеть на обслуживании' } })
      await restartAndSettle()
      await quietWindow(4_000)
      expect(await permissionKeys('ano', 'cardcoop')).toEqual([normalizeKey(rotated.pub)])
      expect((await myCard(await tokenOf(CHAIRMAN))).enterUrl).toContain(STUB_URL)

      // Ключ сети возвращается: им подписаны уведомления остальных случаев.
      await stubRoute('GET', PUBLIC_KEY, { status: 200, body: { publicKey: networkPublicKey() } })
      await restartExtension()
      await waitFor(async () => ((await permissionKeys('ano', 'cardcoop'))?.[0] === normalizeKey(networkPublicKey()) ? true : null),
        { timeoutMs: 60_000, intervalMs: 1_000, label: 'ключ уведомлений сети возвращён' })
    })
  })

  describe('вход по карте', () => {
    const FOREIGN = 'foreigncoop1'
    const ownMembership = { coopname: COOP, coop: 'Наш кооператив', status: 'active', member_since: '2024-01-10' }
    const foreignMembership = { coopname: FOREIGN, coop: 'Кооператив-источник', status: 'active', member_since: '2024-05-01' }
    const goneMembership = { coopname: 'gonecoop1234', coop: 'Прежний кооператив', status: 'revoked', member_since: '2020-02-02' }

    beforeAll(async () => {
      await stubRoute('POST', ATTESTATIONS, { status: 201, body: { id: `att-${crypto.randomUUID()}` } })
      await stubRoute('POST', `${ATTESTATIONS}/*`, { status: 200, body: {} })
    })

    /** Кандидат с выбранным источником: запрос раскрытия ушёл в сеть, ждём решения держателя. */
    async function awaitingConsent(source: Source): Promise<{ entryId: string, cardId: string, disclosureId: string }> {
      const card = newCard()
      const entered = await enter(tokenClaims(card.cardId, [ownMembership, { ...foreignMembership, coopname: source.coopname }]))
      expect(entered.entryId, entered.location).toBeTruthy()
      const disclosureId = crypto.randomUUID()
      await stubRoute('POST', DISCLOSURES, { status: 201, body: { id: disclosureId } })
      const r = await gqlRaw<any>(null, REQUEST_DISCLOSURE, { d: { entry_id: entered.entryId, from_coopname: source.coopname } })
      expect(r.errors, JSON.stringify(r.errors)).toEqual([])
      expect(r.data.cardcoopRequestEntryDisclosure.status).toBe('AwaitingConsent')
      return { entryId: entered.entryId!, cardId: card.cardId, disclosureId }
    }

    /** Сеть прислала грант: держатель разрешил перенос анкеты от источника. */
    async function grant(source: Source, disclosureId: string): Promise<void> {
      const res = await sendAsNetwork({
        event: 'disclosure.granted',
        event_id: crypto.randomUUID(),
        disclosure_id: disclosureId,
        grant: `grant-${crypto.randomUUID()}`,
        from_coopname: source.coopname,
        from_disclosure_url: `${STUB_URL}${source.path}`,
        occurred_at: new Date().toISOString(),
      })
      expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
    }

    it(caseName('cc.entry.happy.01', 'начало входа уводит на card.coop с нашим клиентом, PKCE S256 и скоупами карты и членств; возврат — в приёмник, заявленный сети'), async () => {
      const entered = await enter(tokenClaims(crypto.randomUUID(), [ownMembership]))
      const { authorize } = entered
      expect(`${authorize.origin}${authorize.pathname}`).toBe(`${STUB_URL}/application/o/authorize/`)
      const q = authorize.searchParams
      expect(q.get('response_type')).toBe('code')
      expect(q.get('client_id')).toBe(RP.clientId)
      expect(q.get('redirect_uri')).toBe(CALLBACK_URL)
      expect(q.get('redirect_uri')).toBe(connectDoc.payload.entry_callback_url)
      expect(q.get('code_challenge_method')).toBe('S256')
      expect((q.get('scope') ?? '').split(' ')).toEqual(expect.arrayContaining(['openid', 'cardcoop:card', 'cardcoop:memberships']))
      expect((q.get('state') ?? '').length).toBeGreaterThanOrEqual(24)

      // Обмен кода: наши реквизиты клиента и проверочная строка, из которой получен вызов PKCE.
      const exchanges = (await stubRequests(TOKEN)).filter(r => r.method === 'POST')
      const form = new URLSearchParams(String(exchanges[exchanges.length - 1].body))
      expect(form.get('grant_type')).toBe('authorization_code')
      expect(form.get('code')).toBe(entered.code)
      expect(form.get('client_id')).toBe(RP.clientId)
      expect(form.get('client_secret')).toBe(RP.clientSecret)
      expect(form.get('redirect_uri')).toBe(CALLBACK_URL)
      const challenge = crypto.createHash('sha256').update(form.get('code_verifier') ?? '', 'utf8').digest('base64url')
      expect(challenge).toBe(q.get('code_challenge'))
    })

    it(caseName('cc.entry.happy.02', 'возврат пайщика: карта опознана по журналу кооператива — показана его учётная запись, сессии стола не возникает'), async () => {
      const holder = await memberWithProfile('ccem', 'individual', individualData())
      const card = await linkCard(holder)
      await cardState(holder, 'Active', 'свидетельство пайщика принято сетью')

      // Членств своего кооператива в токене нет вовсе: опознание идёт по своему журналу.
      const entered = await enter(tokenClaims(card.cardId, [foreignMembership], { card_number: card.cardNumber }))
      expect(entered.location).toMatch(entryPage(`entry=${entered.entryId}`))
      expect(entered.location).not.toMatch(/token|access|refresh/i)
      const entry = await entryOf(entered.entryId!)
      expect(entry).toMatchObject({ outcome: 'Member', username: holder.account, status: 'Started', cardNumber: card.cardNumber })
      expect(entry.memberships, 'пайщику перенос анкеты не предлагается').toEqual([])
    })

    it(caseName('cc.entry.happy.03', 'возврат кандидата: источниками анкеты остаются только действующие членства чужих кооперативов'), async () => {
      const entered = await enter(tokenClaims(crypto.randomUUID(), [ownMembership, foreignMembership, goneMembership]))
      const entry = await entryOf(entered.entryId!)
      expect(entry).toMatchObject({ outcome: 'Candidate', username: null, status: 'Started' })
      expect(entry.memberships).toEqual([{ coopname: FOREIGN, displayName: 'Кооператив-источник', memberSince: '2024-05-01' }])
      expect(entry.networkUrl).toContain(STUB_URL)
    })

    it(caseName('cc.entry.side.02', 'свидетельство застряло в доставке или отвергнуто сетью, связь ждёт решения совета — человека узнают по учётной записи; отозванное делает кандидатом'), async () => {
      // Свидетельство отвергнуто сетью по существу.
      await stubRoute('POST', ATTESTATIONS, { status: 422, body: { message: 'unknown fields' } })
      const rejected = await memberWithProfile('ccer', 'individual', individualData())
      const rejectedCard = await linkCard(rejected)
      await cardState(rejected, 'Rejected', 'свидетельство отвергнуто сетью')
      const asRejected = await entryOf((await enter(tokenClaims(rejectedCard.cardId, [foreignMembership]))).entryId!)
      expect(asRejected).toMatchObject({ outcome: 'Member', username: rejected.account })
      expect(asRejected.memberships).toEqual([])

      // Связь кандидата ждёт решения совета.
      await stubRoute('POST', ATTESTATIONS, { status: 201, body: { id: `att-${crypto.randomUUID()}` } })
      const candidate = await registerCandidate('ccec')
      const candidateCard = newCard()
      const linked = await sendAsNetwork(linkCreated(candidate.subject, candidateCard.cardId, candidateCard.cardNumber))
      expect(linked.body?.accepted).toBe(true)
      const asPending = await waitFor(async () => {
        const e = await entryOf((await enter(tokenClaims(candidateCard.cardId, [foreignMembership]))).entryId!)
        return e.username ? e : null
      }, { timeoutMs: 60_000, intervalMs: 1_500, label: 'ожидающая связь кандидата записана' })
      expect(asPending).toMatchObject({ outcome: 'Candidate', username: candidate.username })
      expect(asPending.memberships, 'второе вступление не предлагается').toEqual([])

      // Отозванное свидетельство: человек вышел и вступает заново.
      const leaver = await memberWithProfile('ccel', 'individual', individualData())
      const leaverCard = await linkCard(leaver)
      await cardState(leaver, 'Active', 'свидетельство выходящего принято сетью')
      await completeExit(leaver)
      const asLeaver = await waitFor(async () => {
        const e = await entryOf((await enter(tokenClaims(leaverCard.cardId, [foreignMembership]))).entryId!)
        return e.username === null ? e : null
      }, { timeoutMs: 90_000, intervalMs: 2_000, label: 'свидетельство вышедшего отозвано' })
      expect(asLeaver.outcome).toBe('Candidate')
      expect(asLeaver.memberships.map((m: any) => m.coopname)).toEqual([FOREIGN])
    })

    it(caseName('cc.entry.happy.04', 'кандидат выбрал источник, держатель разрешил — анкета забрана у источника напрямую и проверена ключом его заверения из цепи'), async () => {
      const source = await endorsedSource()
      const pending = await awaitingConsent(source)

      // Запрос раскрытия подписан нами и называет источник из членств карты.
      const [request] = await sentTo(DISCLOSURES, body => body?.payload?.card_id === pending.cardId)
      expect(request.body.payload).toMatchObject({ type: 'disclosure_request', coopname: COOP, card_id: pending.cardId, from_coopname: source.coopname, chain_id: chainId })
      expect(signerOf(request.body)).toBe(certKey)

      await stubRoute('POST', source.path, { status: 200, body: profileEnvelope(source, { grantJti: pending.disclosureId, cardId: pending.cardId }) })
      await grant(source, pending.disclosureId)
      await entryAt(pending.entryId, 'ProfileReady', 'анкета получена от источника')
      const exchanged = (await stubRequests(source.path)).filter(r => r.method === 'POST')
      expect(exchanged).toHaveLength(1)
      expect(String(exchanged[0].body.grant)).toMatch(/^grant-/)

      // Анкета отдаётся странице один раз.
      const taken = await gqlRaw<any>(null, TAKE_PROFILE, { d: { entry_id: pending.entryId } })
      expect(taken.errors).toEqual([])
      expect(taken.data.cardcoopTakeEntryProfile).toMatchObject({ subjectType: 'individual', profile: { first_name: 'Мария', last_name: 'Переносова' } })
      const again = await gqlRaw<any>(null, TAKE_PROFILE, { d: { entry_id: pending.entryId } })
      expect(again.errors[0]?.code).toBe('CARDCOOP_ENTRY_PROFILE_UNAVAILABLE')
    })

    it(caseName('cc.entry.happy.04', 'источник не из членств карты — запрос раскрытия не уходит в сеть'), async () => {
      const entered = await enter(tokenClaims(crypto.randomUUID(), [ownMembership, foreignMembership]))
      const before = await hits(DISCLOSURES)
      for (const from of ['strangercoop', COOP]) {
        const r = await gqlRaw<any>(null, REQUEST_DISCLOSURE, { d: { entry_id: entered.entryId, from_coopname: from } })
        expect(r.errors[0]?.code, from).toBe('CARDCOOP_SOURCE_COOP_NOT_IN_MEMBERSHIPS')
      }
      expect(await hits(DISCLOSURES)).toBe(before)
      expect((await entryOf(entered.entryId!)).status).toBe('Started')
    })

    it(caseName('cc.entry.break.01', 'токен чужого издателя или чужого клиента — возврат не принят, сессии нет'), async () => {
      const card = crypto.randomUUID()
      const foreignIssuer = await enter(tokenClaims(card, [foreignMembership], { iss: 'https://evil.example/application/o/cardcoop/' }))
      expect(foreignIssuer.location).toMatch(entryPage('error=failed'))
      expect(foreignIssuer.entryId).toBeNull()
      const foreignClient = await enter(tokenClaims(card, [foreignMembership], { aud: 'someone-else' }))
      expect(foreignClient.location).toMatch(entryPage('error=failed'))
      const broken = await enter({}, { status: 200, body: { id_token: 'не-токен' } })
      expect(broken.location).toMatch(entryPage('error=failed'))
    })

    it(caseName('cc.entry.break.01', 'анкета подписана не ключом заверения источника, выдана по чужому согласию или чужой карте — не принимается'), async () => {
      const source = await endorsedSource()
      const impostor = await newKey()
      const cases: Array<[string, (p: { disclosureId: string, cardId: string }) => unknown]> = [
        ['чужой ключ', p => profileEnvelope(source, { grantJti: p.disclosureId, cardId: p.cardId }, {}, impostor.wif)],
        ['чужое согласие', p => profileEnvelope(source, { grantJti: crypto.randomUUID(), cardId: p.cardId })],
        ['чужая карта', p => profileEnvelope(source, { grantJti: p.disclosureId, cardId: crypto.randomUUID() })],
        ['анкета другому кооперативу', p => profileEnvelope(source, { grantJti: p.disclosureId, cardId: p.cardId }, { to_coopname: 'othercoop123' })],
      ]
      for (const [label, build] of cases) {
        const pending = await awaitingConsent(source)
        await stubRoute('POST', source.path, { status: 200, body: build(pending) })
        await grant(source, pending.disclosureId)
        await entryAt(pending.entryId, 'Failed', `перенос не удался: ${label}`)
        const taken = await gqlRaw<any>(null, TAKE_PROFILE, { d: { entry_id: pending.entryId } })
        expect(taken.errors[0]?.code, label).toBe('CARDCOOP_ENTRY_PROFILE_UNAVAILABLE')
      }
    })

    it(caseName('cc.entry.break.04', 'обмен гранта на анкету не удался — сессия заканчивается «перенести не удалось», а не висит в ожидании'), async () => {
      const source = await endorsedSource()
      for (const response of [{ status: 403, body: { code: 'CARDCOOP_DISCLOSURE_GRANT_REJECTED' } }, { status: 500, body: { error: 'сбой источника' } }, { status: 200, body: { payload: null } }]) {
        const pending = await awaitingConsent(source)
        await stubRoute('POST', source.path, response)
        await grant(source, pending.disclosureId)
        const failed = await entryAt(pending.entryId, 'Failed', `перенос не удался: источник ответил ${response.status}`)
        expect(failed.outcome).toBe('Candidate')
      }
    })

    it(caseName('cc.entry.break.07', 'заверение кооператива-источника в цепи истекло — его анкета не принимается'), async () => {
      const source = await endorsedSource(6)
      const pending = await awaitingConsent(source)
      await stubRoute('POST', source.path, { status: 200, body: profileEnvelope(source, { grantJti: pending.disclosureId, cardId: pending.cardId }) })
      await waitFor(async () => {
        const row = (await rpc.get_table_rows({ json: true, code: 'ano', scope: 'ano', table: 'endorsements', lower_bound: source.coopname, upper_bound: source.coopname, limit: 1 })).rows[0]
        return row && Date.parse(`${row.expires_at}Z`) < Date.now() ? true : null
      }, { timeoutMs: 30_000, intervalMs: 1_000, label: 'срок заверения источника вышел' })
      await grant(source, pending.disclosureId)
      await entryAt(pending.entryId, 'Failed', 'анкета источника с истёкшим заверением не принята')
    })

    it(caseName('cc.entry.side.03', 'сеть сообщила, что запрос погас без ответа держателя, либо держатель отказал — сессия закрывается, ожидание не висит'), async () => {
      const source = await endorsedSource()
      const expired = await awaitingConsent(source)
      const res = await sendAsNetwork({ event: 'disclosure.expired', event_id: crypto.randomUUID(), disclosure_id: expired.disclosureId, occurred_at: new Date().toISOString() })
      expect(res.status).toBeLessThan(300)
      await entryAt(expired.entryId, 'Expired', 'согласия не было')

      const denied = await awaitingConsent(source)
      await sendAsNetwork({ event: 'disclosure.denied', event_id: crypto.randomUUID(), disclosure_id: denied.disclosureId, occurred_at: new Date().toISOString() })
      await entryAt(denied.entryId, 'Denied', 'держатель отказал')

      // Чужое уведомление о погашении свежую сессию не трогает.
      const fresh = await awaitingConsent(source)
      await sendAsNetwork({ event: 'disclosure.expired', event_id: crypto.randomUUID(), disclosure_id: crypto.randomUUID(), occurred_at: new Date().toISOString() })
      await quietWindow(3_000)
      expect((await entryOf(fresh.entryId)).status).toBe('AwaitingConsent')
    })

    it(caseName('cc.entry.break.06', 'токен сети просрочен — возврат отклоняется наравне с чужим издателем'), async () => {
      const now = Math.floor(Date.now() / 1000)
      const stale = await enter(tokenClaims(crypto.randomUUID(), [foreignMembership], { iat: now - 7_200, exp: now - 3_600 }))
      expect(stale.location).toMatch(entryPage('error=failed'))
      expect(stale.entryId).toBeNull()
    })

    it(caseName('cc.entry.side.04', 'председатель выключил вход по карте — кнопки нет даже при реквизитах клиента от сети'), async () => {
      const token = await tokenOf(CHAIRMAN)
      const read = async () => {
        const d = await gql<any>(token, 'query($d: GetExtensionsInput){ getExtensions(data: $d){ name enabled config } }', { d: { name: 'cardcoop' } })
        return (d.getExtensions as any[]).find(e => e.name === 'cardcoop')
      }
      const UPDATE = 'mutation($d: ExtensionInput!){ updateExtension(data: $d){ name config } }'
      const ext = await read()
      expect(await entryAvailable()).toBe(true)
      try {
        await gql(token, UPDATE, { d: { name: 'cardcoop', enabled: ext.enabled, config: { ...ext.config, entry_enabled: false } } })
        await waitFor(async () => ((await entryAvailable()) ? null : true), { timeoutMs: 60_000, intervalMs: 1_000, label: 'вход по карте выключен настройкой' })
        expect(await entryAvailable()).toBe(false)
      }
      finally {
        await gql(token, UPDATE, { d: { name: 'cardcoop', enabled: ext.enabled, config: { ...(await read()).config, entry_enabled: true } } })
      }
      await waitFor(async () => ((await entryAvailable()) ? true : null), { timeoutMs: 60_000, intervalMs: 1_000, label: 'вход по карте включён обратно' })
    })
  })
})

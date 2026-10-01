/**
 * Выдача анкеты по гранту card.coop против подставной сети карт
 * (test-registry/cardcoop.disclosures.yaml).
 *
 * Сеть играет подставной узел стенда: он отдаёт набор ключей грантов (JWKS),
 * а тест выпускает гранты закрытой частью этих ключей — как card.coop,
 * удостоверяющий согласие держателя карты. Видно всё, что на стенде без сети
 * было непроверяемо: саму выдачу, отметку о передаче, одноразовость согласия,
 * смену ключа сети и каждую причину отказа по отдельности.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { COOP, caseName, rpc, stubRequests, stubRoute } from '../core'
import { individualData, organizationData } from '../platform/platform-b.helpers'
import { DISCLOSURE_URL, linkCreated, postJson, subjectOf } from './cardcoop-card.helpers'
import { type NetworkSwitch, newCard, sendAsNetwork } from './cardcoop-entry.helpers'
import {
  ATTESTATIONS,
  DELIVERED,
  type GrantKey,
  JWKS,
  type Member,
  awaitSent,
  cardState,
  coopCertKey,
  grantClaims,
  grantKey,
  joinFakeNetwork,
  linkCard,
  memberWithProfile,
  mintGrant,
  signerOf,
} from './fake-network'

const REJECTED = 'CARDCOOP_DISCLOSURE_GRANT_REJECTED'

/** Адрес предъявителя: предел частоты считается по адресу, у каждого обращения он свой. */
const fromAddress = () => `10.77.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}`

/** Кооператив-получатель предъявляет грант в ручку раскрытия. */
async function present(grant: unknown, ip = fromAddress()) {
  return postJson(DISCLOSURE_URL, { grant }, { 'X-Forwarded-For': ip })
}

async function jwksReads(): Promise<number> {
  return (await stubRequests(JWKS)).filter(r => r.method === 'GET').length
}

describe('cardcoop.disclosures: выдача анкеты и подставная сеть карт', () => {
  let network: NetworkSwitch
  let certKey = ''
  let chainId = ''
  let key: GrantKey
  let holder: Member
  let cardId = ''

  beforeAll(async () => {
    network = await joinFakeNetwork()
    key = grantKey()
    await stubRoute('GET', JWKS, { status: 200, body: { keys: [key.jwk] } })
    await stubRoute('POST', DELIVERED, { status: 200, body: {} })
    await stubRoute('POST', ATTESTATIONS, { status: 201, body: { id: `att-${crypto.randomUUID()}` } })
    certKey = await coopCertKey()
    chainId = (await rpc.get_info()).chain_id

    holder = await memberWithProfile('ccdh', 'individual', individualData())
    cardId = (await linkCard(holder)).cardId
    await cardState(holder, 'Active', 'свидетельство держателя принято сетью')
  })

  afterAll(async () => {
    await network?.restore()
  })

  it(caseName('cc.disclose.happy.01', 'действительный грант — анкета выдана конвертом с подписью ключа заверения кооператива'), async () => {
    const claims = grantClaims({ sub: cardId })
    const r = await present(mintGrant(key, claims))
    expect(r.status, JSON.stringify(r.body)).toBe(200)

    expect(r.body.payload).toMatchObject({
      type: 'disclosure_profile',
      coopname: COOP,
      card_id: cardId,
      to_coopname: claims.aud,
      grant_jti: claims.jti,
      chain_id: chainId,
      subject_type: 'individual',
    })
    expect(Number.isNaN(Date.parse(r.body.payload.issued_at))).toBe(false)
    expect(signerOf(r.body)).toBe(certKey)
    expect(Array.isArray(r.body.chain)).toBe(true)

    // cc.disclose.happy.03: состав не урезан — анкета такая, какой её завели;
    // учётное имя пайщика в нашем кооперативе наружу не уходит.
    const d = holder.data
    expect(r.body.payload.profile).toMatchObject({
      first_name: d.first_name,
      last_name: d.last_name,
      middle_name: d.middle_name,
      full_address: d.full_address,
      phone: d.phone,
    })
    expect(r.body.payload.profile.passport).toMatchObject({ issued_by: d.passport.issued_by, code: d.passport.code })
    expect(r.body.payload.profile).not.toHaveProperty('username')
    expect(JSON.stringify(r.body)).not.toContain(holder.account)

    // cc.disclose.happy.02: держателю в сеть уходит подписанная отметка о
    // передаче с тем же идентификатором согласия.
    const [delivered] = await awaitSent(DELIVERED, body => body?.payload?.grant_jti === claims.jti, 1, 'отметка о передаче анкеты ушла в сеть')
    expect(delivered.body.payload).toMatchObject({ type: 'disclosure_delivered', coopname: COOP, grant_jti: claims.jti, chain_id: chainId })
    expect(signerOf(delivered.body)).toBe(certKey)

    // cc.disclose.break.03: согласие даётся на один обмен.
    const again = await present(mintGrant(key, claims))
    expect(again.status).toBe(403)
    expect(again.body.code).toBe(REJECTED)
  })

  it(caseName('cc.disclose.happy.03', 'анкета организации выдаётся целиком, без внутреннего учётного имени'), async () => {
    const org = await memberWithProfile('ccdo', 'organization', organizationData())
    const card = await linkCard(org)
    await cardState(org, 'Active', 'свидетельство организации принято сетью')

    const r = await present(mintGrant(key, grantClaims({ sub: card.cardId })))
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    const d = org.data
    expect(r.body.payload.subject_type).toBe('organization')
    expect(r.body.payload.profile).toMatchObject({ short_name: d.short_name, full_name: d.full_name, full_address: d.full_address })
    expect(r.body.payload.profile.details).toMatchObject(d.details)
    expect(r.body.payload.profile.represented_by).toMatchObject({ last_name: d.represented_by.last_name, position: d.represented_by.position })
    expect(r.body.payload.profile).not.toHaveProperty('username')
    expect(JSON.stringify(r.body)).not.toContain(org.account)
  })

  it(caseName('cc.disclose.side.02', 'подряд приходят гранты — набор ключей сети читается один раз и живёт в кэше'), async () => {
    const before = await jwksReads()
    for (let i = 0; i < 2; i++) {
      const refused = await present(mintGrant(key, grantClaims()))
      // Карта гранта кооперативу неизвестна — отказ, но подпись уже проверена.
      expect(refused.status).toBe(403)
    }
    expect(await jwksReads()).toBe(before)
    expect(before).toBeGreaterThanOrEqual(1)
  })

  it(caseName('cc.disclose.side.03', 'по карте нет действующего свидетельства — отказ, согласие не израсходовано: после выпуска тот же грант проходит'), async () => {
    const member = await memberWithProfile('ccdn', 'individual', individualData())
    const card = newCard()
    const grant = mintGrant(key, grantClaims({ sub: card.cardId }))

    const early = await present(grant)
    expect(early.status).toBe(403)
    expect(early.body.code).toBe(REJECTED)

    const linked = await sendAsNetwork(linkCreated(subjectOf(member.token), card.cardId, card.cardNumber))
    expect(linked.body?.accepted).toBe(true)
    await cardState(member, 'Active', 'свидетельство выпущено после отказа по гранту')

    const later = await present(grant)
    expect(later.status, JSON.stringify(later.body)).toBe(200)
    expect(later.body.payload.card_id).toBe(card.cardId)
  })

  it(caseName('cc.disclose.break.01', 'просроченный грант — отказ; расхождение часов до полуминуты прощается, больше — нет'), async () => {
    const now = Math.floor(Date.now() / 1000)
    const stale = await present(mintGrant(key, grantClaims({ sub: cardId, iat: now - 900, exp: now - 120 })))
    expect(stale.status).toBe(403)
    expect(stale.body.code).toBe(REJECTED)

    const future = await present(mintGrant(key, grantClaims({ sub: cardId, iat: now + 600, exp: now + 900 })))
    expect(future.status).toBe(403)

    const skewed = await present(mintGrant(key, grantClaims({ sub: cardId, iat: now - 300, exp: now - 10 })))
    expect(skewed.status, JSON.stringify(skewed.body)).toBe(200)
  })

  it(caseName('cc.disclose.break.02', 'грант на анкету другого кооператива или выданный нам же — отказ'), async () => {
    const elsewhere = await present(mintGrant(key, grantClaims({ sub: cardId, from: 'othercoop', aud: COOP })))
    expect(elsewhere.status).toBe(403)
    expect(elsewhere.body.code).toBe(REJECTED)

    const toOurselves = await present(mintGrant(key, grantClaims({ sub: cardId, aud: COOP })))
    expect(toOurselves.status).toBe(403)
  })

  it(caseName('cc.disclose.break.04', 'грант подписан чужим ключом либо тело подменено после подписи — отказ'), async () => {
    // Чужой ключ под отпечатком ключа сети: перечитывать набор ключей незачем.
    const impostor: GrantKey = { ...grantKey(), kid: key.kid }
    const forged = await present(mintGrant(impostor, grantClaims({ sub: cardId })))
    expect(forged.status).toBe(403)
    expect(forged.body.code).toBe(REJECTED)

    // Настоящая подпись сети под грантом на другую карту, тело заменено на нашу.
    const [head, , signature] = mintGrant(key, grantClaims()).split('.')
    const swapped = Buffer.from(JSON.stringify(grantClaims({ sub: cardId }))).toString('base64url')
    const tampered = await present(`${head}.${swapped}.${signature}`)
    expect(tampered.status).toBe(403)
  })

  it(caseName('cc.disclose.break.05', 'документ другого назначения с подписью сети — отказ по типу'), async () => {
    const r = await present(mintGrant(key, grantClaims({ sub: cardId }), { typ: 'cardcoop-endorsement+jws' }))
    expect(r.status).toBe(403)
    expect(r.body.code).toBe(REJECTED)

    const untyped = await present(mintGrant(key, grantClaims({ sub: cardId }), { typ: undefined }))
    expect(untyped.status).toBe(403)
  })

  it(caseName('cc.disclose.side.01', 'ключ грантов у сети сменился — незнакомый отпечаток заставляет перечитать набор, первый грант новым ключом проходит'), async () => {
    const rotated = grantKey()
    await stubRoute('GET', JWKS, { status: 200, body: { keys: [rotated.jwk] } })
    const before = await jwksReads()

    const r = await present(mintGrant(rotated, grantClaims({ sub: cardId })))
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    expect(await jwksReads()).toBe(before + 1)
    key = rotated
  })

  it(caseName('cc.disclose.break.06', 'набор ключей сети недоступен — отказ, а не выдача без проверки'), async () => {
    await stubRoute('GET', JWKS, { status: 503, body: { error: 'сеть на обслуживании' } })
    const unknown = grantKey()
    const r = await present(mintGrant(unknown, grantClaims({ sub: cardId })))
    expect(r.status).toBe(403)
    expect(r.body.code).toBe(REJECTED)
    await stubRoute('GET', JWKS, { status: 200, body: { keys: [key.jwk] } })
  })

  it(caseName('cc.disclose.side.09', 'чаще тридцати обращений в минуту с одного адреса — отказ по частоте'), async () => {
    const ip = fromAddress()
    const statuses: number[] = []
    for (let i = 0; i < 32; i++)
      statuses.push((await present('not-a-grant', ip)).status)
    expect(statuses.slice(0, 30).every(s => s === 403), statuses.join(',')).toBe(true)
    expect(statuses.slice(30).every(s => s === 429), statuses.join(',')).toBe(true)

    // С другого адреса дверь по-прежнему отвечает по существу.
    expect((await present('not-a-grant')).status).toBe(403)
  })
})

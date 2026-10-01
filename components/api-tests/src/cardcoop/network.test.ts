/**
 * Карта кооператора против подставной сети карт (реестры cardcoop.attestations,
 * cardcoop.membership, cardcoop.identity, cardcoop.card-page, cardcoop.join).
 *
 * Сеть играет подставной узел стенда: видно, что именно кооператив отправил —
 * документ, подпись, блок реквизитов — и как он ведёт себя, когда сеть
 * приняла свидетельство, отвергла его, ответила ошибкой или не ответила.
 * Членство прекращается настоящим выходом в цепи: заявление, решение совета,
 * выплата паевого.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COOP, admitCandidate, caseName, completeExit, declineExit, gqlRaw, randomAccount, rpc, stubRoute, waitFor } from '../core'
import { quietWindow } from '../platform/platform-a.helpers'
import { type AccountKind, freshKeyPair, individualData, organizationData, registerInput } from '../platform/platform-b.helpers'
import { MY_CARD, type MyCard, linkCreated, subjectOf } from './cardcoop-card.helpers'
import { type NetworkSwitch, newCard, registerCandidate, sendAsNetwork } from './cardcoop-entry.helpers'
import { ATTESTATIONS, awaitSent, canonicalDeep, coopCertKey, joinFakeNetwork, sentTo, signerOf } from './fake-network'

const REGISTER = `mutation($d:RegisterAccountInput!){ registerAccount(data:$d){ tokens{ access{ token } } account{ username } } }`

const sha256 = (value: unknown): string => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')

interface Member extends Who { token: string, data: Record<string, any> }

/** Пайщик с известной анкетой: регистрация через API и приём в цепи. */
async function memberWithProfile(prefix: string, kind: AccountKind, data: Record<string, any>): Promise<Member> {
  const account = randomAccount(prefix)
  const { wif, publicKey } = await freshKeyPair()
  const r = await gqlRaw<any>(null, REGISTER, { d: registerInput(account, publicKey, kind, data) })
  expect(r.errors, `регистрация ${account}`).toEqual([])
  await admitCandidate(account)
  return { account, email: `${account}@api-tests.coop`, wif, token: r.data.registerAccount.tokens.access.token, data }
}

async function cardOf(member: Member): Promise<MyCard | null> {
  const r = await gqlRaw<{ cardcoopMyCard: MyCard }>(member.token, MY_CARD)
  return r.errors.length ? null : r.data!.cardcoopMyCard
}

/** Сеть прислала уведомление о связи карты пайщика. */
async function linkCard(member: Member): Promise<{ cardId: string, cardNumber: string }> {
  const card = newCard()
  const res = await sendAsNetwork(linkCreated(subjectOf(member.token), card.cardId, card.cardNumber))
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  expect(res.body?.accepted).toBe(true)
  return card
}

async function cardState(member: Member, state: MyCard['state'], label: string): Promise<MyCard> {
  return waitFor(async () => {
    const card = await cardOf(member)
    return card?.state === state ? card : null
  }, { timeoutMs: 120_000, intervalMs: 1_000, label })
}

const forCard = (cardId: string) => (body: any) => body?.payload?.card_id === cardId

describe('cardcoop: свидетельства членства и подставная сеть карт', () => {
  let network: NetworkSwitch
  let certKey = ''
  let chainId = ''

  /** Пайщик со свидетельством, принятым сетью, — на нём проверяются отзыв и повторы. */
  let holder: Member
  let holderCard: { cardId: string, cardNumber: string }
  const holderAttestation = `att-${crypto.randomUUID()}`

  beforeAll(async () => {
    network = await joinFakeNetwork()
    certKey = await coopCertKey()
    chainId = (await rpc.get_info()).chain_id
  })

  afterAll(async () => {
    await network?.restore()
  })

  it(caseName('cc.att.happy.01', 'сеть приняла свидетельство: документ несёт кооператив, карту, дату вступления, цепь и блок реквизитов; стол показывает подтверждённое членство'), async () => {
    await stubRoute('POST', ATTESTATIONS, { status: 201, body: { id: holderAttestation } })
    holder = await memberWithProfile('ccnh', 'individual', individualData())
    holderCard = await linkCard(holder)

    const [sent] = await awaitSent(ATTESTATIONS, forCard(holderCard.cardId))
    const { payload, signature, chain } = sent.body
    expect(payload).toMatchObject({ type: 'membership', coopname: COOP, card_id: holderCard.cardId, chain_id: chainId })
    expect(payload.member_since).toMatch(/^\d{4}-\d{2}-\d{2}/)
    expect(Number.isNaN(Date.parse(payload.issued_at)), `issued_at=${payload.issued_at}`).toBe(false)
    expect(typeof signature).toBe('string')
    expect(Array.isArray(chain)).toBe(true)

    // cc.mbr.happy.01, cc.card.happy.01: запись стала действующей, стол
    // показывает номер карты и ту дату вступления, о которой свидетельствовал.
    const shown = await cardState(holder, 'Active', 'свидетельство принято сетью')
    expect(shown.issued).toBe(true)
    expect(shown.cardNumber).toBe(holderCard.cardNumber)
    expect(shown.memberSince).toBe(String(payload.member_since).slice(0, 10))
  })

  it(caseName('cc.att.happy.02', 'подпись документа сходится с ключом заверения кооператива из цепи — по каноническому образу, при любом порядке ключей'), async () => {
    const [sent] = await sentTo(ATTESTATIONS, forCard(holderCard.cardId))
    expect(signerOf(sent.body)).toBe(certKey)

    // cc.att.happy.03: тот же документ с другим порядком ключей даёт тот же
    // канонический образ — принимающая сторона сойдётся с подписью.
    const shuffled = Object.fromEntries(Object.entries(sent.body.payload).reverse())
    expect(canonicalDeep(shuffled)).toBe(canonicalDeep(sent.body.payload))
    expect(signerOf({ payload: shuffled, signature: sent.body.signature })).toBe(certKey)

    // Изменённый документ с той же подписью — уже не от кооператива.
    expect(signerOf({ payload: { ...sent.body.payload, card_id: 'другая-карта' }, signature: sent.body.signature })).not.toBe(certKey)
  })

  it(caseName('cc.identity.happy.01', 'реквизиты физлица: ФИО открыто, остальное — отпечатками по полям, паспорт разложен на подполя'), async () => {
    const [sent] = await sentTo(ATTESTATIONS, forCard(holderCard.cardId))
    const { identity } = sent.body.payload
    const d = holder.data
    expect(identity.kind).toBe('individual')
    expect(identity.public).toEqual({ last_name: d.last_name, first_name: d.first_name, middle_name: d.middle_name })

    // cc.identity.happy.02: у каждого подполя паспорта свой отпечаток.
    expect(identity.digests).toEqual({
      'birthdate': sha256(d.birthdate),
      'full_address': sha256(d.full_address),
      'phone': sha256(d.phone),
      'email': sha256(holder.email),
      'passport.series': sha256(d.passport.series),
      'passport.number': sha256(d.passport.number),
      'passport.issued_by': sha256(d.passport.issued_by),
      'passport.issued_at': sha256(d.passport.issued_at),
      'passport.code': sha256(d.passport.code),
    })

    // cc.identity.break.01: ФИО в отпечатки не попадает; значений закрытых
    // полей в документе нет нигде.
    for (const name of ['last_name', 'first_name', 'middle_name'])
      expect(Object.keys(identity.digests)).not.toContain(name)
    const wire = JSON.stringify(sent.body)
    for (const secret of [d.full_address, d.phone, d.passport.issued_by, d.passport.code])
      expect(wire).not.toContain(String(secret))
  })

  it(caseName('cc.mbr.side.01', 'уведомление о той же связи пришло повторно — второго свидетельства сеть не получает'), async () => {
    const again = await sendAsNetwork(linkCreated(subjectOf(holder.token), holderCard.cardId, holderCard.cardNumber))
    expect(again.status, JSON.stringify(again.body)).toBeLessThan(300)
    await quietWindow(8_000)
    expect(await sentTo(ATTESTATIONS, forCard(holderCard.cardId))).toHaveLength(1)
  })

  it(caseName('cc.identity.happy.03', 'реквизиты организации: наименования открыто, ИНН, ОГРН, КПП и представитель — отпечатками'), async () => {
    await stubRoute('POST', ATTESTATIONS, { status: 201, body: { id: `att-${crypto.randomUUID()}` } })
    const org = await memberWithProfile('ccno', 'organization', organizationData())
    const card = await linkCard(org)
    const [sent] = await awaitSent(ATTESTATIONS, forCard(card.cardId))
    const { identity } = sent.body.payload
    const d = org.data
    expect(identity.kind).toBe('organization')
    expect(identity.public).toEqual({ short_name: d.short_name, full_name: d.full_name })
    expect(identity.digests).toMatchObject({
      'details.inn': sha256(d.details.inn),
      'details.ogrn': sha256(d.details.ogrn),
      'details.kpp': sha256(d.details.kpp),
      'represented_by.last_name': sha256(d.represented_by.last_name),
      'represented_by.first_name': sha256(d.represented_by.first_name),
      'represented_by.middle_name': sha256(d.represented_by.middle_name),
    })
    const wire = JSON.stringify(sent.body)
    for (const secret of [d.details.inn, d.details.ogrn, d.represented_by.based_on])
      expect(wire).not.toContain(String(secret))
  })

  it(caseName('cc.identity.side.01', 'одно поле через «ё» и через «е», с другим регистром и ведущим пробелом — отпечатки разные; пустого поля в отпечатках нет'), async () => {
    await stubRoute('POST', ATTESTATIONS, { status: 201, body: { id: `att-${crypto.randomUUID()}` } })
    const addresses = ['г. Королёв, ул. Мира, д. 1', 'г. Королев, ул. Мира, д. 1', 'Г. КОРОЛЁВ, ул. Мира, д. 1']
    const digests: Record<string, string>[] = []
    for (const [i, full_address] of addresses.entries()) {
      // cc.identity.side.03: у третьего пайщика паспорта в анкете нет.
      const data = individualData({ full_address, ...(i === 2 ? { passport: undefined } : {}) })
      const member = await memberWithProfile(`ccn${i}`, 'individual', data)
      const card = await linkCard(member)
      const [sent] = await awaitSent(ATTESTATIONS, forCard(card.cardId))
      digests.push(sent.body.payload.identity.digests)
      // Значение не приводится к канону: отпечаток — от того, что введено.
      expect(sent.body.payload.identity.digests.full_address, full_address).toBe(sha256(full_address))
    }
    expect(new Set(digests.map(d => d.full_address)).size).toBe(3)
    // cc.identity.side.02 — третий адрес отличается от первого только регистром.
    expect(digests[2].full_address).not.toBe(digests[0].full_address)
    expect(Object.keys(digests[0]).filter(k => k.startsWith('passport.'))).toHaveLength(5)
    expect(Object.keys(digests[2]).filter(k => k.startsWith('passport.'))).toHaveLength(0)
  })

  it(caseName('cc.att.side.02', 'сеть ответила серверной ошибкой, со второй попытки приняла — доставка повторена и завершилась успехом'), async () => {
    await stubRoute('POST', ATTESTATIONS, { status: 500, body: { error: 'временный сбой сети' } }, { status: 201, body: { id: `att-${crypto.randomUUID()}` } })
    const member = await memberWithProfile('ccnr', 'individual', individualData())
    const card = await linkCard(member)
    await cardState(member, 'Active', 'свидетельство принято со второй попытки')
    expect(await sentTo(ATTESTATIONS, forCard(card.cardId))).toHaveLength(2)
  })

  it(caseName('cc.att.break.01', 'сеть отвергла документ с разбором (422) — повторов нет, запись помечена отвергнутой'), async () => {
    await stubRoute('POST', ATTESTATIONS, { status: 422, body: { message: 'unknown fields: identity' } })
    const member = await memberWithProfile('ccnx', 'individual', individualData())
    const card = await linkCard(member)
    await cardState(member, 'Rejected', 'свидетельство отвергнуто сетью по существу')
    await quietWindow(6_000)
    expect(await sentTo(ATTESTATIONS, forCard(card.cardId))).toHaveLength(1)
  })

  it(caseName('cc.att.break.02', 'сеть отвечает ошибкой все попытки подряд — недоставка остаётся ожиданием, приём уведомления не падает'), async () => {
    await stubRoute('POST', ATTESTATIONS, { status: 503, body: { error: 'сеть на обслуживании' } })
    const member = await memberWithProfile('ccnu', 'individual', individualData())
    const card = await linkCard(member)
    // Пять попыток с растущей задержкой (1, 2, 4, 8 с) — около четверти минуты.
    const attempts = await awaitSent(ATTESTATIONS, forCard(card.cardId), 5, 'пять попыток доставки свидетельства')
    expect(attempts).toHaveLength(5)
    const gaps = attempts.slice(1).map((r, i) => Date.parse(r.at) - Date.parse(attempts[i].at))
    expect(gaps[3], `задержки ${gaps.join(', ')} мс`).toBeGreaterThan(gaps[0])
    await cardState(member, 'Pending', 'свидетельство ждёт доставки')
    await quietWindow(5_000)
    expect(await sentTo(ATTESTATIONS, forCard(card.cardId))).toHaveLength(5)
  })

  it(caseName('cc.join.happy.01', 'карту связал кандидат до приёма — связь принята, свидетельство в сеть не уходит'), async () => {
    await stubRoute('POST', ATTESTATIONS, { status: 201, body: { id: `att-${crypto.randomUUID()}` } })
    const candidate = await registerCandidate('ccnc')
    const card = newCard()
    const res = await sendAsNetwork(linkCreated(candidate.subject, card.cardId, card.cardNumber))
    // cc.att.side.03: сети возвращается приём — повторная присылка ничего не исправит.
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
    expect(res.body?.accepted).toBe(true)
    await quietWindow(8_000)
    expect(await sentTo(ATTESTATIONS, forCard(card.cardId))).toHaveLength(0)
  })

  it(caseName('cc.mbr.side.02', 'совет отклонил заявление о выходе — свидетельство остаётся действующим, отзыв в сеть не уходит'), async () => {
    await stubRoute('POST', `${ATTESTATIONS}/*`, { status: 200, body: {} })
    await declineExit(holder)
    await quietWindow(8_000)
    expect(await sentTo(`${ATTESTATIONS}/${holderAttestation}/revoke`)).toHaveLength(0)
    expect((await cardOf(holder))?.state).toBe('Active')
  })

  it(caseName('cc.att.happy.04', 'выход пайщика завершён — в сеть уходит подписанный отзыв, названный по идентификатору свидетельства'), async () => {
    await stubRoute('POST', `${ATTESTATIONS}/*`, { status: 200, body: {} })
    await completeExit(holder)

    // cc.mbr.happy.02: отозвано свидетельство именно того пайщика, чей выход.
    const [revoke] = await awaitSent(`${ATTESTATIONS}/${holderAttestation}/revoke`, () => true, 1, 'отзыв свидетельства ушёл в сеть')
    expect(revoke.body.payload).toMatchObject({ type: 'revocation', coopname: COOP, attestation_id: holderAttestation, chain_id: chainId })
    expect(Number.isNaN(Date.parse(revoke.body.payload.issued_at))).toBe(false)
    expect(signerOf(revoke.body)).toBe(certKey)

    // Других отзывов выход не породил.
    const all = (await sentTo(`${ATTESTATIONS}/*`)).filter(r => r.path.endsWith('/revoke'))
    expect(all.map(r => r.body.payload.attestation_id)).toEqual([holderAttestation])
  })

  it(caseName('cc.mbr.break.02', 'сеть приняла свидетельство, но идентификатор не назвала; пайщик вышел — отзывать в сети нечем, запроса отзыва нет'), async () => {
    await stubRoute('POST', ATTESTATIONS, { status: 201, body: {} })
    const member = await memberWithProfile('ccni', 'individual', individualData())
    await linkCard(member)
    await cardState(member, 'Active', 'свидетельство принято без идентификатора')
    const before = (await sentTo(`${ATTESTATIONS}/*`)).filter(r => r.path.endsWith('/revoke')).length

    await completeExit(member)
    await quietWindow(10_000)
    expect((await sentTo(`${ATTESTATIONS}/*`)).filter(r => r.path.endsWith('/revoke'))).toHaveLength(before)
  })

  it(caseName('cc.mbr.break.03', 'отзыв не доставлен: сеть отвечает ошибкой — попытки повторяются, отзыв успехом не засчитывается'), async () => {
    const attestationId = `att-${crypto.randomUUID()}`
    await stubRoute('POST', ATTESTATIONS, { status: 201, body: { id: attestationId } })
    const member = await memberWithProfile('ccnf', 'individual', individualData())
    await linkCard(member)
    await cardState(member, 'Active', 'свидетельство принято сетью')

    await stubRoute('POST', `${ATTESTATIONS}/${attestationId}/revoke`, { status: 503, body: { error: 'сеть на обслуживании' } })
    await completeExit(member)
    const attempts = await awaitSent(`${ATTESTATIONS}/${attestationId}/revoke`, () => true, 5, 'пять попыток отзыва')
    expect(attempts).toHaveLength(5)
    for (const attempt of attempts)
      expect(attempt.body.payload.attestation_id).toBe(attestationId)
  })
})

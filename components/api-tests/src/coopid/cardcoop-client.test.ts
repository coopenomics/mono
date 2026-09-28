/**
 * Клиент card.coop в CoopID кооператива (coopid.cardcoop-client): контур claims.
 *
 * Когда пайщик входит на card.coop через CoopID своего кооператива, authentik
 * спрашивает у контроллера `GET /coop/internal/participant-claims` — член ли
 * это кооператива, с какого момента и какая у него подтверждённая почта. Тест
 * говорит от лица authentik его же секретом стенда (coopid-b.helpers.ts).
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COOP, DEFAULT_WIF, caseName, freshMember, gql, login, randomAccount, transact, waitFor } from '../core'
import { ensureIdentityVerified } from '../marketplace/flow'
import { jwtPayload, participantClaims, registerCandidate, uniqueEmail, uniqueIp, webhookToken } from './coopid-b.helpers'

/** Уровни верификации без поля status (его нет в удостоверении) — для сверки. */
function levels(entries: any[]): any[] {
  return entries
    .map(e => ({ type: e.type, verified_at: e.verified_at, source: e.source, attested_by: e.attested_by ?? null, attested_in: e.attested_in ?? null }))
    .sort((a, b) => String(a.type).localeCompare(String(b.type)))
}

describe('coopid.cardcoop-client: claims для card.coop', () => {
  let token: string
  let member: Who

  beforeAll(async () => {
    token = webhookToken()
    member = freshMember({ prefix: 'ccm' })
  })

  it(caseName('cid.cc.happy.01', 'принятый пайщик: member=true, дата приёма и уровни — как в удостоверении'), async () => {
    // Сверка личности добавляет второй уровень — сравнение с удостоверением не вырождается в один элемент.
    await ensureIdentityVerified(member.account)

    const r = await participantClaims(member.account, token)
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ coopname: COOP, username: member.account, member: true })

    const cert = await gql<any>(await login(member), '{ getMyCertificate{ participant_certificate } }')
    const certTypes: any[] = jwtPayload(cert.getMyCertificate.participant_certificate).verification_types
    const baseline = certTypes.find(t => t.type === 'coop_baseline')
    expect(baseline).toBeTruthy()
    expect(r.body.member_since).toBe(baseline.verified_at)
    expect(certTypes.length).toBeGreaterThan(1)
    expect(levels(r.body.verification_types)).toEqual(levels(certTypes))
  })

  it(caseName('cid.cc.happy.02', 'подтверждённая кооперативом почта: email и email_verified=true'), async () => {
    const r = await participantClaims(member.account, token)
    expect(r.status).toBe(200)
    expect(r.body.email).toBe(member.email)
    expect(r.body.email_verified).toBe(true)
  })

  it(caseName('cid.cc.side.01', 'кандидат и посторонний: member=false, даты и уровней нет, отказа нет'), async () => {
    const candidate = await registerCandidate(uniqueIp(), uniqueEmail('ccc'))
    const outsider = randomAccount('ccx')

    for (const username of [candidate.username, outsider]) {
      const r = await participantClaims(username, token)
      expect(r.status, username).toBe(200)
      expect(r.body, username).toMatchObject({ username, member: false, member_since: null, verification_types: [] })
    }
  })

  it(caseName('cid.cc.side.03', 'аккаунт в цепи есть, учётной записи в кооперативе нет: claims без почты'), async () => {
    const username = randomAccount('cch')
    const created = new Date(Date.now() - 30_000).toISOString().slice(0, 19)
    await transact({ account: COOP, email: '', wif: DEFAULT_WIF }, [{
      account: 'registrator',
      name: 'adduser',
      data: {
        coopname: COOP,
        referer: '',
        username,
        type: 'individual',
        created_at: created,
        initial: '100.0000 RUB',
        minimum: '100.0000 RUB',
        spread_initial: false,
        meta: 'api-tests: аккаунт в цепи без учётной записи',
        registration_hash: crypto.randomBytes(32).toString('hex'),
      },
    }])

    // Запись в цепь мимо контроллера — ждём, пока контроллер увидит участника.
    const r = await waitFor(async () => {
      const res = await participantClaims(username, token)
      return res.status === 200 && res.body?.member === true ? res : null
    }, { label: `участник ${username} в claims` })
    expect(r.body).toMatchObject({ username, email: null, email_verified: false, member: true })
  })

  it(caseName('cid.cc.side.04', 'почта есть, но не подтверждена: отдаётся с email_verified=false'), async () => {
    const candidate = await registerCandidate(uniqueIp(), uniqueEmail('ccu'))
    expect(candidate.isEmailVerified).toBe(false)

    const r = await participantClaims(candidate.username, token)
    expect(r.status).toBe(200)
    expect(r.body.email).toBe(candidate.email)
    expect(r.body.email_verified).toBe(false)
  })

  it(caseName('cid.cc.break.01', 'без токена внутреннего контура — 401'), async () => {
    const r = await participantClaims(member.account, null)
    expect(r.status).toBe(401)
    expect(r.body?.member).toBeUndefined()
  })

  it(caseName('cid.cc.break.02', 'токен той же длины, но другой — 401'), async () => {
    const forged = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect(forged.length).toBe(token.length)
    const r = await participantClaims(member.account, forged)
    expect(r.status).toBe(401)
    expect(r.body?.member).toBeUndefined()
  })

  it(caseName('cid.cc.break.04', 'без имени аккаунта — 400, а не пустые claims'), async () => {
    const r = await participantClaims(null, token)
    expect(r.status).toBe(400)
    expect(r.body?.code).toBe('AUTH_V2_USERNAME_REQUIRED')
  })
})

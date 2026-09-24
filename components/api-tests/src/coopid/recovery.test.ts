/**
 * Восстановление доступа ссылкой по почте (coopid.recovery).
 *
 * Наружу ручка `POST /coop/recovery/request` отвечает 202 при любом исходе —
 * существование адреса не раскрывается. Снаружи различимо одно: поставлено ли
 * письмо со ссылкой в очередь Центра уведомлений (журнал уведомлений
 * председателя). Им тесты и отличают «письмо ушло» от «письма нет»; причина
 * отказа (audit) — внутренность, её проверяют юнит-тесты.
 *
 * Пайщики — кандидаты открытой регистрации: у них есть адрес Центра
 * уведомлений (subscriber_id), и восстановление доступа их не портит — ссылка
 * живёт 5 минут и ничего не меняет, пока её не подтвердили.
 */
import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { caseName, freshMember } from '../core'
import type { Candidate } from './coopid-b.helpers'
import {
  WF_RECOVERY,
  confirmEmailCode,
  gqlOkFrom,
  outbox,
  registerCandidate,
  requestAndReadCode,
  rest,
  totp,
  uniqueEmail,
  uniqueIp,
} from './coopid-b.helpers'

async function requestRecovery(email: string, ip = uniqueIp()) {
  return rest('POST', '/coop/recovery/request', { ip, body: { email } })
}

async function recoveryLetters(candidate: Candidate) {
  return outbox({ workflowId: WF_RECOVERY, recipientSubscriberId: candidate.subscriberId })
}

/** Сколько писем восстановления в очереди всего: файлы идут по очереди, чужих вставок в тесте нет. */
async function recoveryLettersTotal(): Promise<number> {
  return (await outbox({ workflowId: WF_RECOVERY }, 1)).totalCount
}

describe('coopid.recovery: запрос ссылки восстановления', () => {
  it(caseName('cid.rec.happy.01', 'пайщик с подтверждённой почтой: 202 и письмо со ссылкой в очереди'), async () => {
    const email = uniqueEmail('rch')
    const ip = uniqueIp()
    const code = await requestAndReadCode(ip, email)
    expect((await confirmEmailCode(ip, email, code)).errors).toEqual([])
    const candidate = await registerCandidate(uniqueIp(), email)
    expect(candidate.isEmailVerified).toBe(true)

    const r = await requestRecovery(email)
    expect(r.status).toBe(202)

    const letters = await recoveryLetters(candidate)
    expect(letters.totalCount).toBe(1)
    expect(letters.items[0]).toMatchObject({ workflowId: WF_RECOVERY, channel: 'EMAIL', recipientUsername: candidate.username })
  })

  it(caseName('cid.rec.side.01', 'почта не подтверждена: письмо всё равно уходит'), async () => {
    const candidate = await registerCandidate(uniqueIp(), uniqueEmail('rcu'))
    expect(candidate.isEmailVerified).toBe(false)

    const r = await requestRecovery(candidate.email)
    expect(r.status).toBe(202)
    expect((await recoveryLetters(candidate)).totalCount).toBe(1)
  })

  it(caseName('cid.rec.side.02', 'адрес с пробелами и в другом регистре находит того же пайщика'), async () => {
    const candidate = await registerCandidate(uniqueIp(), uniqueEmail('rcn'))

    const r = await requestRecovery(`  ${candidate.email.toUpperCase()}  `)
    expect(r.status).toBe(202)
    const letters = await recoveryLetters(candidate)
    expect(letters.totalCount).toBe(1)
    expect(letters.items[0].recipientUsername).toBe(candidate.username)
  })

  it(caseName('cid.rec.break.01', 'адрес с опечаткой: тот же 202, что и у существующего, письма нет'), async () => {
    const candidate = await registerCandidate(uniqueIp(), uniqueEmail('rct'))
    const known = await requestRecovery(candidate.email)

    const before = await recoveryLettersTotal()
    const typo = await requestRecovery(candidate.email.replace(/\.coop$/, '.coo'))
    expect(typo.status).toBe(202)
    expect(typo.text).toBe(known.text)
    expect(await recoveryLettersTotal()).toBe(before)
  })

  it(caseName('cid.rec.break.02', 'у пайщика нет адреса Центра уведомлений (subscriber_id): 202, письма нет'), async () => {
    // Пайщик фабрики стенда заводится мимо регистрации — subscriber_id у него не выпускается.
    const member = freshMember({ prefix: 'rcs' })

    const before = await recoveryLettersTotal()
    const r = await requestRecovery(member.email)
    expect(r.status).toBe(202)
    expect(await recoveryLettersTotal()).toBe(before)
  })

  it(caseName('cid.rec.break.03', 'выбрана стратегия без почтового канала: 202, письма нет'), async () => {
    const candidate = await registerCandidate(uniqueIp(), uniqueEmail('rcg'))
    const ip = uniqueIp()
    const enroll = await gqlOkFrom<any>(ip, candidate.token, 'mutation{ enrollTwoFactor{ secret otpauth_uri } }')
    const secret = enroll.enrollTwoFactor.secret as string
    await gqlOkFrom(ip, candidate.token, 'mutation($d:TwoFactorCodeInput!){ activateTwoFactor(data:$d) }', { d: { code: totp(secret) } })
    await gqlOkFrom(ip, candidate.token, 'mutation($d:SetRecoveryStrategyInput!){ setRecoveryStrategy(data:$d) }', {
      d: { strategy: 'OfflineCode', code: totp(secret) },
    })
    const strategy = await gqlOkFrom<any>(ip, candidate.token, '{ getRecoveryStrategy }')
    expect(strategy.getRecoveryStrategy).toBe('OfflineCode')

    const r = await requestRecovery(candidate.email)
    expect(r.status).toBe(202)
    expect((await recoveryLetters(candidate)).totalCount).toBe(0)
  })
})

describe('coopid.recovery: контекст ссылки', () => {
  it(caseName('cid.rec.break.06', 'контекст по недействительному токену — invalid_recovery_token'), async () => {
    const r = await rest('GET', `/coop/recovery/context/${crypto.randomUUID()}`, { ip: uniqueIp() })
    expect(r.status).toBe(400)
    expect(r.body?.error).toBe('invalid_recovery_token')
  })
})

/**
 * Подтверждение электронной почты кодом из письма (coopid.email-verification).
 *
 * Состояние привязано к адресу, а не к учётной записи: код спрашивают на шаге
 * ввода почты, когда пайщика ещё нет. Поэтому тесты ходят незнакомыми стенду
 * адресами и кандидатами открытой регистрации — общих участников не трогают.
 * Письмо на стенде никуда не уходит: факт постановки в очередь виден в журнале
 * уведомлений председателя, а сам код тест читает из журнала контроллера
 * (coopid-b.helpers.ts, mailboxCode).
 */
import { describe, expect, it } from 'vitest'
import { caseName } from '../core'
import {
  WF_EMAIL_VERIFICATION,
  confirmEmailCode,
  emailSubscriber,
  isEmailVerified,
  outbox,
  registerCandidate,
  requestAndReadCode,
  requestEmailCode,
  uniqueEmail,
  uniqueIp,
  wrongCode,
} from './coopid-b.helpers'

async function lettersTo(email: string) {
  return outbox({ workflowId: WF_EMAIL_VERIFICATION, recipientSubscriberId: emailSubscriber(email) })
}

describe('coopid.email-verification: код подтверждения почты', () => {
  it(caseName('cid.ev.happy.01', 'код уходит письмом на нормализованный адрес, в ответе окно повтора 60 с и срок кода 900 с'), async () => {
    const email = uniqueEmail('evh')
    const r = await requestEmailCode(uniqueIp(), email.toUpperCase())
    expect(r.errors).toEqual([])
    expect(r.data.requestEmailVerification).toEqual({ cooldown_seconds: 60, expires_seconds: 900 })

    const letters = await lettersTo(email)
    expect(letters.totalCount).toBe(1)
    expect(letters.items[0]).toMatchObject({ workflowId: WF_EMAIL_VERIFICATION, channel: 'EMAIL', recipientSubscriberId: emailSubscriber(email) })
  })

  it(caseName('cid.ev.side.01', 'повторный запрос в окне троттла: второго письма нет, в ответе остаток окна'), async () => {
    const ip = uniqueIp()
    const email = uniqueEmail('evs')
    const first = await requestEmailCode(ip, email)
    expect(first.errors).toEqual([])

    const again = await requestEmailCode(ip, email)
    expect(again.errors).toEqual([])
    const { cooldown_seconds, expires_seconds } = again.data.requestEmailVerification
    expect(cooldown_seconds).toBeGreaterThan(0)
    expect(cooldown_seconds).toBeLessThanOrEqual(60)
    expect(expires_seconds).toBe(900)

    expect((await lettersTo(email)).totalCount).toBe(1)
  })

  it(caseName('cid.ev.happy.02', 'верный код от существующего пайщика: почта подтверждена'), async () => {
    const email = uniqueEmail('evp')
    const candidate = await registerCandidate(uniqueIp(), email)
    expect(candidate.isEmailVerified).toBe(false)

    const ip = uniqueIp()
    const code = await requestAndReadCode(ip, email)
    const r = await confirmEmailCode(ip, email, code)
    expect(r.errors).toEqual([])
    expect(r.data.confirmEmailVerification).toBe(true)
    expect(await isEmailVerified(candidate.username)).toBe(true)

    // Код сожжён: тот же код второй раз не принимается (cid.ev.break.04 ниже — на своём адресе).
    const reuse = await confirmEmailCode(ip, email, code)
    expect(reuse.errors[0]?.code).toBe('AUTH_EMAIL_CODE_NOT_REQUESTED')
  })

  it(caseName('cid.ev.happy.03', 'верный код до создания учётной записи: отметка адреса переходит на зарегистрированного'), async () => {
    const email = uniqueEmail('evr')
    const ip = uniqueIp()
    const code = await requestAndReadCode(ip, email)
    const r = await confirmEmailCode(ip, email, code)
    expect(r.errors).toEqual([])
    expect(r.data.confirmEmailVerification).toBe(true)

    const candidate = await registerCandidate(uniqueIp(), email)
    expect(candidate.isEmailVerified).toBe(true)
    expect(await isEmailVerified(candidate.username)).toBe(true)
  })

  it(caseName('cid.ev.side.02', 'неверный код: отказ, почта не подтверждается, верный код после этого действует'), async () => {
    const email = uniqueEmail('evw')
    const candidate = await registerCandidate(uniqueIp(), email)
    const ip = uniqueIp()
    const code = await requestAndReadCode(ip, email)

    const bad = await confirmEmailCode(ip, email, wrongCode(code))
    expect(bad.errors[0]?.code).toBe('AUTH_EMAIL_CODE_INVALID')
    expect(await isEmailVerified(candidate.username)).toBe(false)

    const good = await confirmEmailCode(ip, email, code)
    expect(good.errors).toEqual([])
    expect(await isEmailVerified(candidate.username)).toBe(true)
  })

  it(caseName('cid.ev.break.01', 'пятая неверная попытка сжигает код целиком'), async () => {
    const email = uniqueEmail('evb')
    const ip = uniqueIp()
    const code = await requestAndReadCode(ip, email)
    const bad = wrongCode(code)

    for (let i = 1; i <= 4; i++) {
      const r = await confirmEmailCode(ip, email, bad)
      expect(r.errors[0]?.code, `попытка ${i}`).toBe('AUTH_EMAIL_CODE_INVALID')
    }
    const fifth = await confirmEmailCode(ip, email, bad)
    expect(fifth.errors[0]?.code).toBe('AUTH_EMAIL_CODE_TOO_MANY_ATTEMPTS')

    const late = await confirmEmailCode(ip, email, code)
    expect(late.errors[0]?.code).toBe('AUTH_EMAIL_CODE_NOT_REQUESTED')
  })

  it(caseName('cid.ev.break.02', 'один адрес клиента: после 20 запросов за час отказ до отправки письма'), async () => {
    const ip = uniqueIp()
    for (let i = 1; i <= 20; i++) {
      const r = await requestEmailCode(ip, uniqueEmail('evl'))
      expect(r.errors, `запрос ${i}`).toEqual([])
    }
    const email = uniqueEmail('evl')
    const over = await requestEmailCode(ip, email)
    expect(over.errors[0]?.code).toBe('AUTH_EMAIL_RATE_LIMIT_GENERAL')
    expect((await lettersTo(email)).totalCount).toBe(0)
  })

  it(caseName('cid.ev.break.04', 'уже принятый код второй раз не принимается'), async () => {
    const email = uniqueEmail('evo')
    const ip = uniqueIp()
    const code = await requestAndReadCode(ip, email)
    expect((await confirmEmailCode(ip, email, code)).errors).toEqual([])

    const again = await confirmEmailCode(ip, email, code)
    expect(again.errors[0]?.code).toBe('AUTH_EMAIL_CODE_NOT_REQUESTED')
  })

  it(caseName('cid.ev.side.03', 'строка без @: отказ до обращения к почте'), async () => {
    const raw = `${uniqueEmail('evx').replace('@', '-')}`
    const r = await requestEmailCode(uniqueIp(), raw)
    expect(r.data?.requestEmailVerification ?? null).toBeNull()
    // Отказ даёт проверка входа (class-validator, 400) раньше сервиса с его
    // AUTH_EMAIL_INVALID — оба ответа означают «до почты не дошли».
    expect(['AUTH_EMAIL_INVALID', 400, '400']).toContain(r.errors[0]?.code)
    expect((await lettersTo(raw)).totalCount).toBe(0)
  })
})

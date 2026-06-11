import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import {
  CERTIFICATE_RENEWAL_LEAD_MS,
  computeRenewalDelayMs,
  scheduleCertificateRenewal,
} from '../src/certificate'

/** Собрать декодируемый compact-JWS с нужными claims (подпись не проверяется при decode). */
function fakeCert(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256K', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ jti: 'serial-1', sub: 'uuid-1', ...claims })).toString('base64url')
  return `${header}.${payload}.sig`
}

describe('computeRenewalDelayMs', () => {
  it('обычный кейс: задержка до exp − lead', () => {
    const nowMs = 1_000_000
    const exp = Math.floor(nowMs / 1000) + 3600 // +1ч
    const delay = computeRenewalDelayMs({ exp }, nowMs)
    expect(delay).toBe(3600 * 1000 - CERTIFICATE_RENEWAL_LEAD_MS)
  })

  it('до exp осталось ≤ lead → 0 (перезапрос немедленно)', () => {
    const nowMs = 1_000_000
    const exp = Math.floor(nowMs / 1000) + 120 // 2 мин < lead (5 мин)
    expect(computeRenewalDelayMs({ exp }, nowMs)).toBe(0)
  })

  it('cert уже истёк → 0', () => {
    const nowMs = 1_000_000
    const exp = Math.floor(nowMs / 1000) - 10
    expect(computeRenewalDelayMs({ exp }, nowMs)).toBe(0)
  })
})

describe('scheduleCertificateRenewal', () => {
  it('срабатывает в exp − lead, зовёт renew и перепланирует от нового cert', async () => {
    let currentNow = 0
    const timers: Array<{ cb: () => void, delay: number }> = []
    const setTimer = vi.fn((cb: () => void, delay: number) => {
      timers.push({ cb, delay })
      return timers.length as any
    })
    const clearTimer = vi.fn()

    const firstExp = 3600 // сек
    const secondExp = 7200
    const first = fakeCert({ exp: firstExp })
    const second = fakeCert({ exp: secondExp })
    const renew = vi.fn().mockResolvedValue(second)

    scheduleCertificateRenewal(first, renew, { now: () => currentNow, setTimer, clearTimer })

    // первый таймер запланирован на exp − lead
    expect(setTimer).toHaveBeenCalledTimes(1)
    expect(timers[0].delay).toBe(firstExp * 1000 - CERTIFICATE_RENEWAL_LEAD_MS)

    // время дошло до срабатывания → дёргаем callback
    currentNow = firstExp * 1000 - CERTIFICATE_RENEWAL_LEAD_MS
    timers[0].cb()
    await Promise.resolve()
    await Promise.resolve()

    expect(renew).toHaveBeenCalledTimes(1)
    // перепланирование от exp нового сертификата
    expect(setTimer).toHaveBeenCalledTimes(2)
    expect(timers[1].delay).toBe(secondExp * 1000 - CERTIFICATE_RENEWAL_LEAD_MS - currentNow)
  })

  it('cancel() отменяет запланированный таймер и не перепланирует', async () => {
    const timers: Array<{ cb: () => void, delay: number }> = []
    const setTimer = vi.fn((cb: () => void, delay: number) => {
      timers.push({ cb, delay })
      return timers.length as any
    })
    const clearTimer = vi.fn()
    const renew = vi.fn().mockResolvedValue(fakeCert({ exp: 7200 }))

    const handle = scheduleCertificateRenewal(fakeCert({ exp: 3600 }), renew, { now: () => 0, setTimer, clearTimer })
    handle.cancel()
    expect(clearTimer).toHaveBeenCalledTimes(1)

    // даже если таймер «выстрелит» после cancel — renew не перепланирует
    timers[0].cb()
    await Promise.resolve()
    expect(setTimer).toHaveBeenCalledTimes(1)
  })
})

import { describe, expect, it } from 'vitest'
import { AUTH_V2_ERROR_VIEWS, AuthV2Error, AuthV2ErrorCode, describeAuthV2Error } from '../src/index'

describe('describeAuthV2Error (Story 1.11)', () => {
  it('каталог покрывает каждый код ошибки', () => {
    for (const code of Object.values(AuthV2ErrorCode))
      expect(AUTH_V2_ERROR_VIEWS[code], code).toBeDefined()
  })

  it('по AC: неверные учётные данные — общее сообщение без раскрытия поля', () => {
    const view = describeAuthV2Error(new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'whatever'))
    expect(view.code).toBe(AuthV2ErrorCode.InvalidCredentials)
    expect(view.message).toBe('Неверный email или пароль.')
    // перечисляет оба поля через «или» — не раскрывает, какое именно неверно (security)
    expect(view.message).toMatch(/email или пароль/i)
    expect(view.message).not.toMatch(/не найден|не существует|нет такого|такой email/i)
    expect(view.keepSession).toBe(false)
  })

  it('по AC: vault не расшифровывается — предлагает восстановление доступа', () => {
    const view = describeAuthV2Error(new AuthV2Error(AuthV2ErrorCode.VaultDecryptionFailed, 'bad key'))
    expect(view.action).toBe('recover')
    expect(view.message).toMatch(/восстановить доступ/i)
  })

  it('по AC: сетевая ошибка — «проверьте интернет» и НЕ разлогинивает (NFR20/FR50)', () => {
    const view = describeAuthV2Error(new AuthV2Error(AuthV2ErrorCode.NetworkError, 'fetch failed'))
    expect(view.action).toBe('check_connection')
    expect(view.message).toMatch(/проверьте интернет/i)
    expect(view.keepSession).toBe(true)
  })

  it('внешний сбой (кооператив недоступен) — сессия сохраняется', () => {
    expect(describeAuthV2Error(new AuthV2Error(AuthV2ErrorCode.CooposDegraded, 'down')).keepSession).toBe(true)
  })

  it('неожиданная (не-AuthV2) ошибка — безопасный фолбэк без утечки technical message', () => {
    const view = describeAuthV2Error(new Error('TypeError: cannot read property x of undefined'))
    expect(view.code).toBeNull()
    expect(view.message).not.toMatch(/TypeError|undefined/)
    expect(view.keepSession).toBe(true)
  })

  it('сообщение берётся из каталога, а не из e.message сервера', () => {
    const view = describeAuthV2Error(new AuthV2Error(AuthV2ErrorCode.TimestampTooOld, 'raw server text'))
    expect(view.message).not.toBe('raw server text')
    expect(view.message).toBe(AUTH_V2_ERROR_VIEWS[AuthV2ErrorCode.TimestampTooOld].message)
  })
})

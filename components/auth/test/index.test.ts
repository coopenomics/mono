import { describe, expect, it } from 'vitest'
import * as api from '../src/index'
import { AuthV2Error, AuthV2ErrorCode } from '../src/index'

const PUBLIC_API = [
  'login',
  'loginWithMagicLink',
  'recover',
  'getAccessToken',
  'getParticipantCertificate',
  'logout',
  'verifyOffline',
  'signDocument',
  'signTimestamp',
  'getWallet',
  'rotateKey',
  'exportToQR',
] as const

// Методы, ещё не реализованные (бросают not_implemented). По мере реализации
// историй метод уходит отсюда: getWallet — 2.2, signTimestamp — 2.4 (реализованы).
const IMPLEMENTED = new Set(['getWallet', 'signTimestamp', 'getParticipantCertificate', 'logout'])
const STILL_STUBBED = PUBLIC_API.filter(m => !IMPLEMENTED.has(m))

describe('@coopenomics/auth — скелет SDK', () => {
  it('экспортирует всю публичную поверхность', () => {
    for (const method of PUBLIC_API)
      expect(api[method], method).toBeTypeOf('function')
  })

  it('stub\'ы отказывают типизированной AuthV2Error(not_implemented), а не молчат', async () => {
    for (const method of STILL_STUBBED) {
      const err = await (api[method] as () => Promise<unknown>)().then(
        () => null,
        e => e,
      )
      expect(err, method).toBeInstanceOf(AuthV2Error)
      expect((err as AuthV2Error).code, method).toBe(AuthV2ErrorCode.NotImplemented)
    }
  })

  it('ошибка сериализуется в формат OAuth 2.0', () => {
    const err = new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Неверный email или пароль')
    expect(err.toJSON()).toEqual({
      error: 'invalid_credentials',
      error_description: 'Неверный email или пароль',
    })
  })

  it('trust anchor и список нод доступны (placeholder до Stories 1.3/9.5)', () => {
    expect(api.TRUST_ANCHOR_ANO_CERT_JWK).toBeNull()
    expect(api.COOPOS_PUBLIC_NODES).toEqual([])
  })
})

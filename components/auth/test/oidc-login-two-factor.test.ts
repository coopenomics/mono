import { PrivateKey } from '@wharfkit/antelope'
import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthV2Error, AuthV2ErrorCode } from '../src/errors'
import { configureCoopId } from '../src/oidc/client'
import { performTimestampHandshake } from '../src/oidc/handshake'
import { clearSession, currentTokens } from '../src/oidc/tokens'
import { confirmLoginFactor, resendLoginEmailCode } from '../src/oidc/two-factor'
import { storeUnlocked, wipeKeystore } from '../src/wallet/storage'

const KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
const PUB = PrivateKey.from(KEY).toPublic().toString()
const ACCOUNT = 'ant'
const API = 'https://coop.example'

async function bindingTokenFor(sub: string, jti = 'jti-1'): Promise<string> {
  return new SignJWT({ stage_completed: 'password' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('120s')
    .sign(new TextEncoder().encode('test-binding-secret'))
}

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

beforeEach(() => {
  clearSession()
  configureCoopId({ apiUrl: API })
  storeUnlocked({ account: ACCOUNT, publicKey: PUB, privateKey: KEY })
})

afterEach(() => {
  wipeKeystore()
  vi.unstubAllGlobals()
})

describe('2FA-вход: challenge из handshake + confirmLoginFactor', () => {
  it('handshake с second_factor_required → SecondFactorRequired с challenge в details, токены НЕ сохранены', async () => {
    const binding = await bindingTokenFor(ACCOUNT)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(okJson({ binding_token: binding, expires_in: 120 }))
      .mockResolvedValueOnce(okJson({ second_factor_required: true, challenge_token: 'ch-1', factors: ['totp', 'email'] })))

    const err = await performTimestampHandshake(API).then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.SecondFactorRequired)
    expect((err as AuthV2Error).details).toEqual({ challenge_token: 'ch-1', factors: ['totp', 'email'] })
    // Криптографический инвариант клиента: без кодов сессии нет.
    expect(currentTokens()).toBeNull()
  })

  it('confirmLoginFactor: промежуточный фактор → done:false + следующий фактор, сессии всё ещё нет', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(okJson({ passed_factor: 'totp', next_factor: 'email' })))

    const r = await confirmLoginFactor({ challengeToken: 'ch-1', code: '123456' })
    expect(r).toEqual({ done: false, passedFactor: 'totp', nextFactor: 'email' })
    expect(currentTokens()).toBeNull()
  })

  it('confirmLoginFactor: финальный фактор → done:true, токены сохранены в сессию', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okJson({ access_token: 'acc', refresh_token: 'ref', participant_certificate: 'cert' }))
    vi.stubGlobal('fetch', fetchMock)

    const r = await confirmLoginFactor({ challengeToken: 'ch-1', code: '654321' })
    expect(r).toMatchObject({ done: true, accessToken: 'acc', refreshToken: 'ref', participantCertificate: 'cert' })
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/coop/verify/2fa/confirm`)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ challenge_token: 'ch-1', code: '654321' })
    expect(currentTokens()).toEqual({ accessToken: 'acc', refreshToken: 'ref' })
  })

  it('confirmLoginFactor: неверный код → AuthV2Error с кодом сервера', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'invalid_2fa_code', error_description: 'Неверный код из письма.' }) }))

    await expect(confirmLoginFactor({ challengeToken: 'ch-1', code: '000000' }))
      .rejects.toMatchObject({ code: AuthV2ErrorCode.InvalidTwoFactorCode })
    expect(currentTokens()).toBeNull()
  })

  it('confirmLoginFactor: challenge истёк → login_challenge_expired', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'login_challenge_expired', error_description: 'Войдите заново.' }) }))

    await expect(confirmLoginFactor({ challengeToken: 'ch-old', code: '111111' }))
      .rejects.toMatchObject({ code: AuthV2ErrorCode.LoginChallengeExpired })
  })

  it('resendLoginEmailCode: 202 — успех; 429 → too_many_attempts', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 202, json: async () => ({ status: 'sent' }) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: 'too_many_attempts', error_description: 'Подождите минуту.' }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(resendLoginEmailCode('ch-1')).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/coop/verify/2fa/resend`)
    await expect(resendLoginEmailCode('ch-1')).rejects.toMatchObject({ code: AuthV2ErrorCode.TooManyAttempts })
  })
})

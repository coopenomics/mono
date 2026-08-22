import { PrivateKey } from '@wharfkit/antelope'
import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthV2Error } from '../src/errors'
import { performTimestampHandshake } from '../src/oidc/handshake'
import { clearSession, currentTokens } from '../src/oidc/tokens'
import { storeUnlocked, wipeKeystore } from '../src/wallet/storage'

const KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
const PUB = PrivateKey.from(KEY).toPublic().toString()
const ACCOUNT = 'ant'

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
  storeUnlocked({ account: ACCOUNT, publicKey: PUB, privateKey: KEY })
})

afterEach(() => {
  wipeKeystore()
  vi.unstubAllGlobals()
})

describe('performTimestampHandshake (Story 1.7) — handshake внутрь SDK', () => {
  it('bind → sign → verify: токены/сертификат + сессия сохранена; credentials:include на обоих', async () => {
    const binding = await bindingTokenFor(ACCOUNT)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okJson({ binding_token: binding, expires_in: 120 }))
      .mockResolvedValueOnce(okJson({ access_token: 'acc', refresh_token: 'ref', participant_certificate: 'cert', degraded: false }))
    vi.stubGlobal('fetch', fetchMock)

    const r = await performTimestampHandshake('https://coop.example/')

    expect(r).toMatchObject({ accessToken: 'acc', refreshToken: 'ref', participantCertificate: 'cert', degraded: false })
    expect(fetchMock.mock.calls[0][0]).toBe('https://coop.example/coop/session/bind')
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
    expect(fetchMock.mock.calls[1][0]).toBe('https://coop.example/coop/verify/timestamp')
    expect(fetchMock.mock.calls[1][1].credentials).toBe('include')
    const verifyBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(verifyBody.binding_token).toBe(binding)
    expect(typeof verifyBody.signature).toBe('string')
    expect(typeof verifyBody.timestamp).toBe('string')
    expect(currentTokens()).toEqual({ accessToken: 'acc', refreshToken: 'ref' })
  })

  it('degraded-вход (узел недоступен/ключ не финализирован) прокидывается', async () => {
    const binding = await bindingTokenFor(ACCOUNT)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(okJson({ binding_token: binding, expires_in: 120 }))
      .mockResolvedValueOnce(okJson({ access_token: 'a', refresh_token: 'r', degraded: true, degraded_reason: 'rpc_unavailable' })))

    const r = await performTimestampHandshake('https://coop.example')
    expect(r.degraded).toBe(true)
    expect(r.degradedReason).toBe('rpc_unavailable')
  })

  it('bind 401 → InvalidCredentials (сессия authentik не подтверждена), сессия не сохраняется', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) }))
    await expect(performTimestampHandshake('https://coop.example')).rejects.toBeInstanceOf(AuthV2Error)
    expect(currentTokens()).toBeNull()
  })

  it('verify !ok → AuthV2Error с кодом из тела (OAuth2 error)', async () => {
    const binding = await bindingTokenFor(ACCOUNT)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(okJson({ binding_token: binding, expires_in: 120 }))
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'chain_verification_failed', error_description: 'Подпись не соответствует ключу' }) }))

    await expect(performTimestampHandshake('https://coop.example')).rejects.toMatchObject({ code: 'chain_verification_failed' })
  })

  it('кошелёк заперт → WalletLocked (подпись невозможна, verify не вызывается)', async () => {
    wipeKeystore()
    const binding = await bindingTokenFor(ACCOUNT)
    const fetchMock = vi.fn().mockResolvedValueOnce(okJson({ binding_token: binding, expires_in: 120 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(performTimestampHandshake('https://coop.example')).rejects.toMatchObject({ code: 'wallet_locked' })
    expect(fetchMock).toHaveBeenCalledTimes(1) // только bind, до verify не дошли
  })
})

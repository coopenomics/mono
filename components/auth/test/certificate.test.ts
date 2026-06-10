import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { AuthV2Error, AuthV2ErrorCode } from '../src/errors'
import {
  CERTIFICATE_EXPIRING_WINDOW_MS,
  certificateStatus,
  decodeParticipantCertificate,
  verificationTypeLabel,
} from '../src/certificate'

async function makeCert(overrides: Record<string, unknown> = {}, opts: { jti?: string, exp?: string } = {}): Promise<string> {
  let b = new SignJWT({
    coopname: 'voskhod',
    coop_chain: [
      { account: 'ano', public_key: 'PUB_K1_ano' },
      { account: 'voskhod', public_key: 'PUB_K1_vos' },
      { account: 'vostok', public_key: 'PUB_K1_vostok' },
    ],
    verification_types: ['coop_baseline'],
    identification: { type: 'individual', username: 'ant', first_name: 'Иван' },
    claim_schema_version: '1',
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('https://voskhod.coop')
    .setSubject('uuid-1')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '24h')
  if (opts.jti !== undefined || overrides.jti === undefined) b = b.setJti(opts.jti ?? 'serial-123')
  return b.sign(new TextEncoder().encode('test-secret-padding-000000000000000000'))
}

describe('decodeParticipantCertificate', () => {
  it('декодирует все claims в типизированный объект', async () => {
    const claims = decodeParticipantCertificate(await makeCert())
    expect(claims.sub).toBe('uuid-1')
    expect(claims.jti).toBe('serial-123')
    expect(claims.coopname).toBe('voskhod')
    expect(claims.claim_schema_version).toBe('1')
    expect(claims.verification_types).toEqual(['coop_baseline'])
    expect(claims.coop_chain.map(l => l.account)).toEqual(['ano', 'voskhod', 'vostok'])
    expect(claims.identification).toMatchObject({ type: 'individual', username: 'ant' })
    expect(claims.exp).toBeGreaterThan(claims.iat)
  })

  it('identification может быть null', async () => {
    const claims = decodeParticipantCertificate(await makeCert({ identification: null }))
    expect(claims.identification).toBeNull()
  })

  it('не-JWT строка → AuthV2Error(chain_verification_failed)', () => {
    const err = (() => { try { decodeParticipantCertificate('garbage'); return null } catch (e) { return e } })()
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.ChainVerificationFailed)
  })

  it('без обязательных claims (нет jti) → AuthV2Error', async () => {
    // токен без jti
    const noJti = await new SignJWT({ coopname: 'voskhod' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('uuid-1')
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode('test-secret-padding-000000000000000000'))
    expect(() => decodeParticipantCertificate(noJti)).toThrow(AuthV2Error)
  })
})

describe('certificateStatus', () => {
  const now = 1_900_000_000_000 // фиксированный «сейчас» (мс)
  it('exp в прошлом → expired', () => {
    expect(certificateStatus({ exp: now / 1000 - 10 }, now)).toBe('expired')
  })
  it('exp в окне «истекает» → expiring', () => {
    const exp = (now + CERTIFICATE_EXPIRING_WINDOW_MS - 1000) / 1000
    expect(certificateStatus({ exp }, now)).toBe('expiring')
  })
  it('exp далеко → active', () => {
    const exp = (now + CERTIFICATE_EXPIRING_WINDOW_MS + 10 * 60 * 1000) / 1000
    expect(certificateStatus({ exp }, now)).toBe('active')
  })
})

describe('verificationTypeLabel', () => {
  it('известный тип → человекочитаемое описание', () => {
    expect(verificationTypeLabel('coop_baseline')).toBe('Базовое подтверждение кооперативом')
  })
  it('неизвестный тип → возвращается как есть', () => {
    expect(verificationTypeLabel('future_kyc_x')).toBe('future_kyc_x')
  })
})

import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import {
  CERTIFICATE_EXPIRING_WINDOW_MS,
  certificateStatus,
  decodeParticipantCertificate,
  decodeTrustChain,
  verificationTypeLabel,
  deriveVerificationTypes,
} from '../src/certificate'
import { AuthV2Error, AuthV2ErrorCode } from '../src/errors'

/** Заверение без настоящей подписи: тесты этого файла читают payload, не проверяют его. */
function fakeEndorsement(issuer: string, subject: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'ES256K', typ: 'coop-endorsement+jws' })}.${b64({ iss: issuer, sub: subject, cert: `PUB_K1_${subject}`, exp: 2_000_000_000 })}.signature`
}

const ENDORSEMENT_ANO_VOSKHOD = fakeEndorsement('ano', 'voskhod')
const ENDORSEMENT_VOSKHOD_VOSTOK = fakeEndorsement('voskhod', 'vostok')

async function makeCert(overrides: Record<string, unknown> = {}, opts: { jti?: string, exp?: string } = {}): Promise<string> {
  let b = new SignJWT({
    coopname: 'voskhod',
    // Заверения целиком, по порядку от корня. Здесь важна только читаемость
    // payload — подпись проверяет verifyOffline, у него свои тесты.
    trust_chain: [ENDORSEMENT_ANO_VOSKHOD, ENDORSEMENT_VOSKHOD_VOSTOK],
    verification_types: [{ type: 'coop_baseline', verified_at: '2026-01-02T03:04:05.000Z', source: 'cooperative_decision' }],
    identification: { type: 'individual', username: 'ant', first_name: 'Иван' },
    claim_schema_version: '1',
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('https://voskhod.coop')
    .setSubject('uuid-1')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '24h')
  if (opts.jti !== undefined || overrides.jti === undefined)
    b = b.setJti(opts.jti ?? 'serial-123')
  return b.sign(new TextEncoder().encode('test-secret-padding-000000000000000000'))
}

describe('decodeParticipantCertificate', () => {
  it('декодирует все claims в типизированный объект', async () => {
    const claims = decodeParticipantCertificate(await makeCert())
    expect(claims.sub).toBe('uuid-1')
    expect(claims.jti).toBe('serial-123')
    expect(claims.coopname).toBe('voskhod')
    expect(claims.claim_schema_version).toBe('1')
    expect(claims.verification_types).toEqual([
      { type: 'coop_baseline', verified_at: '2026-01-02T03:04:05.000Z', source: 'cooperative_decision' },
    ])
    expect(decodeTrustChain(claims.trust_chain).map(l => l.subject)).toEqual(['voskhod', 'vostok'])
    expect(claims.identification).toMatchObject({ type: 'individual', username: 'ant' })
    expect(claims.exp).toBeGreaterThan(claims.iat)
  })

  it('identification может быть null', async () => {
    const claims = decodeParticipantCertificate(await makeCert({ identification: null }))
    expect(claims.identification).toBeNull()
  })

  it('retention-claims читаются (Story 4.8)', async () => {
    const claims = decodeParticipantCertificate(await makeCert({
      data_retention_contract: 'erase_on_exclusion',
      retention_deadline_ts: 1800000000,
    }))
    expect(claims.data_retention_contract).toBe('erase_on_exclusion')
    expect(claims.retention_deadline_ts).toBe(1800000000)
  })

  it('retention-claims отсутствуют → безопасные дефолты (Story 4.8)', async () => {
    const claims = decodeParticipantCertificate(await makeCert())
    expect(claims.data_retention_contract).toBe('')
    expect(claims.retention_deadline_ts).toBe(0)
  })

  it('verification_types: структурные записи сохраняются, мусор отбрасывается (Story 4.3)', async () => {
    const claims = decodeParticipantCertificate(await makeCert({
      verification_types: [
        { type: 'coop_baseline', verified_at: '2026-01-02T03:04:05.000Z', source: 'cooperative_decision' },
        'legacy_string',
        { source: 'no_type' },
      ],
    }))
    expect(claims.verification_types).toEqual([
      { type: 'coop_baseline', verified_at: '2026-01-02T03:04:05.000Z', source: 'cooperative_decision' },
    ])
  })

  it('не-JWT строка → AuthV2Error(chain_verification_failed)', () => {
    let err: unknown
    try {
      decodeParticipantCertificate('garbage')
    }
    catch (e) {
      err = e
    }
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
    expect(verificationTypeLabel('coop_baseline')).toBe('Начальный: подтверждён кооперативом')
  })

  it('базовый уровень (паспорт на кооперативном участке) имеет своё название', () => {
    expect(verificationTypeLabel('passport_onsite')).toBe('Базовый: личность сверена с паспортом на кооперативном участке')
  })
  it('неизвестный тип → возвращается как есть', () => {
    expect(verificationTypeLabel('future_kyc_x')).toBe('future_kyc_x')
  })
})

describe('deriveVerificationTypes', () => {
  it('принятый пайщик получает начальный уровень из членства', () => {
    const types = deriveVerificationTypes({
      participant_account: { status: 'accepted', created_at: '2026-01-01T00:00:00' },
    })
    expect(types).toEqual([
      { type: 'coop_baseline', verified_at: '2026-01-01T00:00:00', source: 'cooperative_decision' },
    ])
  })

  it('он-чейн запись passport даёт базовый уровень с автором проверки', () => {
    const types = deriveVerificationTypes({
      participant_account: { status: 'accepted', created_at: '2026-01-01T00:00:00' },
      user_account: {
        verifications: [
          { verificator: 'trustee1', is_verified: true, procedure: 'passport', created_at: '2026-02-02T00:00:00', notice: 'voskhod/bra1' },
        ],
      },
    })
    expect(types.map(t => t.type)).toEqual(['coop_baseline', 'passport_onsite'])
    expect(types[1].attested_by).toBe('trustee1')
    expect(types[1].source).toBe('branch_attestation')
  })

  it('отозванные и незнакомые процедуры уровня не дают', () => {
    const types = deriveVerificationTypes({
      participant_account: { status: 'blocked' },
      user_account: {
        verifications: [
          { verificator: 'trustee1', is_verified: false, procedure: 'passport', created_at: '2026-02-02T00:00:00' },
          { verificator: 'ano', is_verified: true, procedure: 'online', created_at: '2026-02-02T00:00:00' },
        ],
      },
    })
    expect(types).toEqual([])
  })
})

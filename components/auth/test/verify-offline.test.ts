import type { PrivateKey as PrivateKeyType } from '@wharfkit/antelope'
import { PrivateKey } from '@wharfkit/antelope'
import { base64url } from 'jose'
import { describe, expect, it } from 'vitest'
import { type CoopChainLink, verifyOffline } from '../src/index'

// Цепь доверия ano → voskhod → vostok(issuer). Ключи генерим, чтобы не хардкодить.
const anoKey = PrivateKey.generate('K1')
const voskhodKey = PrivateKey.generate('K1')
const issuerKey = PrivateKey.generate('K1') // vostok — издатель, его ключом подписан cert

const PUB_ANO = anoKey.toPublic().toString()
const PUB_VOSKHOD = voskhodKey.toPublic().toString()
const PUB_ISSUER = issuerKey.toPublic().toString()

const CHAIN: CoopChainLink[] = [
  { account: 'ano', public_key: PUB_ANO },
  { account: 'voskhod', public_key: PUB_VOSKHOD },
  { account: 'vostok', public_key: PUB_ISSUER },
]

// Полный доверенный кэш (chain_manifests_cache) — все звенья известны.
const TRUSTED: Record<string, string> = { ano: PUB_ANO, voskhod: PUB_VOSKHOD, vostok: PUB_ISSUER }

const NOW = 1_900_000_000_000 // фиксированный «сейчас» (мс)
const FUTURE_EXP = Math.floor(NOW / 1000) + 3600 // +1ч
const PAST_EXP = Math.floor(NOW / 1000) - 10

interface CertOpts {
  chain?: CoopChainLink[]
  exp?: number
  alg?: string
  signWith?: PrivateKeyType
}

/** Собрать compact JWS-сертификат (формат CertificateService, Story 1.8). */
function makeCert(opts: CertOpts = {}): string {
  const signer = opts.signWith ?? issuerKey
  const header = base64url.encode(JSON.stringify({ alg: opts.alg ?? 'ES256K', typ: 'JWT', kid: signer.toPublic().toString() }))
  const payload = base64url.encode(JSON.stringify({
    coopname: 'vostok',
    coop_chain: opts.chain ?? CHAIN,
    exp: opts.exp ?? FUTURE_EXP,
    sub: 'uuid-1',
    jti: 'serial-123',
  }))
  const signingInput = `${header}.${payload}`
  const sig = signer.signMessage(new TextEncoder().encode(signingInput))
  const rs = sig.data.array.slice(1) // [recovery(1), r(32), s(32)] → R||S
  return `${signingInput}.${base64url.encode(rs)}`
}

describe('verifyOffline: офлайн-проверка удостоверения (Story 4.4)', () => {
  it('валидный сертификат с доверенной цепью и якорем → valid, issuer', async () => {
    const res = await verifyOffline(makeCert(), { trustedKeys: TRUSTED, now: NOW })
    expect(res.valid).toBe(true)
    expect(res.issuer).toBe('vostok')
    expect(res.reason).toBeUndefined()
  })

  it('exp в прошлом → expired', async () => {
    const res = await verifyOffline(makeCert({ exp: PAST_EXP }), { trustedKeys: TRUSTED, now: NOW })
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('expired')
  })

  it('цепь не укоренена в известном ano (чужой якорь) → untrusted_anchor', async () => {
    const other = PrivateKey.generate('K1').toPublic().toString()
    const res = await verifyOffline(makeCert(), { trustedKeys: TRUSTED, trustAnchor: other, now: NOW })
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('untrusted_anchor')
  })

  it('звено издателя не совпадает с доверенным кэшем → untrusted_issuer', async () => {
    const foreign = PrivateKey.generate('K1').toPublic().toString()
    const res = await verifyOffline(makeCert(), {
      trustedKeys: { ano: PUB_ANO, voskhod: PUB_VOSKHOD, vostok: foreign },
      now: NOW,
    })
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('untrusted_issuer')
  })

  it('без доверенного кэша ключей → fail-closed (untrusted_issuer)', async () => {
    const res = await verifyOffline(makeCert(), { trustAnchor: PUB_ANO, now: NOW })
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('untrusted_issuer')
  })

  it('подпись чужим ключом при валидной цепи → signature_mismatch', async () => {
    // cert подписан foreignKey, но coop_chain заявляет издателя PUB_ISSUER;
    // verifyOffline сверяет подпись с ключом издателя из цепи (не с kid) → провал.
    const cert = makeCert({ signWith: PrivateKey.generate('K1') })
    const res = await verifyOffline(cert, { trustedKeys: TRUSTED, now: NOW })
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('signature_mismatch')
  })

  it('high-S подпись (не каноническая, как у jose/Node) → принимается через low-S нормализацию', async () => {
    const cert = makeCert()
    const [h, p, s] = cert.split('.')
    const rs = base64url.decode(s)
    // S → n − S (переводим каноническую low-S подпись wharfkit в high-S вариант).
    const n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n
    let sVal = 0n
    for (const b of rs.slice(32, 64))
      sVal = (sVal << 8n) | BigInt(b)
    let high = n - sVal
    const highRs = new Uint8Array(rs)
    for (let i = 63; i >= 32; i--) {
      highRs[i] = Number(high & 0xFFn)
      high >>= 8n
    }
    const highCert = `${h}.${p}.${base64url.encode(highRs)}`
    const res = await verifyOffline(highCert, { trustedKeys: TRUSTED, now: NOW })
    expect(res.valid).toBe(true)
    expect(res.issuer).toBe('vostok')
  })

  it('некорректный JWS (две части) → malformed_certificate', async () => {
    const res = await verifyOffline('a.b', { trustedKeys: TRUSTED, now: NOW })
    expect(res.reason).toBe('malformed_certificate')
  })

  it('неподдерживаемый alg → unsupported_alg', async () => {
    const res = await verifyOffline(makeCert({ alg: 'RS256' }), { trustedKeys: TRUSTED, now: NOW })
    expect(res.reason).toBe('unsupported_alg')
  })

  it('пустой coop_chain → malformed_certificate', async () => {
    const res = await verifyOffline(makeCert({ chain: [] }), { trustedKeys: TRUSTED, now: NOW })
    expect(res.reason).toBe('malformed_certificate')
  })

  it('не делает сетевых запросов (fetch недоступен) → всё равно verdict', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = (() => {
      throw new Error('сеть запрещена в офлайн-проверке')
    }) as typeof fetch
    try {
      const res = await verifyOffline(makeCert(), { trustedKeys: TRUSTED, now: NOW })
      expect(res.valid).toBe(true)
    }
    finally {
      globalThis.fetch = orig
    }
  })
})

import type { PrivateKey as PrivateKeyType } from '@wharfkit/antelope'
import { PrivateKey } from '@wharfkit/antelope'
import { base64url } from 'jose'
import { describe, expect, it } from 'vitest'
import { verifyOffline } from '../src/index'

// Цепочка признания: АНО заверяет оператора, оператор — кооператив, кооператив
// выпускает удостоверение. Ключи генерим, чтобы не хардкодить.
const anoKey = PrivateKey.generate('K1')
const operatorKey = PrivateKey.generate('K1')
const coopKey = PrivateKey.generate('K1')
const strangerKey = PrivateKey.generate('K1')

const PUB_ANO = anoKey.toPublic().toString()
const PUB_OPERATOR = operatorKey.toPublic().toString()
const PUB_COOP = coopKey.toPublic().toString()
const PUB_STRANGER = strangerKey.toPublic().toString()

const CHAIN_ID = 'db79c8409645082749ca50640d6f4ee511575acf26c4e2c8e4748e6bf6a01ed4'
const OTHER_CHAIN_ID = '0000000000000000000000000000000000000000000000000000000000000001'

const NOW = 1_900_000_000_000 // фиксированный «сейчас», мс
const NOW_SECONDS = Math.floor(NOW / 1000)

/** Подписать compact JWS ключом Antelope — тем же способом, что и на сервере. */
function sign(header: Record<string, unknown>, payload: Record<string, unknown>, key: PrivateKeyType): string {
  const h = base64url.encode(JSON.stringify(header))
  const p = base64url.encode(JSON.stringify(payload))
  const signingInput = `${h}.${p}`
  const sig = key.signMessage(new TextEncoder().encode(signingInput))
  const rs = sig.data.array.slice(1) // [recovery(1), r(32), s(32)] → R||S
  return `${signingInput}.${base64url.encode(rs)}`
}

interface EndorsementOpts {
  issuer: string
  subject: string
  /** Признаваемый ключ субъекта. */
  cert: string
  /** Ключ, которым подписывается заверение. */
  signWith: PrivateKeyType
  exp?: number
  iat?: number
  chainId?: string
  typ?: string
}

function makeEndorsement(o: EndorsementOpts): string {
  return sign(
    { alg: 'ES256K', typ: o.typ ?? 'coop-endorsement+jws', kid: o.signWith.toPublic().toString() },
    {
      iss: o.issuer,
      sub: o.subject,
      cert: o.cert,
      chain_id: o.chainId ?? CHAIN_ID,
      iat: o.iat ?? NOW_SECONDS - 60,
      exp: o.exp ?? NOW_SECONDS + 30 * 86400,
    },
    o.signWith,
  )
}

const ANO_ENDORSES_OPERATOR = makeEndorsement({ issuer: 'ano', subject: 'voskhod', cert: PUB_OPERATOR, signWith: anoKey })
const OPERATOR_ENDORSES_COOP = makeEndorsement({ issuer: 'voskhod', subject: 'spoke1', cert: PUB_COOP, signWith: operatorKey })

interface CertOpts {
  chain?: string[]
  coopname?: string
  exp?: number
  alg?: string
  signWith?: PrivateKeyType
  schemaVersion?: string
}

function makeCert(o: CertOpts = {}): string {
  const signer = o.signWith ?? coopKey
  return sign(
    { alg: o.alg ?? 'ES256K', typ: 'JWT', kid: signer.toPublic().toString() },
    {
      coopname: o.coopname ?? 'spoke1',
      trust_chain: o.chain ?? [ANO_ENDORSES_OPERATOR, OPERATOR_ENDORSES_COOP],
      exp: o.exp ?? NOW_SECONDS + 3600,
      sub: 'uuid-1',
      jti: 'serial-123',
      claim_schema_version: o.schemaVersion ?? '1',
    },
    signer,
  )
}

const BASE = { trustAnchor: PUB_ANO, now: NOW }

describe('verifyOffline: проверка удостоверения без сети', () => {
  it('цепочка от корня до кооператива сходится — пускаем', async () => {
    const res = await verifyOffline(makeCert(), BASE)
    expect(res.valid).toBe(true)
    expect(res.issuer).toBe('spoke1')
    expect(res.chain).toEqual(['ano', 'voskhod', 'spoke1'])
  })

  it('оператор выпускает удостоверения сам — цепочка из одного звена', async () => {
    const cert = makeCert({
      coopname: 'voskhod',
      chain: [ANO_ENDORSES_OPERATOR],
      signWith: operatorKey,
    })
    const res = await verifyOffline(cert, BASE)
    expect(res.valid).toBe(true)
    expect(res.chain).toEqual(['ano', 'voskhod'])
  })

  it('без вшитого корня доверять не от чего', async () => {
    const res = await verifyOffline(makeCert(), { now: NOW })
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('no_trust_anchor')
  })

  it('корень другой — вся цепочка ничего не значит', async () => {
    const res = await verifyOffline(makeCert(), { trustAnchor: PUB_STRANGER, now: NOW })
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('endorsement_invalid')
  })

  it('кооператив без заверений не подтверждён', async () => {
    const res = await verifyOffline(makeCert({ chain: [] }), BASE)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('not_endorsed')
  })

  // Та самая дыра прежней проверки: ключи звеньев читались из цепи по именам из
  // самого удостоверения, и достаточно было поставить корень первым звеном.
  it('самозванец не проходит, поставив корень первым звеном', async () => {
    const selfSigned = makeEndorsement({
      issuer: 'ano',
      subject: 'samozvanec',
      cert: PUB_STRANGER,
      signWith: strangerKey, // подписал сам себя, а не корнем
    })
    const cert = makeCert({ coopname: 'samozvanec', chain: [selfSigned], signWith: strangerKey })
    const res = await verifyOffline(cert, BASE)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('endorsement_invalid')
  })

  it('чужую настоящую цепочку к своему удостоверению не приложишь', async () => {
    const cert = makeCert({ coopname: 'samozvanec', signWith: strangerKey })
    const res = await verifyOffline(cert, BASE)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('issuer_mismatch')
  })

  it('звено, выданное не тем, кого признало предыдущее, рвёт цепочку', async () => {
    const wrongIssuer = makeEndorsement({
      issuer: 'samozvanec', // предыдущее звено признало voskhod, а не его
      subject: 'spoke1',
      cert: PUB_COOP,
      signWith: operatorKey,
    })
    const res = await verifyOffline(makeCert({ chain: [ANO_ENDORSES_OPERATOR, wrongIssuer] }), BASE)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('broken_chain')
  })

  it('заверение подписано ключом, которого корень не признавал', async () => {
    const forged = makeEndorsement({
      issuer: 'voskhod',
      subject: 'spoke1',
      cert: PUB_COOP,
      signWith: strangerKey,
    })
    const res = await verifyOffline(makeCert({ chain: [ANO_ENDORSES_OPERATOR, forged] }), BASE)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('endorsement_invalid')
  })

  it('истёкшее заверение не признаётся, даже если удостоверение свежее', async () => {
    const stale = makeEndorsement({
      issuer: 'voskhod',
      subject: 'spoke1',
      cert: PUB_COOP,
      signWith: operatorKey,
      exp: NOW_SECONDS - 1,
    })
    const res = await verifyOffline(makeCert({ chain: [ANO_ENDORSES_OPERATOR, stale] }), BASE)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('endorsement_expired')
  })

  it('заверение из другой сети не переносится', async () => {
    const foreign = makeEndorsement({
      issuer: 'voskhod',
      subject: 'spoke1',
      cert: PUB_COOP,
      signWith: operatorKey,
      chainId: OTHER_CHAIN_ID,
    })
    const res = await verifyOffline(makeCert({ chain: [ANO_ENDORSES_OPERATOR, foreign] }), { ...BASE, chainId: CHAIN_ID })
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('foreign_chain')
  })

  it('удостоверение, подсунутое вместо заверения, не принимается за звено', async () => {
    const disguised = makeEndorsement({
      issuer: 'ano',
      subject: 'voskhod',
      cert: PUB_OPERATOR,
      signWith: anoKey,
      typ: 'JWT', // тип удостоверения, а не заверения
    })
    const res = await verifyOffline(makeCert({ chain: [disguised, OPERATOR_ENDORSES_COOP] }), BASE)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('endorsement_invalid')
  })

  it('подпись удостоверения не тем ключом, который признан цепочкой', async () => {
    const res = await verifyOffline(makeCert({ signWith: strangerKey }), BASE)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('signature_mismatch')
  })

  it('истёкшее удостоверение отклоняется до разбора цепочки', async () => {
    const res = await verifyOffline(makeCert({ exp: NOW_SECONDS - 1 }), BASE)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('expired')
  })

  it('чужой способ подписи не принимается', async () => {
    const res = await verifyOffline(makeCert({ alg: 'HS256' }), BASE)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('unsupported_alg')
  })

  it('не compact JWS — не удостоверение', async () => {
    const res = await verifyOffline('не-удостоверение', BASE)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('malformed_certificate')
  })

  it('схема старее минимально поддерживаемой отклоняется', async () => {
    const res = await verifyOffline(makeCert({ schemaVersion: '0' }), { ...BASE, minSchemaVersion: '1' })
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('unsupported_schema_version')
  })
})

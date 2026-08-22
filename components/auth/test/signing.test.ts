import { Checksum256, PrivateKey, PublicKey, Signature } from '@wharfkit/antelope'
import { base64url, SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AuthV2Error, AuthV2ErrorCode } from '../src/errors'
import { canonicalTimestampMessage, signChainDigest, signDocument, signTimestamp } from '../src/signing'
import { storeUnlocked, wipeKeystore } from '../src/wallet/storage'

const KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
const ACCOUNT = 'ant'
const PUB = PrivateKey.from(KEY).toPublic().toString()

/** Поддельный, но корректно сформированный session_binding_token (signTimestamp его только декодирует). */
async function makeToken(sub = ACCOUNT, jti = 'jti-abc-123'): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setJti(jti)
    .setExpirationTime('2m')
    .sign(new TextEncoder().encode('test-secret-padding-0000000000000000'))
}

beforeEach(() => {
  storeUnlocked({ account: ACCOUNT, publicKey: PUB, privateKey: KEY })
})

afterEach(() => {
  wipeKeystore()
})

describe('signTimestamp: COOPOS-native recoverable подпись', () => {
  it('подписывает {ts,jti,sub}; recoverMessage канонического сообщения даёт тот же pubkey', async () => {
    const token = await makeToken(ACCOUNT, 'jti-abc-123')
    const res = await signTimestamp({ sessionBindingToken: token })

    expect(res.sub).toBe(ACCOUNT)
    expect(res.binding_token_jti).toBe('jti-abc-123')
    expect(res.public_key).toBe(PUB)
    expect(res.signature).toMatch(/^SIG_K1_/)

    const msg = new TextEncoder().encode(canonicalTimestampMessage({
      ts: res.ts,
      binding_token_jti: res.binding_token_jti,
      sub: res.sub,
    }))
    const recovered = Signature.from(res.signature).recoverMessage(msg).toString()
    expect(recovered).toBe(PUB)
  })

  it('подмена сообщения ломает восстановление pubkey (integrity)', async () => {
    const res = await signTimestamp({ sessionBindingToken: await makeToken() })
    const tampered = new TextEncoder().encode(canonicalTimestampMessage({
      ts: res.ts,
      binding_token_jti: res.binding_token_jti,
      sub: 'someone-else',
    }))
    const recovered = Signature.from(res.signature).recoverMessage(tampered).toString()
    expect(recovered).not.toBe(PUB)
  })

  it('запертый кошелёк → WalletLocked', async () => {
    wipeKeystore()
    const err = await signTimestamp({ sessionBindingToken: await makeToken() }).then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.WalletLocked)
  })

  it('кошелёк не совпадает с субъектом токена → ClientWalletMismatch', async () => {
    const err = await signTimestamp({ sessionBindingToken: await makeToken('petrov') }).then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.ClientWalletMismatch)
  })

  it('битый токен → SessionBindingExpired', async () => {
    const err = await signTimestamp({ sessionBindingToken: 'not-a-jwt' }).then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.SessionBindingExpired)
  })

  it('токен без sub/jti → SessionBindingExpired', async () => {
    const noClaims = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .sign(new TextEncoder().encode('test-secret-padding-0000000000000000'))
    const err = await signTimestamp({ sessionBindingToken: noClaims }).then(() => null, e => e)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.SessionBindingExpired)
  })
})

describe('signChainDigest: подпись tx-дайджеста ключом из keystore (мост подписи CoopID)', () => {
  it('подписывает дайджест; recoverDigest даёт pubkey подписанта (ключ наружу не выходит — только подпись)', async () => {
    const digestHex = 'ab'.repeat(32) // 32 байта signing-дайджеста
    const sig = await signChainDigest(digestHex)
    expect(sig).toMatch(/^SIG_K1_/)
    const recovered = Signature.from(sig).recoverDigest(Checksum256.from(digestHex)).toString()
    expect(recovered).toBe(PUB)
  })

  it('подмена дайджеста ломает восстановление pubkey (integrity)', async () => {
    const sig = await signChainDigest('ab'.repeat(32))
    const recovered = Signature.from(sig).recoverDigest(Checksum256.from('cd'.repeat(32))).toString()
    expect(recovered).not.toBe(PUB)
  })

  it('запертый кошелёк → WalletLocked (подпись транзакции невозможна без unlock)', async () => {
    wipeKeystore()
    const err = await signChainDigest('ab'.repeat(32)).then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.WalletLocked)
  })
})

describe('canonicalTimestampMessage: детерминизм', () => {
  it('фиксированный алфавитный порядок ключей', () => {
    expect(canonicalTimestampMessage({ ts: 't', binding_token_jti: 'j', sub: 's' }))
      .toBe('{"binding_token_jti":"j","sub":"s","ts":"t"}')
  })
})

/** Верифицирует compact JWS ES256K: разбирает подпись R||S и проверяет её ключом. */
function verifyJws(jws: string, pub: string): boolean {
  const [h, p, s] = jws.split('.')
  const rs = base64url.decode(s)
  const sig = Signature.from({ type: 'K1', r: rs.slice(0, 32), s: rs.slice(32, 64), recid: 0 })
  return sig.verifyMessage(new TextEncoder().encode(`${h}.${p}`), PublicKey.from(pub))
}

describe('signDocument: локальная подпись compact JWS (Story 2.3)', () => {
  it('возвращает JWS <header>.<payload>.<signature>; header alg/kid, payload round-trip, подпись валидна', async () => {
    const doc = new TextEncoder().encode('Протокол собрания №1')
    const jws = await signDocument({ payload: doc, alg: 'ES256K' })

    const parts = jws.split('.')
    expect(parts).toHaveLength(3)

    const header = JSON.parse(new TextDecoder().decode(base64url.decode(parts[0])))
    expect(header).toEqual({ alg: 'ES256K', kid: ACCOUNT })

    // payload декодируется обратно в исходные байты
    expect(base64url.decode(parts[1])).toEqual(doc)

    // подпись — ровно 64 байта (R||S, без recovery) и валидна для pubkey подписанта
    expect(base64url.decode(parts[2]).length).toBe(64)
    expect(verifyJws(jws, PUB)).toBe(true)
  })

  it('строковый payload эквивалентен его UTF-8 байтам', async () => {
    const text = 'привет, кооператив'
    const fromString = await signDocument({ payload: text })
    const fromBytes = await signDocument({ payload: new TextEncoder().encode(text) })
    // RFC6979-детерминизм K1: одинаковый вход → одинаковый JWS
    expect(fromString).toBe(fromBytes)
    expect(verifyJws(fromString, PUB)).toBe(true)
  })

  it('integrity: подделка payload в JWS ломает проверку подписи', async () => {
    const jws = await signDocument({ payload: 'исходный документ' })
    const [h, , s] = jws.split('.')
    const tampered = `${h}.${base64url.encode(new TextEncoder().encode('подменённый документ'))}.${s}`
    expect(verifyJws(tampered, PUB)).toBe(false)
  })

  it('alg по умолчанию — ES256K', async () => {
    const jws = await signDocument({ payload: 'x' })
    const header = JSON.parse(new TextDecoder().decode(base64url.decode(jws.split('.')[0])))
    expect(header.alg).toBe('ES256K')
  })

  it('неподдерживаемый alg → AuthV2Error', async () => {
    const err = await signDocument({ payload: 'x', alg: 'RS256' as 'ES256K' }).then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
  })

  it('запертый кошелёк → WalletLocked', async () => {
    wipeKeystore()
    const err = await signDocument({ payload: 'x' }).then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.WalletLocked)
  })
})

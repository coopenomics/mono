import { PrivateKey, Signature } from '@wharfkit/antelope'
import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AuthV2Error, AuthV2ErrorCode } from '../src/errors'
import { canonicalTimestampMessage, signTimestamp } from '../src/signing'
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

describe('canonicalTimestampMessage: детерминизм', () => {
  it('фиксированный алфавитный порядок ключей', () => {
    expect(canonicalTimestampMessage({ ts: 't', binding_token_jti: 'j', sub: 's' }))
      .toBe('{"binding_token_jti":"j","sub":"s","ts":"t"}')
  })
})

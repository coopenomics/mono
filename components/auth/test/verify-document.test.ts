import { PrivateKey } from '@wharfkit/antelope'
import { base64url } from 'jose'
import { afterEach, describe, expect, it } from 'vitest'
import { type KeyValidityWindow, verifyDocumentOffline } from '../src/index'
import { signDocument } from '../src/signing'
import { storeUnlocked, wipeKeystore } from '../src/wallet/storage'

const KEY1 = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
const PUB1 = PrivateKey.from(KEY1).toPublic().toString()
const ACCOUNT = 'ant'

// Второй ключ — результат ротации (Story 3.3). Генерим, чтобы не хардкодить.
const key2 = PrivateKey.generate('K1')
const KEY2 = key2.toString()
const PUB2 = key2.toPublic().toString()

// key1 активен в блоках [100,200], затем ротация на key2 [201, сейчас].
const authority: KeyValidityWindow[] = [
  { public_key: PUB1, valid_from_block: 100, valid_to_block: 200 },
  { public_key: PUB2, valid_from_block: 201, valid_to_block: null },
]

async function signWith(wif: string, payload: string): Promise<string> {
  storeUnlocked({ account: ACCOUNT, publicKey: PrivateKey.from(wif).toPublic().toString(), privateKey: wif })
  const jws = await signDocument({ payload })
  wipeKeystore()
  return jws
}

afterEach(() => wipeKeystore())

describe('verifyDocumentOffline: backward-валидность (Story 2.5)', () => {
  it('подпись старым ключом валидна, если ключ был активен на момент подписи (хотя сейчас ротирован)', async () => {
    const jws = await signWith(KEY1, 'протокол собрания №7')
    const res = await verifyDocumentOffline({ jws, signedAtBlock: 150, authority })
    expect(res.valid).toBe(true)
    expect(res.matched_key).toBe(PUB1)
  })

  it('та же подпись на блоке ПОСЛЕ ротации → невалидна (key_not_active_at_signing)', async () => {
    const jws = await signWith(KEY1, 'протокол собрания №7')
    const res = await verifyDocumentOffline({ jws, signedAtBlock: 250, authority })
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('key_not_active_at_signing')
  })

  it('подпись текущим ключом в его окне → валидна', async () => {
    const jws = await signWith(KEY2, 'протокол собрания №8')
    const res = await verifyDocumentOffline({ jws, signedAtBlock: 300, authority })
    expect(res.valid).toBe(true)
    expect(res.matched_key).toBe(PUB2)
  })

  it('подделка payload → signature_mismatch', async () => {
    const jws = await signWith(KEY1, 'оригинальный документ')
    const [h, , s] = jws.split('.')
    const tampered = `${h}.${base64url.encode(new TextEncoder().encode('подменённый документ'))}.${s}`
    const res = await verifyDocumentOffline({ jws: tampered, signedAtBlock: 150, authority })
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('signature_mismatch')
  })

  it('чужой ключ (нет в хронологии подписанта) → signature_mismatch', async () => {
    const jws = await signWith(KEY2, 'документ')
    const onlyKey1: KeyValidityWindow[] = [{ public_key: PUB1, valid_from_block: 100, valid_to_block: 200 }]
    const res = await verifyDocumentOffline({ jws, signedAtBlock: 150, authority: onlyKey1 })
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('signature_mismatch')
  })

  it('некорректный JWS → malformed_jws', async () => {
    expect((await verifyDocumentOffline({ jws: 'a.b', signedAtBlock: 1, authority })).reason).toBe('malformed_jws')
  })

  it('неподдерживаемый alg → unsupported_alg', async () => {
    const h = base64url.encode(new TextEncoder().encode(JSON.stringify({ alg: 'RS256' })))
    const p = base64url.encode(new TextEncoder().encode('x'))
    const sig = base64url.encode(new Uint8Array(64))
    const res = await verifyDocumentOffline({ jws: `${h}.${p}.${sig}`, signedAtBlock: 1, authority })
    expect(res.reason).toBe('unsupported_alg')
  })
})

import { describe, expect, it } from 'vitest'
import { AuthV2Error, AuthV2ErrorCode } from '../src/errors'
import { decryptPrivateKey, encryptPrivateKey } from '../src/vault'
import type { VaultSubject } from '../src/vault'

const KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
const PW = 'correct-horse-battery-staple-12'
const SUBJECT: VaultSubject = { subject_type: 'participant', subject_id: 'ant' }

describe('vault: Argon2id + AES-256-GCM', () => {
  it('round-trip: encrypt → decrypt тем же паролем даёт исходный ключ', async () => {
    const blob = await encryptPrivateKey(KEY, PW, SUBJECT)
    expect(blob.cipher_version).toBe('aes-256-gcm-v1')
    expect(blob.kdf_version).toBe('argon2id-v1')
    const restored = await decryptPrivateKey(blob, PW, SUBJECT)
    expect(restored).toBe(KEY)
  })

  it('каждое шифрование — новые salt и nonce', async () => {
    const a = await encryptPrivateKey(KEY, PW, SUBJECT)
    const b = await encryptPrivateKey(KEY, PW, SUBJECT)
    expect(a.salt).not.toBe(b.salt)
    expect(a.nonce).not.toBe(b.nonce)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('неверный пароль → VaultDecryptionFailed', async () => {
    const blob = await encryptPrivateKey(KEY, PW, SUBJECT)
    const err = await decryptPrivateKey(blob, 'wrong-password-000000000000', SUBJECT).then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.VaultDecryptionFailed)
  })

  it('подмена subject_id НЕ ломает расшифровку: AAD не зависит от account (решение 2026-06-15)', async () => {
    const blob = await encryptPrivateKey(KEY, PW, SUBJECT)
    // другой subject_id, тот же тип и пароль → расшифровка проходит (id не в AAD).
    const restored = await decryptPrivateKey(blob, PW, { subject_type: 'participant', subject_id: 'petrov' })
    expect(restored).toBe(KEY)
  })

  it('подмена типа субъекта (AAD) ломает расшифровку', async () => {
    const blob = await encryptPrivateKey(KEY, PW, SUBJECT)
    const err = await decryptPrivateKey(blob, PW, { subject_type: 'coop', subject_id: 'ant' }).then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.VaultDecryptionFailed)
  })
}, 30000)

/**
 * Интеграционный тест Story 1.3: SDK читает publickey permission `cert` из COOPOS.
 * Требует живую дев-ноду: COOPID_TEST_RPC=http://127.0.0.1:8908 pnpm test
 * Без env — скипается (юнит-прогоны CI не зависят от цепи).
 */
import { describe, expect, it } from 'vitest'
import { AuthV2Error, AuthV2ErrorCode } from '../src/errors'
import { readCertPublicKey } from '../src/index'

const RPC = process.env.COOPID_TEST_RPC

describe.skipIf(!RPC)('readCertPublicKey — против дев-сети COOPOS', () => {
  it.each(['vostok', 'voskhod', 'ano'])('читает ключ cert у %s', async (account) => {
    const key = await readCertPublicKey(RPC!, account)
    expect(key).toMatch(/^(PUB_K1_|EOS)/)
  })

  it('аккаунт без cert → ChainVerificationFailed', async () => {
    const err = await readCertPublicKey(RPC!, 'eosio').then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.ChainVerificationFailed)
  })

  it('несуществующий аккаунт → NetworkError', async () => {
    const err = await readCertPublicKey(RPC!, 'nonexistacct').then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.NetworkError)
  })
})

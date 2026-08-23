/**
 * Cross-runtime smoke (Story 9.13): один и тот же сценарий гоняется в Node
 * (`pnpm test:node`) и в браузере (`pnpm test:browser`, chromium headless);
 * electron-таргет (`pnpm test:electron`) выполняет те же проверки против
 * собранного dist (см. electron-main.cjs).
 *
 * Правила файла:
 * - только ПУБЛИЧНЫЙ API пакета (как у клиентов) и никаких Node-специфичных
 *   глобалов (Buffer, process, fs) — иначе браузерный таргет перестаёт быть
 *   честным; сеть стабится через globalThis.fetch;
 * - дорогой Argon2id (KDF vault'а) выполняется ОДИН раз в beforeAll: в
 *   chromium pure-JS KDF в разы медленнее Node (минуты), per-test KDF
 *   упирается в таймауты. Тесты зависят от порядка: lockWallet — последний.
 */
import type { Wallet } from '../../src'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  AuthV2Error,
  AuthV2ErrorCode,
  encryptPrivateKey,
  getAccessToken,
  isWalletUnlocked,
  lockWallet,
  login,
  signDocument,
  unlockWallet,
  verifyDocumentOffline,
} from '../../src'

const KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
const PW = 'correct-horse-battery-staple-12'
const ACCOUNT = 'ant'

describe('cross-runtime smoke: vault → wallet → подпись → верификация', () => {
  let wallet: Wallet

  beforeAll(async () => {
    // Стаб контроллера: GET /coop/vault/... отдаёт заранее зашифрованный blob.
    const blob = await encryptPrivateKey(KEY, PW, { subject_type: 'participant', subject_id: ACCOUNT })
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify(blob), { status: 200, headers: { 'content-type': 'application/json' } }))
    wallet = await unlockWallet({ apiUrl: 'https://coop.stub', account: ACCOUNT, password: PW })
    // 10 мин: два прогона Argon2id (encrypt + unlock) — в браузере это минуты
  }, 600_000)

  afterAll(() => {
    lockWallet()
    vi.unstubAllGlobals()
  })

  it('vault round-trip + unlockWallet: WebCrypto AES-GCM и Argon2id работают в этом рантайме', () => {
    expect(wallet.account).toBe(ACCOUNT)
    expect(wallet.publicKey).toMatch(/^PUB_K1_/)
    expect(isWalletUnlocked()).toBe(true)
  })

  it('signDocument → compact JWS, verifyDocumentOffline подтверждает подпись', async () => {
    const jws = await signDocument({ payload: 'кросс-рантайм smoke-документ' })
    expect(jws.split('.')).toHaveLength(3)

    const verdict = await verifyDocumentOffline({
      jws,
      signedAtBlock: 100,
      authority: [{ public_key: wallet.publicKey, valid_from_block: 1, valid_to_block: null }],
    })
    expect(verdict.valid).toBe(true)
  })

  // SDK-сторона login/getAccessToken реализована (вход 1.7 + flow-executor Story 11.2).
  // Smoke фиксирует кросс-рантайм: модуль грузится, функции вызываемы, канал
  // типизированных ошибок работает в каждом рантайме. В stub-окружении без живого
  // authentik/controller: login → AuthV2Error(network_error) (flow-executor не достучался),
  // getAccessToken → AuthV2Error(wallet_locked) (нет активной сессии). Конкретный код
  // не пиннингуем жёстко — важно, что ошибка типизированная (AuthV2Error) в любом рантайме.
  it('login()/getAccessToken(): вызываемы и дают типизированную AuthV2Error в каждом рантайме', async () => {
    for (const call of [
      () => login({ issuer: 'https://coop.stub/application/o/coopid/', email: 'a@b.c', password: 'p' }),
      () => getAccessToken(),
    ]) {
      const err = await call().then(() => null, e => e)
      expect(err).toBeInstanceOf(AuthV2Error)
      // код — валидное значение enum'а (канал типизированных ошибок целостен)
      expect(Object.values(AuthV2ErrorCode)).toContain((err as AuthV2Error).code)
    }
  })

  // Последний по порядку: запирает общий кошелёк из beforeAll
  it('запертый кошелёк: signDocument даёт типизированную WalletLocked, не runtime-краш', async () => {
    lockWallet()
    const err = await signDocument({ payload: 'x' }).then(() => null, e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
    expect((err as AuthV2Error).code).toBe(AuthV2ErrorCode.WalletLocked)
  })
})

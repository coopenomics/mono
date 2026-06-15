/**
 * Electron-таргет cross-runtime smoke (Story 9.13): те же проверки, что в
 * smoke.test.ts, но против СОБРАННОГО артефакта (dist/index.cjs — то, что
 * реально получают клиенты) в main-process electron. Запуск — через
 * run-electron.mjs (`pnpm test:electron`), не напрямую.
 *
 * Без vitest: минимальный assert + exit-код, чтобы не тащить тест-раннер в
 * electron. Сценарии держать синхронными со smoke.test.ts.
 */
const { app } = require('electron')

const KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
const PW = 'correct-horse-battery-staple-12'
const ACCOUNT = 'ant'

function assert(cond, name) {
  if (!cond)
    throw new Error(`smoke-проверка провалена: ${name}`)
  console.log(`[electron-smoke] OK ${name}`)
}

async function run() {
  const sdk = require('../../dist/index.cjs')

  // vault round-trip + unlockWallet (WebCrypto AES-GCM + Argon2id в main-process)
  const blob = await sdk.encryptPrivateKey(KEY, PW, { subject_type: 'participant', subject_id: ACCOUNT })
  globalThis.fetch = async () =>
    new Response(JSON.stringify(blob), { status: 200, headers: { 'content-type': 'application/json' } })
  const wallet = await sdk.unlockWallet({ apiUrl: 'https://coop.stub', account: ACCOUNT, password: PW })
  assert(wallet.account === ACCOUNT && wallet.publicKey.startsWith('PUB_K1_'), 'vault round-trip + unlockWallet')
  assert(sdk.isWalletUnlocked() === true, 'isWalletUnlocked после unlock')

  // signDocument → verifyDocumentOffline
  const jws = await sdk.signDocument({ payload: 'кросс-рантайм smoke-документ' })
  assert(jws.split('.').length === 3, 'signDocument: compact JWS')
  const verdict = await sdk.verifyDocumentOffline({
    jws,
    signedAtBlock: 100,
    authority: [{ public_key: wallet.publicKey, valid_from_block: 1, valid_to_block: null }],
  })
  assert(verdict.valid === true, 'verifyDocumentOffline подтверждает подпись')

  // запертый кошелёк → типизированная WalletLocked
  sdk.lockWallet()
  const lockedErr = await sdk.signDocument({ payload: 'x' }).then(() => null, e => e)
  assert(lockedErr instanceof sdk.AuthV2Error && lockedErr.code === sdk.AuthV2ErrorCode.WalletLocked, 'WalletLocked при запертом кошельке')

  // login/getAccessToken реализованы (вход 1.7 + flow-executor Story 11.2): в stub-окружении
  // без живого authentik/controller дают типизированную AuthV2Error (login→network_error,
  // getAccessToken→wallet_locked). Конкретный код не пиннингуем — важно, что ошибка
  // типизированная и код валиден для enum'а. Синхронно со smoke.test.ts.
  const errorCodes = Object.values(sdk.AuthV2ErrorCode)
  for (const [name, call] of [
    ['login', () => sdk.login({ issuer: 'https://coop.stub/application/o/coopid/', email: 'a@b.c', password: 'p' })],
    ['getAccessToken', () => sdk.getAccessToken()],
  ]) {
    const err = await call().then(() => null, e => e)
    assert(err instanceof sdk.AuthV2Error && errorCodes.includes(err.code), `${name}: типизированная AuthV2Error`)
  }
}

app.whenReady().then(run).then(
  () => {
    console.log('[electron-smoke] все проверки пройдены')
    app.exit(0)
  },
  (e) => {
    console.error('[electron-smoke] FAIL:', e)
    app.exit(1)
  },
)

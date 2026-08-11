/**
 * Pre-flight: эмиссия RUB в Main Wallet тестовых пайщиков marketplace.
 *
 * orderer/order-create через marketplaceCreateOrder требует положительный
 * баланс в кошельке program_id=1 (Кошелёк) — иначе backend тихо отказывает
 * на этапе подсчёта стоимости, диалог остаётся открытым и тест-сценарий
 * не понимает что произошло (см. task #177).
 *
 * Pre-conditions, которые скрипт ожидает выполненными:
 *   - soviet::participants[username] существует, status=accepted
 *     (`add-plain-participant.ts` + автоматический accept через провайдера
 *     или registrator уже отработали)
 *   - wallet::users(scope=voskhod)[username].programs содержит program_id=1
 *     (ЦПП Кошелёк подписан хотя бы один раз — это произошло либо через
 *     UI-onboarding 4 диалогов, либо через `soviet::sndagreement(wallet)`
 *     в seed-capital phase08)
 *
 * Если оба условия выполнены — `wallet::createdeposit + gateway::completeincome`
 * проходят без membership-исключения и зачисляют RUB на свободный остаток.
 *
 * Идемпотентность: создаётся новый deposit_hash каждый раз; повторный запуск
 * добавит ещё одну эмиссию (а не upsert'нет существующую). Это нормально для
 * dev-стенда — баланс просто увеличится.
 *
 * Запуск:
 *   MONGO_URI=mongodb://127.0.0.1:27047/cooperative-x \
 *     pnpm --filter @coopenomics/boot exec esno \
 *     src/scripts/seed-marketplace-deposits.ts
 */
import path from 'node:path'
import fs from 'node:fs'
import { createHash, randomInt } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { WalletContract, GatewayContract } from 'cooptypes'
import Blockchain from '../../blockchain'
import config from '../../configs'

const log = (...a: unknown[]) => console.error('[seed-marketplace-deposits]', ...a)

const COOPNAME = 'voskhod'

const here = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(here, '../../../..')
const STATE_DIR = path.join(REPO_ROOT, 'components/docs-harness/state/participants')

// Целевые пайщики и сумма эмиссии. Сумма с запасом, чтобы хватало на несколько
// заказов в magistral II (типичный заказ — 500–5000 RUB) + комиссии.
const TARGETS: Array<{ username: string; amountRub: number }> = [
  { username: 'ivanpetrov', amountRub: 30_000 },
  { username: 'ekaterina', amountRub: 30_000 },
  // Второй заказчик: покупает обезличенный остаток кооператива, оставшийся
  // после недовыдачи и возвратов. Без баланса заказ отбивается сервером на
  // подсчёте стоимости, и сценарий упирается в открытый диалог.
  { username: 'orderer2', amountRub: 30_000 },
]

function rndHash(): string {
  return createHash('sha256').update(`mkt-dep:${Date.now()}:${randomInt(1_000_000_000)}`).digest('hex')
}

async function readFixtureIfPresent(username: string): Promise<{ wif: string } | null> {
  const file = path.join(STATE_DIR, `${username}.json`)
  if (!fs.existsSync(file)) return null
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { wif?: string | null }
  return data.wif ? { wif: data.wif } : null
}

async function depositToWallet(blockchain: Blockchain, username: string, amountRub: number): Promise<void> {
  const depositHash = rndHash()
  const quantity = `${amountRub.toFixed(4)} RUB`
  log(`wallet::createdeposit ${username} ← ${quantity} (deposit=${depositHash.slice(0, 10)}…)`)
  await blockchain.api.transact({
    actions: [{
      account: WalletContract.contractName.production,
      name: WalletContract.Actions.CreateDeposit.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username,
        deposit_hash: depositHash,
        quantity,
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })

  log(`gateway::completeincome ${depositHash.slice(0, 10)}…`)
  await blockchain.api.transact({
    actions: [{
      account: GatewayContract.contractName.production,
      name: GatewayContract.Actions.CompleteIncome.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        income_hash: depositHash,
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

export async function fund(): Promise<void> {
  // Подгружаем WIF фикстур если есть (для случая, когда захотим расширить скрипт
  // на подписи самих пайщиков — сейчас deposit подписывается voskhod active).
  const fixtureKeys: string[] = []
  for (const t of TARGETS) {
    const fx = await readFixtureIfPresent(t.username)
    if (fx) fixtureKeys.push(fx.wif)
  }

  const blockchain = new Blockchain(config.network, [...config.private_keys, ...fixtureKeys])
  await blockchain.update_pass_instance()

  for (const t of TARGETS) {
    try {
      await depositToWallet(blockchain, t.username, t.amountRub)
      log(`✓ ${t.username}: +${t.amountRub} RUB зачислены в Main Wallet`)
    } catch (e) {
      const msg = (e as Error).message ?? String(e)
      log(`✗ ${t.username}: эмиссия упала — ${msg.slice(0, 200)}`)
      log(`   проверь: soviet::participants[${t.username}].status='accepted' + wallet::users[${t.username}].programs содержит program_id=1`)
      throw e
    }
  }

  log('эмиссия завершена')
}

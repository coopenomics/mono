/**
 * One-shot пополнение L3 Main Wallet тестовых пайщиков для прогона магистрали II
 * Marketplace (orderer/order-create → consolidated → offerer/incoming-orders).
 *
 * Запускается отдельно (не часть boot:extra), потому что L3-эмиссия в текущем
 * стенде делается ручным `wallet::createdeposit + gateway::completeincome` от
 * имени кооператива. После reboot:extra нужно повторно пополнить.
 *
 * Pattern взят из `seed-capital/phases/08-investments.ts:depositToWallet` —
 * чистая версия без vitest-зависимости.
 *
 * ВАЖНО (блокер 2026-05-22): wallet::createdeposit требует, чтобы пайщик уже
 * был **членом кооператива** (запись в soviet::participants). На текущем
 * стенде add-plain-participant.ts и ensureMarketplaceParticipant создают
 * on-chain user + mongo + pg, но НЕ делают joincoop. Поэтому createdeposit
 * падает «Пайщик не найден в кооперативе» (coops_access_helpers.hpp:57).
 * Полноценная адаптация требует soviet decision type='joincoop' + 3 votefor +
 * authorize + exec (см. validate.cpp:29, sndagreement.cpp:65, addbal.cpp:43).
 * До починки joincoop в seed — этот скрипт работает только для пайщиков,
 * прошедших полный UI-флоу адаптации.
 *
 * Usage:
 *   pnpm --filter @coopenomics/boot exec esno src/scripts/marketplace-deposit-fund.ts
 *
 * По умолчанию пополняет: ekaterina, ivanpetrov, petrova, sidorov по 10000 RUB
 * каждому (хватит на десятки Order'ов цены 120 ₽).
 */
import { createHash, randomInt } from 'node:crypto'
import { GatewayContract, WalletContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'

const COOPNAME = process.env.COOPNAME ?? config.provider
const AMOUNT_RUB = Number.parseFloat(process.env.FUND_AMOUNT_RUB ?? '10000')
const USERNAMES = (process.env.FUND_USERNAMES ?? 'ekaterina,ivanpetrov,petrova,sidorov')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const log = (...a: unknown[]) => console.error('[marketplace-deposit-fund]', ...a)

function rndHash(): string {
  return createHash('sha256').update(`mkt-fund:${Date.now()}:${randomInt(1_000_000_000)}`).digest('hex')
}

async function depositToWallet(blockchain: Blockchain, username: string, amountRub: number): Promise<void> {
  const depositHash = rndHash()
  const quantity = `${amountRub.toFixed(4)} RUB`
  log(`wallet::createdeposit ${username} ← ${quantity} (deposit=${depositHash.slice(0, 10)}...)`)
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

  log(`gateway::completeincome ${depositHash.slice(0, 10)}...`)
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

async function main(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  log(`Coopname: ${COOPNAME}, amount: ${AMOUNT_RUB} RUB, users: ${USERNAMES.join(', ')}`)

  const results: Array<{ username: string; ok: boolean; reason?: string }> = []
  for (const username of USERNAMES) {
    try {
      await depositToWallet(blockchain, username, AMOUNT_RUB)
      results.push({ username, ok: true })
      log(`✓ ${username} пополнен`)
    } catch (e: any) {
      const reason = e?.message ?? String(e)
      results.push({ username, ok: false, reason })
      log(`✗ ${username} fail: ${reason}`)
    }
  }

  console.log(JSON.stringify({ coopname: COOPNAME, amount: AMOUNT_RUB, results }, null, 2))
  if (results.some((r) => !r.ok)) process.exit(1)
}

main().catch((e) => {
  log(`fatal: ${e?.stack ?? e}`)
  process.exit(2)
})

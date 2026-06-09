/**
 * Интеграционный тест процесса «Инвестирование средств кооператива в ЦПП
 * оператора платформы» (p.wal.invest):
 *
 *   wallet::createinv → повестка совета → wallet::authinv →
 *   gateway::createoutpay → gateway::outcomplete → wallet::completeinv →
 *   ledger2 o.wal.invcpl (ISSUE w.wal.invest, Дт 58 / Кт 51).
 *
 * Особенность процесса: резервирования на этапе заявки нет — источник средств
 * находится на расчётном счёте (51), не имеющем кошелька-зеркала в ledger2.
 * Единственная учётная операция выполняется на closing-действии completeinv.
 *
 * Запуск против локального стенда (как capital.test.ts): pnpm vitest run
 * src/tests/wallet-invest.test.ts --testTimeout=240000
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { GatewayContract, SovietContract, WalletContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { getTotalRamUsage } from '../utils/getTotalRamUsage'
import { generateRandomSHA256 } from '../utils/randomHash'
import { fakeDocument } from './shared/fakeDocument'
import { fakeVote } from './shared/fakeVote'
import { processLastDecision } from './soviet/processLastDecision'
import { getLedgerAccountById } from './wallet/walletUtils'

const blockchain = new Blockchain(config.network, config.private_keys)

const COOP = 'voskhod'
const LEDGER2 = 'ledger2'
const FINANCIAL_INVESTMENTS_ACCOUNT = 58
const BANK_ACCOUNT = 51
const OPERATOR_INVESTMENTS_WALLET = 'w.wal.invest'
const INVEST_AMOUNT = '1000.0000 RUB'

beforeAll(async () => {
  await blockchain.update_pass_instance()
})

async function getInvestment(invest_hash: string) {
  return (await blockchain.getTableRows(
    WalletContract.contractName.production,
    COOP,
    WalletContract.Tables.Investments.tableName,
    1,
    invest_hash,
    invest_hash,
    2,
    'sha256',
  ))[0]
}

async function getOutcome(outcome_hash: string) {
  return (await blockchain.getTableRows(
    GatewayContract.contractName.production,
    COOP,
    'outcomes',
    1000,
  )).find((row: any) => String(row.outcome_hash).toLowerCase() === outcome_hash.toLowerCase())
}

async function getInvestWalletBalance(): Promise<number> {
  const rows = await blockchain.getTableRows(LEDGER2, COOP, 'wallets', 500)
  const wallet = rows.find((row: any) => String(row.id) === OPERATOR_INVESTMENTS_WALLET)
  return wallet ? Number.parseFloat(String(wallet.available)) : 0
}

describe('инвестирование средств кооператива в ЦПП оператора (p.wal.invest)', () => {
  it('полный цикл: заявление → решение совета → оплата кассиром → проводка Дт 58 / Кт 51', async () => {
    const invest_hash = generateRandomSHA256()
    const amount = Number.parseFloat(INVEST_AMOUNT)

    const prevInvestWallet = await getInvestWalletBalance()
    const prevFinancialInvestments = await getLedgerAccountById(blockchain, COOP, FINANCIAL_INVESTMENTS_ACCOUNT)
    const prevBankAccount = await getLedgerAccountById(blockchain, COOP, BANK_ACCOUNT)

    // 1. Председатель подаёт заявление — кооператив подписывает createinv
    const createData: WalletContract.Actions.CreateInvest.ICreateInvest = {
      coopname: COOP,
      invest_hash,
      quantity: INVEST_AMOUNT,
      statement: fakeDocument,
    }

    const createResult = await blockchain.api.transact(
      {
        actions: [
          {
            account: WalletContract.contractName.production,
            name: WalletContract.Actions.CreateInvest.actionName,
            authorization: [{ actor: COOP, permission: 'active' }],
            data: createData,
          },
        ],
      },
      { blocksBehind: 3, expireSeconds: 30 },
    )
    getTotalRamUsage(createResult)
    expect(createResult.transaction_id).toBeDefined()

    let investment = await getInvestment(invest_hash)
    expect(investment).toBeDefined()
    expect(investment.status).toBe('pending')
    expect(investment.quantity).toBe(INVEST_AMOUNT)

    // 2. Совет голосует и авторизует решение → callback authinv →
    //    статус authorized + исходящий платёж в gateway
    await processLastDecision(blockchain, COOP)

    investment = await getInvestment(invest_hash)
    expect(investment).toBeDefined()
    expect(investment.status).toBe('authorized')

    const outcome = await getOutcome(invest_hash)
    expect(outcome).toBeDefined()
    expect(outcome.status).toBe('pending')
    expect(outcome.quantity).toBe(INVEST_AMOUNT)

    // 3. Кассир подтверждает оплату по реквизитам оператора →
    //    gateway::outcomplete → callback completeinv → o.wal.invcpl
    const completeData: GatewayContract.Actions.CompleteOutcome.ICompleteOutcome = {
      coopname: COOP,
      outcome_hash: invest_hash,
    }

    const completeResult = await blockchain.api.transact(
      {
        actions: [
          {
            account: GatewayContract.contractName.production,
            name: GatewayContract.Actions.CompleteOutcome.actionName,
            authorization: [{ actor: COOP, permission: 'active' }],
            data: completeData,
          },
        ],
      },
      { blocksBehind: 3, expireSeconds: 30 },
    )
    getTotalRamUsage(completeResult)
    expect(completeResult.transaction_id).toBeDefined()

    // Запись заявки удалена
    investment = await getInvestment(invest_hash)
    expect(investment).toBeUndefined()

    // Кошелёк «Финансовые вложения в ЦПП оператора» пополнен (ISSUE)
    const investWallet = await getInvestWalletBalance()
    expect(investWallet).toBeCloseTo(prevInvestWallet + amount, 2)

    // Бухгалтерия: Дт 58 (финансовые вложения выросли) / Кт 51 (расчётный
    // счёт уменьшился)
    const financialInvestments = await getLedgerAccountById(blockchain, COOP, FINANCIAL_INVESTMENTS_ACCOUNT)
    const bankAccount = await getLedgerAccountById(blockchain, COOP, BANK_ACCOUNT)

    expect(Number.parseFloat(financialInvestments.available))
      .toBeCloseTo(Number.parseFloat(prevFinancialInvestments.available) + amount, 2)
    expect(Number.parseFloat(bankAccount.available))
      .toBeCloseTo(Number.parseFloat(prevBankAccount.available) - amount, 2)
  })

  it('отказ совета удаляет заявку без учётных операций', async () => {
    const invest_hash = generateRandomSHA256()

    const prevInvestWallet = await getInvestWalletBalance()

    const createData: WalletContract.Actions.CreateInvest.ICreateInvest = {
      coopname: COOP,
      invest_hash,
      quantity: INVEST_AMOUNT,
      statement: fakeDocument,
    }

    await blockchain.api.transact(
      {
        actions: [
          {
            account: WalletContract.contractName.production,
            name: WalletContract.Actions.CreateInvest.actionName,
            authorization: [{ actor: COOP, permission: 'active' }],
            data: createData,
          },
        ],
      },
      { blocksBehind: 3, expireSeconds: 30 },
    )

    expect((await getInvestment(invest_hash))?.status).toBe('pending')

    // Совет голосует «против» большинством (3 из 5) и отклоняет вопрос →
    // callback declineinv → запись удалена без учётных операций
    const decisions = await blockchain.getTableRows(
      SovietContract.contractName.production,
      COOP,
      SovietContract.Tables.Decisions.tableName,
      1000,
    )
    const lastDecision = decisions[decisions.length - 1]

    const voters = ['ant', 'petr', 'anna']
    const voteActions = voters.map((voter) => {
      const voteData: SovietContract.Actions.Decisions.VoteAgainst.IVoteAgainstDecision = {
        ...fakeVote,
        username: voter,
        decision_id: lastDecision.id,
      }
      return {
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Decisions.VoteAgainst.actionName,
        authorization: [{ actor: voter, permission: 'active' }],
        data: voteData,
      }
    })

    await blockchain.api.transact(
      {
        actions: [
          ...voteActions,
          {
            account: SovietContract.contractName.production,
            name: 'declinedec',
            authorization: [{ actor: COOP, permission: 'active' }],
            data: { coopname: COOP, decision_id: lastDecision.id },
          },
        ],
      },
      { blocksBehind: 3, expireSeconds: 30 },
    )

    expect(await getInvestment(invest_hash)).toBeUndefined()
    expect(await getInvestWalletBalance()).toBeCloseTo(prevInvestWallet, 2)
  })
})

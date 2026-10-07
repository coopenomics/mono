import { beforeAll, describe, expect, it } from 'vitest'
import { DebtContract, GatewayContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { generateRandomSHA256 } from '../utils/randomHash'
import { sleep } from '../utils'
import { bootstrapMember, COOP, getUserWallet, programInvest, signedBy } from './capital/programInvest'
import { processLastDecision } from './soviet/processLastDecision'
import { processApprove } from './capital/processApprove'
import { ensureCapitalConfigured } from './shared/ensureCapitalConfigured'

/**
 * Беспроцентный заём под обеспечение паевым взносом «Благорост» (contract, живая цепь).
 *
 * Путь из стандарта p.dbt.loan: заявление и договор пайщика → совет →
 * подпись председателя → кассир; возврат с главного кошелька частями и
 * целиком; отказ, отмена и просрочка. Реестр случаев —
 * test-registry/debt.loan.yaml.
 */
const blockchain = new Blockchain(config.network, config.private_keys)
const DEBT = DebtContract.contractName.production

const rub = (n: number) => `${n.toFixed(4)} RUB`
const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString().slice(0, 19)

async function getDebt(debtHash: string) {
  const rows = await blockchain.getTableRows(DEBT, COOP, 'debts', 1000) as any[]
  return rows.find(r => r.debt_hash === debtHash)
}

async function getSummary(username: string) {
  const rows = await blockchain.getTableRows(DEBT, COOP, 'summaries', 1000) as any[]
  return rows.find(r => r.username === username)
}

async function tx(account: string, name: string, data: any, actor = COOP) {
  return blockchain.api.transact({
    actions: [{ account, name, authorization: [{ actor, permission: 'active' }], data }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function createLoan(username: string, amount: string, dueInSeconds: number, collateral = 'blago') {
  const debtHash = generateRandomSHA256()
  const data: DebtContract.Actions.CreateLoan.ICreateLoan = {
    coopname: COOP,
    username,
    collateral,
    debt_hash: debtHash,
    amount,
    due_at: inSeconds(dueInSeconds),
    statement: signedBy(username),
    contract: signedBy(username),
  }
  await tx(DEBT, DebtContract.Actions.CreateLoan.actionName, data)
  return debtHash
}

/** Полный путь выдачи: совет → подпись председателя → кассир. */
async function issueLoan(username: string, amount: string, dueInSeconds: number) {
  const debtHash = await createLoan(username, amount, dueInSeconds)
  expect((await getDebt(debtHash)).status).toBe(DebtContract.Status.CREATED)

  await processLastDecision(blockchain, COOP)
  expect((await getDebt(debtHash)).status).toBe(DebtContract.Status.AUTHORIZED)

  await processApprove(blockchain, COOP, debtHash)
  expect((await getDebt(debtHash)).status).toBe(DebtContract.Status.PAYING)

  const payout: GatewayContract.Actions.CompleteOutcome.ICompleteOutcome = { coopname: COOP, outcome_hash: debtHash }
  await tx(GatewayContract.contractName.production, GatewayContract.Actions.CompleteOutcome.actionName, payout)
  expect((await getDebt(debtHash)).status).toBe(DebtContract.Status.ISSUED)
  return debtHash
}

describe('Беспроцентный заём под паевой взнос «Благорост» (contract, живая цепь)', () => {
  // Решение совета и подпись председателя тесты ставят за «ant» стендовым ключом.
  // После входа владельца в кабинет стенда ключ «ant» другой, и такие шаги
  // подписать нельзя — случаи с советом пропускаются с пометкой, а не падают.
  let chairmanSignable = false

  beforeAll(async () => {
    await blockchain.update_pass_instance()
    await ensureCapitalConfigured(blockchain, COOP)
    const ant = await blockchain.api.rpc.get_account('ant')
    const active = ant.permissions.find((p: any) => p.perm_name === 'active')
    // eslint-disable-next-line node/prefer-global/process
    chairmanSignable = active?.required_auth?.keys?.some((k: any) => k.key === process.env.EOSIO_PUB_KEY) ?? false
    if (!chairmanSignable)
      console.warn('Ключ active у ant не стендовый — шаги совета и председателя пропущены; нужна чистая цепь стенда')
  }, 60_000)

  it('dbt.loan.happy.01: заявление блокирует обеспечение, выдача проходит совет, председателя и кассира, возврат частями закрывает заём', async (ctx) => {
    if (!chairmanSignable) return ctx.skip()
    const username = await bootstrapMember(blockchain, { deposit: 1_000_000 })
    await programInvest(blockchain, username, 500_000) // 50 RUB в «Благоросте»

    const shareBefore = (await getUserWallet(blockchain, username, 'w.wal.share')).available
    const debtHash = await createLoan(username, rub(30), 3600)

    const created = await getDebt(debtHash)
    expect(created.status).toBe(DebtContract.Status.CREATED)
    expect(created.pledged).toBe(rub(30))
    expect(created.remaining).toBe(rub(30))
    expect(created.source).toBe('debt')
    expect((await getUserWallet(blockchain, username, 'w.cap.blago')).available).toBe(20)
    expect((await getUserWallet(blockchain, username, 'w.cap.pledge')).available).toBe(30)

    await processLastDecision(blockchain, COOP)
    expect((await getDebt(debtHash)).status).toBe(DebtContract.Status.AUTHORIZED)

    await processApprove(blockchain, COOP, debtHash)
    const paying = await getDebt(debtHash)
    expect(paying.status).toBe(DebtContract.Status.PAYING)
    expect((await getUserWallet(blockchain, username, 'w.dbt.pend')).available).toBe(30)

    const payout: GatewayContract.Actions.CompleteOutcome.ICompleteOutcome = { coopname: COOP, outcome_hash: debtHash }
    await tx(GatewayContract.contractName.production, GatewayContract.Actions.CompleteOutcome.actionName, payout)
    const issued = await getDebt(debtHash)
    expect(issued.status).toBe(DebtContract.Status.ISSUED)
    expect((await getUserWallet(blockchain, username, 'w.dbt.pend')).available).toBe(0)
    expect((await getUserWallet(blockchain, username, 'w.dbt.issued')).available).toBe(30)
    expect((await getSummary(username)).total).toBe(rub(30))

    // Возврат частью: остаток и обеспечение уменьшаются, главный кошелёк списан.
    const repay1: DebtContract.Actions.RepayLoan.IRepayLoan = {
      coopname: COOP, username, debt_hash: debtHash, amount: rub(10), statement: signedBy(username),
    }
    await tx(DEBT, DebtContract.Actions.RepayLoan.actionName, repay1)
    const partly = await getDebt(debtHash)
    expect(partly.remaining).toBe(rub(20))
    expect(partly.pledged).toBe(rub(20))
    expect((await getUserWallet(blockchain, username, 'w.cap.blago')).available).toBe(30)
    expect((await getUserWallet(blockchain, username, 'w.dbt.issued')).available).toBe(20)
    expect((await getUserWallet(blockchain, username, 'w.wal.share')).available).toBe(shareBefore - 10)
    expect((await getSummary(username)).total).toBe(rub(20))

    // Возврат остатка: запись и сводка удалены, обеспечение целиком в программе.
    await tx(DEBT, DebtContract.Actions.RepayLoan.actionName, { ...repay1, amount: rub(20), statement: signedBy(username) })
    expect(await getDebt(debtHash)).toBeUndefined()
    expect(await getSummary(username)).toBeUndefined()
    expect((await getUserWallet(blockchain, username, 'w.cap.blago')).available).toBe(50)
    expect((await getUserWallet(blockchain, username, 'w.cap.pledge')).available).toBe(0)
    expect((await getUserWallet(blockchain, username, 'w.dbt.issued')).available).toBe(0)
  })

  it('dbt.loan.side.01: заём больше остатка в программе отклоняется, обеспечение не трогается', async () => {
    const username = await bootstrapMember(blockchain, { deposit: 1_000_000, approveContract: false })
    await programInvest(blockchain, username, 100_000) // 10 RUB
    await expect(createLoan(username, rub(15), 3600)).rejects.toThrow(/Недостаточно средств/)
    expect((await getUserWallet(blockchain, username, 'w.cap.blago')).available).toBe(10)
  })

  it('dbt.loan.side.02: неизвестное обеспечение отклоняется', async () => {
    const username = await bootstrapMember(blockchain, { deposit: 1_000_000, approveContract: false })
    await programInvest(blockchain, username, 100_000)
    await expect(createLoan(username, rub(5), 3600, 'nothing')).rejects.toThrow(/не предусмотрено/)
  })

  it('dbt.loan.side.03: без договора об участии заём под паевой взнос не выдаётся', async () => {
    // Договор об участии не заключён: средств в программе нет, обеспечения нет.
    const username = await bootstrapMember(blockchain, { deposit: 1_000_000, contract: false })
    await expect(createLoan(username, rub(5), 3600)).rejects.toThrow(/Недостаточно средств|не состоит/)
  })

  it('dbt.loan.side.08: договор об участии подписан пайщиком, но ещё не одобрен председателем — заём под паевой взнос доступен', async () => {
    const username = await bootstrapMember(blockchain, { deposit: 1_000_000, approveContract: false })
    await programInvest(blockchain, username, 100_000)
    const debtHash = await createLoan(username, rub(4), 3600)
    expect((await getDebt(debtHash)).status).toBe(DebtContract.Status.CREATED)
    await tx(DEBT, DebtContract.Actions.CancelLoan.actionName, { coopname: COOP, debt_hash: debtHash, reason: 'проверка' })
  })

  it('dbt.loan.side.04: отмена до выплаты возвращает обеспечение и удаляет запись', async () => {
    const username = await bootstrapMember(blockchain, { deposit: 1_000_000, approveContract: false })
    await programInvest(blockchain, username, 200_000) // 20 RUB
    const debtHash = await createLoan(username, rub(12), 3600)
    expect((await getUserWallet(blockchain, username, 'w.cap.pledge')).available).toBe(12)

    const cancel: DebtContract.Actions.CancelLoan.ICancelLoan = { coopname: COOP, debt_hash: debtHash, reason: 'передумал' }
    await tx(DEBT, DebtContract.Actions.CancelLoan.actionName, cancel)
    expect(await getDebt(debtHash)).toBeUndefined()
    expect((await getUserWallet(blockchain, username, 'w.cap.blago')).available).toBe(20)
    expect((await getUserWallet(blockchain, username, 'w.cap.pledge')).available).toBe(0)
  })

  it('dbt.loan.side.05: отказ кассира по реквизитам не теряет решение — повтор платежа выдаёт заём', async (ctx) => {
    if (!chairmanSignable) return ctx.skip()
    const username = await bootstrapMember(blockchain, { deposit: 1_000_000 })
    await programInvest(blockchain, username, 200_000)
    const debtHash = await createLoan(username, rub(8), 3600)
    await processLastDecision(blockchain, COOP)
    await processApprove(blockchain, COOP, debtHash)
    expect((await getDebt(debtHash)).status).toBe(DebtContract.Status.PAYING)

    const decline: GatewayContract.Actions.DeclineOutcome.IDeclineOutcome = { coopname: COOP, outcome_hash: debtHash, reason: 'реквизиты не прошли' }
    await tx(GatewayContract.contractName.production, GatewayContract.Actions.DeclineOutcome.actionName, decline)
    const signed = await getDebt(debtHash)
    expect(signed.status).toBe(DebtContract.Status.SIGNED)
    expect(signed.last_pay_error).toContain('реквизиты')
    // Начисление к выдаче остаётся: решение в силе.
    expect((await getUserWallet(blockchain, username, 'w.dbt.pend')).available).toBe(8)

    await tx(DEBT, DebtContract.Actions.RetryPay.actionName, { coopname: COOP, debt_hash: debtHash })
    expect((await getDebt(debtHash)).status).toBe(DebtContract.Status.PAYING)
    const payout: GatewayContract.Actions.CompleteOutcome.ICompleteOutcome = { coopname: COOP, outcome_hash: debtHash }
    await tx(GatewayContract.contractName.production, GatewayContract.Actions.CompleteOutcome.actionName, payout)
    const issued = await getDebt(debtHash)
    expect(issued.status).toBe(DebtContract.Status.ISSUED)
    expect(issued.last_pay_error).toBe('')
  })

  it('dbt.loan.side.06: возврат больше остатка и возврат чужого займа отклоняются', async (ctx) => {
    if (!chairmanSignable) return ctx.skip()
    const username = await bootstrapMember(blockchain, { deposit: 1_000_000 })
    await programInvest(blockchain, username, 200_000)
    const debtHash = await issueLoan(username, rub(6), 3600)
    const other = await bootstrapMember(blockchain, { deposit: 1_000_000 })

    await expect(tx(DEBT, DebtContract.Actions.RepayLoan.actionName, {
      coopname: COOP, username, debt_hash: debtHash, amount: rub(7), statement: signedBy(username),
    })).rejects.toThrow(/больше остатка/)
    await expect(tx(DEBT, DebtContract.Actions.RepayLoan.actionName, {
      coopname: COOP, username: other, debt_hash: debtHash, amount: rub(1), statement: signedBy(other),
    })).rejects.toThrow(/другому пайщику/)
  })

  it('dbt.loan.side.07: сверка сроков переводит выданный заём с прошедшим сроком в просрочку, продление возвращает его в выданные', async (ctx) => {
    if (!chairmanSignable) return ctx.skip()
    const username = await bootstrapMember(blockchain, { deposit: 1_000_000 })
    await programInvest(blockchain, username, 200_000)
    const debtHash = await issueLoan(username, rub(5), 25)

    const issued = await getDebt(debtHash)
    const dueMs = new Date(`${issued.due_at}Z`).getTime()
    const wait = dueMs - Date.now() + 2000
    if (wait > 0) await sleep(wait)

    await tx(DEBT, DebtContract.Actions.Sweep.actionName, { coopname: COOP, limit: 25 })
    expect((await getDebt(debtHash)).status).toBe(DebtContract.Status.OVERDUE)

    // Обеспечение не обращается раньше пяти дней просрочки.
    await tx(DEBT, DebtContract.Actions.Sweep.actionName, { coopname: COOP, limit: 25 })
    expect((await getDebt(debtHash)).status).toBe(DebtContract.Status.OVERDUE)
    expect((await getUserWallet(blockchain, username, 'w.cap.pledge')).available).toBe(5)

    const extend: DebtContract.Actions.ExtendLoan.IExtendLoan = {
      coopname: COOP, username, debt_hash: debtHash, new_due_at: inSeconds(3600), statement: signedBy(username),
    }
    await tx(DEBT, DebtContract.Actions.ExtendLoan.actionName, extend)
    expect((await getDebt(debtHash)).requested_due_at).not.toBe('1970-01-01T00:00:00')
    await processApprove(blockchain, COOP, debtHash)
    const extended = await getDebt(debtHash)
    expect(extended.status).toBe(DebtContract.Status.ISSUED)
    expect(extended.requested_due_at).toBe('1970-01-01T00:00:00')
    expect(new Date(`${extended.due_at}Z`).getTime()).toBeGreaterThan(dueMs)
  })
})

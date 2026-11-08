/**
 * Общие помощники тестов цепи итога месяца участка (коэффициент экономического
 * участия): суммы в единицах актива, отправка действий от имени кооператива,
 * чтение строк итога и остатков кошельков.
 */
import { expect } from 'vitest'
import { MarketContract } from 'cooptypes'
import type Blockchain from '../../blockchain'
import { COOP } from './chainHelpers'

/** Единиц актива в рубле: четыре знака. */
export const UNITS = 10_000n

/** Рубли в единицы актива. */
export const rub = (value: number): bigint => BigInt(Math.round(value * 10_000))

/** Сумма из цепи («12.3400 RUB» либо число строкой) в единицы актива. */
export function units(asset: unknown): bigint {
  const [whole, frac = ''] = String(asset ?? '0').split(' ')[0].split('.')
  const negative = whole.startsWith('-')
  const abs = BigInt(whole.replace('-', '')) * UNITS + BigInt((`${frac}0000`).slice(0, 4))
  return negative ? -abs : abs
}

/** Единицы актива в сумму для действия цепи. */
export function asset(u: bigint, symbol = 'RUB'): string {
  const sign = u < 0n ? '-' : ''
  const a = u < 0n ? -u : u
  return `${sign}${a / UNITS}.${String(a % UNITS).padStart(4, '0')} ${symbol}`
}

/**
 * Отправка действия от имени кооператива. Срок жизни у каждой транзакции свой:
 * одинаковое действие в том же блоке nodeos иначе отбросит как повтор, не дав
 * контракту ответить кодом отказа.
 */
export function coopPusher(bc: Blockchain) {
  let seq = 0
  return (account: string, name: string, data: Record<string, unknown>) =>
    bc.api.transact(
      { actions: [{ account, name, authorization: [{ actor: COOP, permission: 'active' }], data }] },
      { blocksBehind: 3, expireSeconds: 30 + (seq++ % 600) },
    )
}

/** Доступный остаток кошелька пайщика (либо участка) в единицах актива. */
export async function userWallet(bc: Blockchain, wallet: string, username: string): Promise<bigint> {
  const rows: any[] = await bc.getTableRows('ledger2', COOP, 'userwallets', 5000)
  const row = rows.find(r => r.wallet_name === wallet && r.username === username)
  return units(row?.available)
}

/** Остатки кошельков фондов (кошелёк = субсчёт фонда): кошелёк → сумма. */
export async function fundBalances(bc: Blockchain): Promise<Map<string, bigint>> {
  const rows: any[] = await bc.getTableRows('ledger2', COOP, 'wallets', 500)
  return new Map(rows.filter(r => String(r.id).startsWith('w.fnd.')).map(r => [String(r.id), units(r.available)]))
}

/** Фонды накопления кооператива из реестра фондов, по порядку номеров. */
export async function accumulationFunds(bc: Blockchain): Promise<any[]> {
  const rows: any[] = await bc.getTableRows('fund', COOP, 'funds', 50)
  return rows.filter(f => f.kind === 'accum').sort((a, b) => Number(a.id) - Number(b.id))
}

/** Строки итога месяца участка в цепи. */
export async function branchPeriods(bc: Blockchain, braname: string): Promise<any[]> {
  const rows: any[] = await bc.getTableRows('marketplace', COOP, 'kuperiods', 1000)
  return rows.filter(r => r.braname === braname)
}

/** Ставки строки итога для эталона расчёта списания. */
export function ratesOf(row: any): { rateBranch: bigint, rateFunds: bigint, rateInitiator: bigint } {
  return { rateBranch: BigInt(row.rate_branch), rateFunds: BigInt(row.rate_funds), rateInitiator: BigInt(row.rate_initiator) }
}

/** Строки резерва социально-экономического обеспечения участка. */
export async function branchReserves(bc: Blockchain, braname: string): Promise<any[]> {
  const rows: any[] = await bc.getTableRows('branch', COOP, 'reserves', 1000)
  return rows.filter(r => r.braname === braname)
}

/** Сумма резерва участка — слагаемое расходов месяца. */
export async function branchReserveSum(bc: Blockchain, braname: string): Promise<bigint> {
  return (await branchReserves(bc, braname)).reduce((sum, r) => sum + units(r.amount), 0n)
}

/** Резерв из строки участка с наибольшим периодом меньше заданного — как его берёт контракт. */
export async function reservePrevOf(bc: Blockchain, braname: string, period: number): Promise<bigint> {
  const earlier = (await branchPeriods(bc, braname)).filter(r => Number(r.period) < period)
  if (!earlier.length)
    return 0n
  const prev = earlier.reduce((a, b) => (Number(a.period) > Number(b.period) ? a : b))
  return units(prev.aid_reserve)
}

/** Пять фактов месяца, которые передаёт контракту ИСТОК. */
export interface MonthInput {
  turnover: bigint
  secured: bigint
  planned?: bigint
  memos?: bigint
  aidPaid?: bigint
}

/** Что нужно для расчёта месяца: цепь, отправка от кооператива, участок и проценты кооператива. */
export interface PeriodContext {
  bc: Blockchain
  push: ReturnType<typeof coopPusher>
  braname: string
  fundsPercent: bigint
  initiatorPercent: bigint
}

/**
 * Один месяц: расчёт контрактом, чтение строки, сверка каждого поля с эталоном
 * `MarketContract.PeriodModel`. Резерв участка и резерв прошлого месяца
 * читаются из цепи до расчёта — эталон получает те же числа, что видит контракт.
 */
export async function closeMonthAndCompare(ctx: PeriodContext, label: string, input: MonthInput, period: number) {
  const facts = {
    turnover: input.turnover,
    secured: input.secured,
    planned: input.planned ?? 0n,
    memos: input.memos ?? 0n,
    aidPaid: input.aidPaid ?? 0n,
    reserve: await branchReserveSum(ctx.bc, ctx.braname),
    reservePrev: await reservePrevOf(ctx.bc, ctx.braname, period),
    fundsPercent: ctx.fundsPercent,
    initiatorPercent: ctx.initiatorPercent,
  }
  await ctx.push('marketplace', 'closeperiod', {
    coopname: COOP,
    braname: ctx.braname,
    period,
    turnover: asset(facts.turnover),
    secured: asset(facts.secured),
    planned: asset(facts.planned),
    memos: asset(facts.memos),
    aid_paid: asset(facts.aidPaid),
  })

  const row = (await branchPeriods(ctx.bc, ctx.braname)).find(r => Number(r.period) === period)
  expect(row, `${label}: строка итога записана`).toBeDefined()
  const expected = MarketContract.PeriodModel.closePeriod(facts)

  const got = {
    turnover: units(row.turnover),
    secured: units(row.secured),
    planned: units(row.planned),
    memos: units(row.memos),
    aidPaid: units(row.aid_paid),
    reserve: units(row.aid_reserve),
    unpaid: units(row.aid_unpaid),
    expenses: units(row.expenses),
    branch: units(row.branch_amount),
    deficit: units(row.deficit),
    funds: units(row.funds_amount),
    membership: units(row.membership),
    initiator: units(row.initiator_amount),
    returned: units(row.return_amount),
    rateBranch: BigInt(row.rate_branch),
    rateFunds: BigInt(row.rate_funds),
    rateInitiator: BigInt(row.rate_initiator),
  }
  expect(got, label).toEqual({
    turnover: facts.turnover,
    secured: facts.secured,
    planned: facts.planned,
    memos: facts.memos,
    aidPaid: facts.aidPaid,
    reserve: facts.reserve,
    unpaid: expected.unpaid,
    expenses: expected.expenses,
    branch: expected.branch,
    deficit: expected.deficit,
    funds: expected.funds,
    membership: expected.membership,
    initiator: expected.initiator,
    returned: expected.returned,
    rateBranch: expected.rateBranch,
    rateFunds: expected.rateFunds,
    rateInitiator: expected.rateInitiator,
  })
  // Собранное делится без остатка — по строке цепи, не по эталону.
  expect(got.branch + got.funds + got.initiator + got.returned, `${label}: собранное разделено целиком`).toBe(facts.secured)
  expect(row.initiator, `${label}: получатель доли инициатора записан`).toBeTruthy()
  return { period, facts, totals: expected, row }
}

// ── Инвестиционный этап участка (задача 99D-27) ─────────────────────────────

/** Строка паевых взносов участка из цепи в виде, который понимает эталон CRPS. */
export async function investBranch(bc: Blockchain, braname: string) {
  const rows: any[] = await bc.getTableRows('marketplace', COOP, 'invbranches', 1, braname, braname)
  const r = rows.find(x => x.braname === braname)
  return {
    raw: r,
    base: BigInt(r?.base ?? 0),
    acc: BigInt(r?.acc ?? 0),
    sJoin: BigInt(r?.s_join ?? 0),
    sFixed: BigInt(r?.s_fixed ?? 0),
    unusedTotal: units(r?.unused_total),
    reserved: units(r?.reserved),
  }
}

/** Строка инициатора по участку из цепи в виде, который понимает эталон CRPS. */
export async function investorRow(bc: Blockchain, braname: string, username: string) {
  const rows: any[] = await bc.getTableRows('marketplace', COOP, 'investors', 1000)
  const r = rows.find(x => x.braname === braname && x.username === username)
  return r
    ? {
        raw: r,
        active: r.status === 'active',
        money: units(r.money),
        property: units(r.property),
        usedMoney: units(r.used_money),
        claimed: units(r.claimed),
        returnedFixed: BigInt(r.returned_fixed),
        accJoin: BigInt(r.acc_join),
      }
    : null
}

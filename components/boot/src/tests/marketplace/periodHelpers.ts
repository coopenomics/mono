/**
 * Общие помощники тестов цепи итога месяца участка (коэффициент экономического
 * участия): суммы в единицах актива, отправка действий от имени кооператива,
 * чтение строк итога и остатков кошельков.
 */
import { createHash } from 'node:crypto'
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

// ── Счётчики списания и периоды (задача 99D-33) ─────────────────────────────

/** Длина периода списания из настроек участков, секунд; ноль — календарный месяц UTC. */
export async function periodSeconds(bc: Blockchain): Promise<number> {
  const rows: any[] = await bc.getTableRows('branch', COOP, 'brnconfig', 1)
  return Number(rows[0]?.aid_period_seconds ?? 0)
}

/** Номер периода для момента — так же, как контракт (`Branch::aid_period`). */
export function periodOfDate(seconds: number, at: Date): number {
  if (seconds > 0)
    return Math.floor(at.getTime() / 1000 / seconds)
  return at.getUTCFullYear() * 12 + at.getUTCMonth() + 1
}

/** Период, идущий в цепи сейчас: его строки ещё копятся и не списываются. */
export async function currentPeriod(bc: Blockchain): Promise<number> {
  return periodOfDate(await periodSeconds(bc), new Date())
}

/**
 * Дождаться окончания периода `period`: контракт считает итог и списывает
 * только после смены периода. На стенде период короткий (600 с); на
 * календарном месяце ожидание не имеет смысла — тест падает сразу.
 */
export async function waitPeriodEnd(bc: Blockchain, period: number, timeoutMs = 20 * 60_000): Promise<void> {
  const seconds = await periodSeconds(bc)
  if (seconds === 0)
    throw new Error('период списания — календарный месяц: дождаться его окончания в тесте нельзя, задайте brnconfig.aid_period_seconds на стенде')
  const deadline = Date.now() + timeoutMs
  while (periodOfDate(seconds, new Date()) <= period) {
    if (Date.now() > deadline)
      throw new Error(`период ${period} не закончился за ${timeoutMs / 1000} с`)
    // timing: schedule — ждём смены периода стенда, факта в цепи нет: период — функция времени
    await new Promise(r => setTimeout(r, 5_000))
  }
}

/** Строка счётчика пайщика за период (`kudues`); нет — списана либо не заводилась. */
export async function memberDue(bc: Blockchain, username: string, braname: string, period: number): Promise<any | undefined> {
  // Второй индекс таблицы — пайщик (byuser); имя в границах читается как i64.
  const rows: any[] = await bc.getTableRows('marketplace', COOP, 'kudues', 1000, username, username, 2)
  return rows.find(r => r.username === username && r.braname === braname && Number(r.period) === period)
}

/** Строки пайщика на участке по периодам: период → обеспечительная часть к списанию. */
export async function memberDues(bc: Blockchain, username: string, braname: string): Promise<Map<number, bigint>> {
  const rows: any[] = await bc.getTableRows('marketplace', COOP, 'kudues', 1000, username, username, 2)
  return new Map(rows.filter(r => r.username === username && r.braname === braname).map(r => [Number(r.period), units(r.due)]))
}

/**
 * Период строки, которую пополнила выдача: тот, где обеспечительная часть пайщика
 * выросла ровно на факт выдачи. Снимки — до и после выдачи.
 */
export function grownPeriod(before: Map<number, bigint>, after: Map<number, bigint>, delta: bigint): number {
  const grown = [...after.entries()].find(([p, due]) => due - (before.get(p) ?? 0n) === delta)
  expect(grown, 'выдача пополнила строку счётчика пайщика за период конца гарантии').toBeDefined()
  return grown![0]
}

/** Строка счётчика участка за период (`kucounters`); нет — итог рассчитан либо заказов не было. */
export async function branchCounter(bc: Blockchain, braname: string, period: number): Promise<any | undefined> {
  const rows: any[] = await bc.getTableRows('marketplace', COOP, 'kucounters', 1000)
  return rows.find(r => r.braname === braname && Number(r.period) === period)
}

/** Хэш нитки списания строки пайщика — как в контракте (`Marketplace::Dues::charge_hash`). */
export function chargeHash(username: string, braname: string, period: number): string {
  return createHash('sha256').update(MarketContract.PeriodModel.chargeProcessSeed(COOP, username, braname, period)).digest('hex')
}

/** Факты о расходах периода, которые передаёт контракту узел; стоимость и собранное контракт берёт из счётчика. */
export interface MonthInput {
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
 * Один период: расчёт контрактом по его счётчику участка, чтение строки,
 * сверка каждого поля с эталоном `MarketContract.PeriodModel`. Стоимость и
 * собранное читаются из счётчика до расчёта, резерв участка и резерв прошлого
 * периода — из цепи: эталон получает те же числа, что видит контракт.
 */
export async function closeMonthAndCompare(ctx: PeriodContext, label: string, input: MonthInput, period: number) {
  // Итог за период уже рассчитан (соседний тест того же стенда): ставки зафиксированы, строка читается как есть.
  const already = (await branchPeriods(ctx.bc, ctx.braname)).find(r => Number(r.period) === period)
  if (already)
    return { period, facts: null, totals: null, row: already }
  const counter = await branchCounter(ctx.bc, ctx.braname, period)
  expect(counter, `${label}: счётчик участка за период есть`).toBeDefined()
  const facts = {
    turnover: units(counter.turnover),
    secured: units(counter.secured),
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
    planned: asset(facts.planned),
    memos: asset(facts.memos),
    aid_paid: asset(facts.aidPaid),
  })
  expect(await branchCounter(ctx.bc, ctx.braname, period), `${label}: счётчик участка стёрт расчётом`).toBeUndefined()

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
        // Поле добавлено бинарным расширением: у строки прежней сборки его нет.
        moneyIn: r.money_in ? units(r.money_in) : null,
        property: units(r.property),
        usedMoney: units(r.used_money),
        claimed: units(r.claimed),
        returnedFixed: BigInt(r.returned_fixed),
        accJoin: BigInt(r.acc_join),
      }
    : null
}

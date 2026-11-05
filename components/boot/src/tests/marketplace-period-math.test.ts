/**
 * Контрактный уровень: арифметика итога месяца участка на живой цепи против
 * эталона расчёта (задача 99D-21, КЭУ-3; реестр marketplace.order, случаи
 * mkt.order.keu.math.*).
 *
 * `closeperiod` принимает пять чисел и сам заказы не ищет, поэтому расчёт
 * проверяется без единого заказа: тест подаёт контракту месяцы с разным
 * оборотом и расходами, читает строку `kuperiods` и сверяет каждое её поле с
 * эталоном `MarketContract.PeriodModel` — копейка в копейку. Свойства самого
 * эталона (рост оборота, сохранение суммы, примеры документа) проверяет
 * `cooptypes/test/marketplace-period-model.test.ts`; здесь доказывается, что
 * контракт считает так же.
 *
 * Сценарии:
 *   • двенадцать месяцев роста оборота при неизменных расходах — ставка
 *     списания не растёт и не превышает ставку обеспечительной части;
 *   • граница «собрано ровно на расходы», месяц без расходов, наименьшие и
 *     наибольшие суммы;
 *   • невыплаченная часть прошлого резерва уменьшает расходы следующего месяца;
 *   • доля инициатора 0 % и 100 %;
 *   • отказы: нулевой оборот, отрицательные расходы, чужая валюта, период ноль,
 *     повтор периода, участка нет.
 *
 * Номера периодов — от 4 000 000 000: настоящие месяцы (год × 12 + месяц) и
 * месяцы стенда со сжатым временем всегда меньше, поэтому строки теста не
 * попадают настоящему прогону в «прошлый месяц». Свои строки тест стирает.
 *
 * Настройки кооператива (потолок и резерв, доля инициатора) тест меняет только
 * на стенде с сидом docs-harness и возвращает прежние значения; на прочих
 * стендах эти сценарии пропускаются, остальные идут на резерве, который есть.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BranchContract, FundContract, MarketContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { COOP, STATE_DIR } from './marketplace/chainHelpers'
import { type MonthInput, asset, branchReserveSum, branchReserves, closeMonthAndCompare, coopPusher, branchPeriods as periodRows, rub, units } from './marketplace/periodHelpers'

const { chargeRate, HUNDR_PERCENTS: H } = MarketContract.PeriodModel

const bc = new Blockchain(config.network, config.private_keys)

const MARKET = MarketContract.contractName.production
const BRANCH = BranchContract.contractName.production
const FUND = FundContract.contractName.production

const PERIOD_FLOOR = 4_000_000_000
/** Участок стенда с сидом docs-harness: только на нём тест меняет настройки кооператива. */
const HARNESS_BRANCH = 'krg'
/** Фикстуры сида лежат в чекауте и после смены стенда, поэтому стенд узнаётся ещё и по участку в цепи. */
const HARNESS_STATE = fs.existsSync(path.join(STATE_DIR, 'chairkrg.json'))

/** Ставка обеспечительной части, с которой собраны месяцы теста: 38 %. */
const X = 380_000n
/** Материальной помощи выплачено заведомо больше любого резерва: невыплаченной части нет. */
const AID_ABOVE_ANY_RESERVE = rub(1_000_000_000)

let braname = ''
/** Стенд с сидом docs-harness: меняем потолок, резерв и долю инициатора и возвращаем прежние. */
let settingsAllowed = false
let trustee = ''
let fundsPercent = 0n
let initiatorPercent = 0n
let nextPeriod = 0
const created: number[] = []

const push = coopPusher(bc)
const branchPeriods = () => periodRows(bc, braname)

const reserveRows = () => branchReserves(bc, braname)
const reserveSum = () => branchReserveSum(bc, braname)

async function dropPeriod(period: number): Promise<void> {
  await push(MARKET, 'delperiod', { coopname: COOP, braname, period }).catch(() => {})
  const i = created.indexOf(period)
  if (i >= 0)
    created.splice(i, 1)
}

/** Один месяц: расчёт контрактом и сверка строки цепи с эталоном; строка запоминается для уборки. */
async function closeAndCompare(label: string, input: MonthInput, period = nextPeriod++) {
  const month = await closeMonthAndCompare({ bc, push, braname, fundsPercent, initiatorPercent }, label, input, period)
  created.push(period)
  return month
}

describe('стол заказов — арифметика итога месяца против эталона (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()

    const branches: any[] = await bc.getTableRows(BRANCH, COOP, 'branches', 100)
    const branch = branches.find(b => b.braname === HARNESS_BRANCH) ?? branches[0]
    expect(branch, 'у кооператива есть кооперативный участок').toBeDefined()
    braname = branch.braname
    settingsAllowed = HARNESS_STATE && braname === HARNESS_BRANCH
    trustee = branch.trustee

    const funds: any[] = await bc.getTableRows(FUND, COOP, 'funds', 50)
    fundsPercent = funds.filter(f => f.kind === 'accum').reduce((sum, f) => sum + BigInt(f.percent), 0n)
    const cfg: any[] = await bc.getTableRows(MARKET, COOP, 'config', 1)
    initiatorPercent = BigInt(cfg[0]?.initiator_share_percent ?? 618_000)

    // Строки, оставшиеся от прерванного прогона этого теста.
    for (const row of (await branchPeriods()).filter(r => Number(r.period) >= PERIOD_FLOOR))
      await push(MARKET, 'delperiod', { coopname: COOP, braname, period: Number(row.period) }).catch(() => {})

    nextPeriod = PERIOD_FLOOR + (Math.floor(Date.now() / 1000) % 100_000_000) * 2
  })

  afterAll(async () => {
    for (const period of [...created])
      await dropPeriod(period)
  })

  it('mkt.order.keu.math.01 — двенадцать месяцев роста оборота: строка цепи равна эталону, ставка списания не растёт и не выше 38 %', async () => {
    const turnovers = [200_000, 500_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000, 8_000_000, 12_000_000, 20_000_000, 50_000_000, 400_000_000]
    const expenses = { planned: rub(200_000), memos: rub(30_000), aidPaid: AID_ABOVE_ANY_RESERVE }
    const months: Array<{ period: number, rate: bigint, deficit: bigint, branch: bigint, expensesTotal: bigint }> = []

    for (const [i, turnoverRub] of turnovers.entries()) {
      const turnover = rub(turnoverRub)
      const month = await closeAndCompare(`месяц ${i + 1}, оборот ${turnoverRub} ₽`, { turnover, secured: turnover * X / H, ...expenses })
      months.push({ period: month.period, rate: chargeRate(month.totals), deficit: month.totals.deficit, branch: month.totals.branch, expensesTotal: month.totals.expenses })
      // В цепи у участка держатся две строки: текущая и прошлая.
      if (i >= 2)
        await dropPeriod(months[i - 2].period)
    }

    for (let i = 0; i < months.length; i++) {
      expect(months[i].rate <= X, `месяц ${i + 1}: ставка не выше ставки обеспечительной части`).toBe(true)
      if (i > 0)
        expect(months[i].rate <= months[i - 1].rate, `месяц ${i + 1}: ставка не выше прошлого месяца`).toBe(true)
      if (months[i].deficit > 0n)
        expect(months[i].rate, `месяц ${i + 1}: при дефиците списывается вся обеспечительная часть`).toBe(X)
      else
        expect(months[i].branch, `месяц ${i + 1}: участок получает ровно расходы`).toBe(months[i].expensesTotal)
    }
    expect(months[0].deficit > 0n, 'первый месяц: собранного меньше расходов').toBe(true)
    expect(months[months.length - 1].deficit, 'последний месяц: дефицита нет').toBe(0n)
    expect(months[months.length - 1].rate < months[0].rate, 'к последнему месяцу ставка снизилась').toBe(true)
    // Предел при большом обороте: доля фондов и инициатора от ставки обеспечительной части.
    const floor = X * (fundsPercent + (H - fundsPercent) * initiatorPercent / H) / H
    expect(months[months.length - 1].rate >= floor).toBe(true)
  }, 240_000)

  it('mkt.order.keu.math.02 — границы: собрано ровно на расходы, месяц без расходов, наименьшие и наибольшие суммы', async () => {
    const reserve = await reserveSum()
    // Собрано ровно на расходы: ни дефицита, ни экономии.
    const exact = await closeAndCompare('собрано ровно на расходы', {
      turnover: rub(2_000_000),
      secured: rub(100_000) + reserve,
      planned: rub(100_000),
      aidPaid: AID_ABOVE_ANY_RESERVE,
    })
    expect([exact.totals.deficit, exact.totals.funds, exact.totals.initiator, exact.totals.returned]).toEqual([0n, 0n, 0n, 0n])
    await dropPeriod(exact.period)

    // На одну единицу меньше расходов — дефицит в одну единицу.
    const short = await closeAndCompare('на единицу меньше расходов', {
      turnover: rub(2_000_000),
      secured: rub(100_000) + reserve - 1n,
      planned: rub(100_000),
      aidPaid: AID_ABOVE_ANY_RESERVE,
    })
    expect(short.totals.deficit).toBe(1n)
    await dropPeriod(short.period)

    // На одну единицу больше — единица экономии достаётся пайщикам как остаток округления.
    const over = await closeAndCompare('на единицу больше расходов', {
      turnover: rub(2_000_000),
      secured: rub(100_000) + reserve + 1n,
      planned: rub(100_000),
      aidPaid: AID_ABOVE_ANY_RESERVE,
    })
    expect(over.totals.funds + over.totals.initiator + over.totals.returned).toBe(1n)
    await dropPeriod(over.period)

    const tiny = await closeAndCompare('наименьшие суммы', { turnover: 3n, secured: 1n, aidPaid: AID_ABOVE_ANY_RESERVE })
    await dropPeriod(tiny.period)

    // Сотни триллионов рублей: промежуточные произведения считаются без переполнения.
    const huge = await closeAndCompare('наибольшие суммы', {
      turnover: rub(400_000_000_000_000),
      secured: rub(152_000_000_000_000),
      planned: rub(1_000_000_000),
      memos: rub(1_000_000_000),
      aidPaid: AID_ABOVE_ANY_RESERVE,
    })
    await dropPeriod(huge.period)

    const zeroExpenses = await closeAndCompare('плановых расходов и записок нет', {
      turnover: rub(1_000_000),
      secured: rub(380_000),
      aidPaid: AID_ABOVE_ANY_RESERVE,
    })
    expect(zeroExpenses.totals.expenses).toBe(reserve)
    await dropPeriod(zeroExpenses.period)
  }, 240_000)

  it('mkt.order.keu.math.03 — резерв прошлого месяца берётся из прошлой строки; невыплаченная часть уменьшает расходы', async () => {
    const first = await closeAndCompare('первый месяц пары', { turnover: rub(1_000_000), secured: rub(380_000), planned: rub(200_000), aidPaid: AID_ABOVE_ANY_RESERVE })
    // Материальной помощи не выплачено: невыплаченная часть равна резерву первой строки.
    const second = await closeAndCompare('второй месяц пары', { turnover: rub(1_000_000), secured: rub(380_000), planned: rub(200_000), aidPaid: 0n })
    expect(second.facts.reservePrev, 'резерв прошлого месяца — резерв первой строки').toBe(units(first.row.aid_reserve))
    expect(second.totals.unpaid).toBe(units(first.row.aid_reserve))
    expect(second.totals.expenses, 'расходы второго месяца меньше на невыплаченную часть').toBe(rub(200_000))

    // Выплачена половина прошлого резерва.
    const half = units(first.row.aid_reserve) / 2n
    const third = await closeAndCompare('третий месяц пары', { turnover: rub(1_000_000), secured: rub(380_000), planned: rub(200_000), aidPaid: half })
    expect(third.totals.unpaid).toBe(units(second.row.aid_reserve) - half)

    for (const m of [first, second, third])
      await dropPeriod(m.period)
  }, 240_000)

  it('mkt.order.keu.math.04 — резерв участка 150 000 ₽: невыплаченная часть 150 000 ₽ делает расходы следующего месяца меньше суммы планов', async (ctx) => {
    if (!settingsAllowed)
      return ctx.skip()
    const limitBefore: any[] = await bc.getTableRows(BRANCH, COOP, 'brnconfig', 1)
    const reserveBefore = (await reserveRows()).find(r => r.username === trustee)
    await push(BRANCH, 'setaidlimit', { coopname: COOP, limit: asset(rub(200_000)) })
    await push(BRANCH, 'setreserve', { coopname: COOP, braname, username: trustee, amount: asset(rub(150_000)) })
    try {
      const reserve = await reserveSum()
      expect(reserve >= rub(150_000)).toBe(true)
      const first = await closeAndCompare('месяц с резервом', { turnover: rub(3_000_000), secured: rub(1_140_000), planned: rub(200_000), aidPaid: AID_ABOVE_ANY_RESERVE })
      expect(first.totals.expenses).toBe(rub(200_000) + reserve)
      // Планы 100 000 ₽, резерв прошлого месяца не выплачен: расходы = 100 000 + Р − Р = 100 000.
      const second = await closeAndCompare('следующий месяц, помощь не выплачена', { turnover: rub(3_000_000), secured: rub(1_140_000), planned: rub(100_000), aidPaid: 0n })
      expect(second.totals.unpaid).toBe(reserve)
      expect(second.totals.expenses).toBe(rub(100_000))
      await dropPeriod(first.period)
      await dropPeriod(second.period)
    }
    finally {
      if (reserveBefore)
        await push(BRANCH, 'setreserve', { coopname: COOP, braname, username: trustee, amount: reserveBefore.amount }).catch(() => {})
      else
        await push(BRANCH, 'delreserve', { coopname: COOP, braname, username: trustee }).catch(() => {})
      await push(BRANCH, 'setaidlimit', { coopname: COOP, limit: limitBefore[0]?.aid_month_limit ?? asset(0n) }).catch(() => {})
    }
  }, 240_000)

  it('mkt.order.keu.math.05 — доля инициатора 0 % и 100 %: экономия целиком пайщикам либо целиком инициатору', async (ctx) => {
    if (!settingsAllowed)
      return ctx.skip()
    const before = initiatorPercent
    try {
      await push(MARKET, 'setshares', { coopname: COOP, initiator_share_percent: 0 })
      initiatorPercent = 0n
      const none = await closeAndCompare('доля инициатора 0 %', { turnover: rub(3_000_000), secured: rub(1_140_000), planned: rub(200_000), aidPaid: AID_ABOVE_ANY_RESERVE })
      expect(none.totals.initiator).toBe(0n)
      expect(none.totals.returned > 0n).toBe(true)
      await dropPeriod(none.period)

      await push(MARKET, 'setshares', { coopname: COOP, initiator_share_percent: 1_000_000 })
      initiatorPercent = H
      const all = await closeAndCompare('доля инициатора 100 %', { turnover: rub(3_000_000), secured: rub(1_140_000), planned: rub(200_000), aidPaid: AID_ABOVE_ANY_RESERVE })
      expect(all.totals.returned).toBe(0n)
      expect(all.totals.initiator > 0n).toBe(true)
      await dropPeriod(all.period)
    }
    finally {
      await push(MARKET, 'setshares', { coopname: COOP, initiator_share_percent: Number(before) }).catch(() => {})
      initiatorPercent = before
    }
  }, 240_000)

  it('mkt.order.keu.math.06 — отказы расчёта: нулевой оборот и собранное, отрицательные расходы, чужая валюта, период ноль, повтор, участка нет', async () => {
    const period = nextPeriod++
    const base = { coopname: COOP, braname, period, turnover: asset(rub(1_000)), secured: asset(rub(380)), planned: asset(0n), memos: asset(0n), aid_paid: asset(0n) }

    await expect(push(MARKET, 'closeperiod', { ...base, turnover: asset(0n) })).rejects.toThrow(/MARKETPLACE_PERIOD_AMOUNT_INVALID/)
    await expect(push(MARKET, 'closeperiod', { ...base, secured: asset(0n) })).rejects.toThrow(/MARKETPLACE_PERIOD_AMOUNT_INVALID/)
    await expect(push(MARKET, 'closeperiod', { ...base, turnover: asset(-1n) })).rejects.toThrow(/MARKETPLACE_PERIOD_AMOUNT_INVALID/)
    for (const field of ['planned', 'memos', 'aid_paid'])
      await expect(push(MARKET, 'closeperiod', { ...base, [field]: asset(-1n) }), `отрицательное ${field}`).rejects.toThrow(/MARKETPLACE_PERIOD_AMOUNT_INVALID/)
    for (const field of ['turnover', 'secured', 'planned', 'memos', 'aid_paid'])
      await expect(push(MARKET, 'closeperiod', { ...base, [field]: asset(rub(1), 'AXON') }), `чужая валюта в ${field}`).rejects.toThrow(/MARKETPLACE_PERIOD_AMOUNT_INVALID/)
    await expect(push(MARKET, 'closeperiod', { ...base, period: 0 })).rejects.toThrow(/MARKETPLACE_PERIOD_AMOUNT_INVALID/)
    await expect(push(MARKET, 'closeperiod', { ...base, braname: 'nosuchbranch' })).rejects.toThrow()
    expect((await branchPeriods()).find(r => Number(r.period) === period), 'после отказов строки нет').toBeUndefined()

    await push(MARKET, 'closeperiod', base)
    created.push(period)
    await expect(push(MARKET, 'closeperiod', { ...base, turnover: asset(rub(2_000)) })).rejects.toThrow(/MARKETPLACE_PERIOD_EXISTS/)
    const row = (await branchPeriods()).find(r => Number(r.period) === period)
    expect(units(row.turnover), 'повтор строку не изменил').toBe(rub(1_000))

    await dropPeriod(period)
    await expect(push(MARKET, 'delperiod', { coopname: COOP, braname, period })).rejects.toThrow(/MARKETPLACE_PERIOD_NOT_CLOSED/)
  }, 240_000)
})

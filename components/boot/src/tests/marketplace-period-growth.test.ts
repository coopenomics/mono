/**
 * Контрактный уровень: два месяца участка с ростом оборота — настоящие заказы,
 * расчёт итога и списание каждого заказа по ставкам месяца (задачи 99D-21,
 * 99D-22; реестр marketplace.order, случаи mkt.order.keu.growth.*).
 *
 * Пайщица получает четыре заказа: два в первом месяце и два, крупнее, во
 * втором. Обеспечительная часть всех заказов лежит на одном её кошельке к
 * списанию — тест проверяет, что списание одного заказа не трогает остаток
 * другого и что с ростом оборота пайщица платит меньшую долю стоимости:
 *
 *   • первый месяц — расходы участка выше собранного: вся обеспечительная
 *     часть становится членским взносом участка, возврата нет;
 *   • второй месяц — оборот вырос, расходы прежние: участок получает ровно
 *     расходы, из остатка идут фонды и доля инициатора, пайщице возвращается
 *     часть на свободный паевой; коэффициент экономического участия ниже, чем в первом месяце;
 *   • заказ, списанный двумя частями: остаток меньше доли участка — урезается
 *     доля инициатора, затем фондов; часть без стоимости возвращается целиком;
 *   • после четырёх заказов кошелёк к списанию пуст, а списанное и возвращённое
 *     в сумме равны собранному; остатки участка и фондов выросли ровно на свои
 *     части; доля инициаторов — на кошелёк возмещения паевых взносов участка, пока
 *     они не возвращены, иначе участку (задача 99D-27);
 *   • отказы списания: больше остатка, нулевая стоимость, нет строки итога.
 *
 * Ожидания каждой части — из эталона `MarketContract.PeriodModel` по ставкам
 * строки, записанной контрактом. Номера периодов — от 4 250 000 000: настоящие
 * месяцы всегда меньше. Свои строки итога тест стирает.
 *
 * Требует стенда после `reboot:extra` с сид-фазами docs-harness.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MarketContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { acceptToCoop, issueOrder, pickOffer, placeOrder } from './marketplace/orderFlow'
import { CHAIRMAN, COOP, type LedgerRow, amount, ensureShareFunds, fromState, loginAs, sumOf, waitForOps } from './marketplace/chainHelpers'
import {
  accumulationFunds,
  asset,
  branchPeriods,
  closeMonthAndCompare,
  coopPusher,
  fundBalances,
  investBranch,
  ratesOf,
  rub,
  units,
  userWallet,
} from './marketplace/periodHelpers'

const { chargeOrder, chargeRate, crpsRoute, splitFunds, HUNDR_PERCENTS: H } = MarketContract.PeriodModel

const bc = new Blockchain(config.network, config.private_keys)
const push = coopPusher(bc)

const BRANAME = 'krg'
const MARKET = MarketContract.contractName.production
const PERIOD_FLOOR = 4_250_000_000
/** Материальной помощи выплачено заведомо больше любого резерва: невыплаченной части нет. */
const AID_ABOVE_ANY_RESERVE = rub(1_000_000_000)

const sidorov = fromState('sidorov')
const ekaterina = fromState('ekaterina')
const chairkrg = fromState('chairkrg')

let chairmanToken = ''
let sidorovToken = ''
let ekaterinaToken = ''
let chairkrgToken = ''

let offerId = ''
let unitPrice = 0
let fundsPercent = 0n
let initiatorPercent = 0n
let period1 = 0
let period2 = 0
let dueAtStart = 0n

interface Issued {
  orderHash: string
  /** Обеспечительная часть заказа на кошельке к списанию (o.mkt.todue). */
  due: bigint
  /** Стоимость выданного (o.mkt.consum). */
  base: bigint
}

/** Заказ → акцепт → приёмка с двумя подписями → выдача целиком; факт обеспечительной части и стоимости — из операций цепи. */
async function issued(quantity: number): Promise<Issued> {
  const placed = await placeOrder({ token: ekaterinaToken, who: ekaterina, offerId, quantity, braname: BRANAME })
  await acceptToCoop({
    supplierToken: sidorovToken,
    supplier: sidorov,
    operatorToken: chairkrgToken,
    operator: chairkrg,
    orderId: placed.orderId,
    braname: BRANAME,
    factQuantity: quantity,
    factUnitPrice: unitPrice,
  })
  await waitForOps(chairmanToken, placed.orderHash, ['o.mkt.purch'])
  await issueOrder({
    blockchain: bc,
    operatorToken: chairkrgToken,
    operator: chairkrg,
    memberToken: ekaterinaToken,
    member: ekaterina,
    orderId: placed.orderId,
    braname: BRANAME,
    actualQuantity: quantity,
    actualUnitPrice: unitPrice,
  })
  const ops = await waitForOps(chairmanToken, placed.orderHash, ['o.mkt.consum', 'o.mkt.todue'])
  const order = {
    orderHash: placed.orderHash,
    due: units(sumOf(ops, 'o.mkt.todue').toFixed(4)),
    base: units(sumOf(ops, 'o.mkt.consum').toFixed(4)),
  }
  expect(order.due > 0n && order.base > 0n, 'после выдачи есть стоимость заказа и обеспечительная часть к списанию').toBe(true)
  return order
}

interface Balances {
  due: bigint
  share: bigint
  common: bigint
  repay: bigint
  funds: Map<string, bigint>
}

async function balances(): Promise<Balances> {
  return {
    due: await userWallet(bc, 'w.mkt.due', ekaterina.account),
    share: await userWallet(bc, 'w.mkt.share', ekaterina.account),
    common: await userWallet(bc, 'w.brn.common', BRANAME),
    repay: await userWallet(bc, 'w.mkt.repay', BRANAME),
    funds: await fundBalances(bc),
  }
}

/**
 * Списание по ставкам строки итога: части и остатки кошельков сверяются с
 * эталоном. Возвращает части — для сумм по месяцу.
 */
async function chargeAndCompare(label: string, row: any, order: { orderHash: string, amount: bigint, base: bigint }) {
  const expected = chargeOrder(ratesOf(row), order.amount, order.base)
  const before = await balances()
  // Доля инициаторов идёт по фазам инвестиционного этапа (задача 99D-27): пока
  // паевые взносы участка не возвращены — на кошелёк возмещения, сверх непогашенного
  // и без паевых взносов — участку. Паевые взносы в участок мог оставить соседний тест.
  const route = crpsRoute(await investBranch(bc, BRANAME), expected.initiator)

  await push(MARKET, 'chargeperiod', {
    coopname: COOP,
    username: ekaterina.account,
    braname: BRANAME,
    order_hash: order.orderHash,
    amount: asset(order.amount),
    base: asset(order.base),
    period: Number(row.period),
  })

  const after = await balances()
  expect(before.due - after.due, `${label}: с кошелька к списанию снят ровно остаток заказа`).toBe(order.amount)
  expect(after.share - before.share, `${label}: возврат пайщице на свободный паевой`).toBe(expected.returned)
  // Переплата завершивших возврат переводится с кошелька возмещения участку,
  // поэтому сверяется сумма двух кошельков и верхняя граница возмещения.
  expect((after.common - before.common) + (after.repay - before.repay), `${label}: участку и инициаторам`).toBe(expected.branch + expected.initiator)
  expect(after.repay - before.repay <= route.repay, `${label}: возмещено не больше непогашенного`).toBe(true)
  expect((await investBranch(bc, BRANAME)).acc, `${label}: счётчик возврата участка`).toBe(route.acc)

  const funds = await accumulationFunds(bc)
  const shares = splitFunds(expected.funds, funds.map(f => BigInt(f.percent)))
  funds.forEach((f, i) => {
    const wallet = String(f.wallet)
    expect((after.funds.get(wallet) ?? 0n) - (before.funds.get(wallet) ?? 0n), `${label}: доля фонда ${f.name}`).toBe(shares[i])
  })
  expect(expected.charged + expected.returned, `${label}: списано + возвращено = остаток заказа`).toBe(order.amount)
  return expected
}

describe('стол заказов — два месяца участка с ростом оборота (contract, живая цепь)', () => {
  let month1: Awaited<ReturnType<typeof closeMonthAndCompare>>
  let month2: Awaited<ReturnType<typeof closeMonthAndCompare>>
  const orders1: Issued[] = []
  const orders2: Issued[] = []
  const totals = { charged: 0n, returned: 0n, collected: 0n }
  let opsOfSplit: LedgerRow[] = []

  beforeAll(async () => {
    await bc.update_pass_instance()
    chairmanToken = await loginAs(CHAIRMAN)
    sidorovToken = await loginAs(sidorov)
    ekaterinaToken = await loginAs(ekaterina)
    chairkrgToken = await loginAs(chairkrg)

    const offer = await pickOffer(chairmanToken, sidorov.account, BRANAME, 'Мёд цветочный')
    offerId = offer.id
    unitPrice = amount(offer.price_per_unit)
    // Четыре заказа: 1 + 2 + 4 + 6 единиц, с обеспечительной частью сверху.
    await ensureShareFunds(ekaterina.account, 13 * unitPrice * 2, ekaterinaToken)

    fundsPercent = (await accumulationFunds(bc)).reduce((sum, f) => sum + BigInt(f.percent), 0n)
    const cfg: any[] = await bc.getTableRows(MARKET, COOP, 'config', 1)
    initiatorPercent = BigInt(cfg[0]?.initiator_share_percent ?? 618_000)

    for (const row of (await branchPeriods(bc, BRANAME)).filter(r => Number(r.period) >= PERIOD_FLOOR))
      await push(MARKET, 'delperiod', { coopname: COOP, braname: BRANAME, period: Number(row.period) }).catch(() => {})
    period1 = PERIOD_FLOOR + (Math.floor(Date.now() / 1000) % 10_000_000) * 2
    period2 = period1 + 1
    dueAtStart = await userWallet(bc, 'w.mkt.due', ekaterina.account)
  }, 600_000)

  afterAll(async () => {
    for (const period of [period1, period2])
      await push(MARKET, 'delperiod', { coopname: COOP, braname: BRANAME, period }).catch(() => {})
  })

  it('mkt.order.keu.growth.01 — первый месяц: два заказа, расходы выше собранного — вся обеспечительная часть участку, возврата нет', async () => {
    orders1.push(await issued(1), await issued(2))
    expect(await userWallet(bc, 'w.mkt.due', ekaterina.account), 'обеспечительная часть двух заказов лежит на одном кошельке').toBe(dueAtStart + orders1[0].due + orders1[1].due)

    const turnover = orders1.reduce((s, o) => s + o.base, 0n)
    const secured = orders1.reduce((s, o) => s + o.due, 0n)
    const ctx = { bc, push, braname: BRANAME, fundsPercent, initiatorPercent }
    // Плановые расходы на тысячу рублей больше собранного: дефицит при любом резерве участка.
    month1 = await closeMonthAndCompare(ctx, 'первый месяц', { turnover, secured, planned: secured + rub(1_000), aidPaid: AID_ABOVE_ANY_RESERVE }, period1)
    expect(month1.totals.deficit > 0n, 'дефицит участка').toBe(true)
    expect([month1.totals.funds, month1.totals.initiator, month1.totals.returned]).toEqual([0n, 0n, 0n])

    for (const [i, order] of orders1.entries()) {
      const parts = await chargeAndCompare(`первый месяц, заказ ${i + 1}`, month1.row, { orderHash: order.orderHash, amount: order.due, base: order.base })
      // Ставка месяца округлена вниз один раз, доля заказа — ещё раз: остаток не больше base / H + 2 единиц.
      expect(parts.returned <= order.base / H + 2n, 'при дефиците пайщице достаётся только остаток округления').toBe(true)
      totals.charged += parts.charged
      totals.returned += parts.returned
      totals.collected += order.due
    }
    expect(await userWallet(bc, 'w.mkt.due', ekaterina.account), 'после списания двух заказов кошелёк вернулся к исходному').toBe(dueAtStart)
  }, 600_000)

  it('mkt.order.keu.growth.02 — второй месяц: оборот вырос, расходы прежние — коэффициент экономического участия ниже, пайщице возвращается часть', async () => {
    orders2.push(await issued(4), await issued(6))
    const turnover = orders2.reduce((s, o) => s + o.base, 0n)
    const secured = orders2.reduce((s, o) => s + o.due, 0n)
    expect(turnover > month1.facts.turnover, 'оборот второго месяца больше первого').toBe(true)

    const ctx = { bc, push, braname: BRANAME, fundsPercent, initiatorPercent }
    // Плановые расходы — те же деньги, что участок получил в первом месяце. Материальной
    // помощи не выплачено: невыплаченная часть равна резерву прошлой строки и гасит резерв.
    const planned = month1.totals.branch
    month2 = await closeMonthAndCompare(ctx, 'второй месяц', { turnover, secured, planned, aidPaid: 0n }, period2)
    expect(month2.totals.expenses, 'расходы второго месяца — планы: резерв погашен невыплаченной частью').toBe(planned)
    expect(month2.totals.deficit, 'дефицита нет').toBe(0n)
    expect(month2.totals.branch, 'участок получает ровно расходы').toBe(planned)
    expect(month2.totals.returned > 0n, 'есть возврат пайщикам').toBe(true)
    expect(chargeRate(month2.totals) < chargeRate(month1.totals), 'коэффициент экономического участия второго месяца ниже первого').toBe(true)

    // Первый заказ месяца списывается целиком.
    const whole = orders2[0]
    const parts = await chargeAndCompare('второй месяц, заказ 1', month2.row, { orderHash: whole.orderHash, amount: whole.due, base: whole.base })
    expect(parts.returned > 0n, 'пайщице возвращена часть обеспечительной части').toBe(true)
    expect(parts.charged < whole.due, 'списано меньше обеспечительной части заказа').toBe(true)
    // Доля стоимости, списанная со второго месяца, ниже доли первого.
    const first = orders1[0]
    const firstParts = chargeOrder(ratesOf(month1.row), first.due, first.base)
    expect(parts.charged * first.base < firstParts.charged * whole.base, 'доля стоимости заказа ниже, чем в первом месяце').toBe(true)
    totals.charged += parts.charged
    totals.returned += parts.returned
    totals.collected += whole.due
  }, 600_000)

  it('mkt.order.keu.growth.03 — заказ двумя частями: остаток меньше доли участка урезает инициатора и фонды; часть без стоимости возвращается целиком', async () => {
    const order = orders2[1]
    const rates = ratesOf(month2.row)
    // Первая часть: остаток вдвое меньше доли участка от полной стоимости.
    const branchShare = chargeOrder(rates, order.due, order.base).branch
    const first = branchShare / 2n
    expect(first > 0n && first < order.due).toBe(true)
    const cut = await chargeAndCompare('урезанная часть', month2.row, { orderHash: order.orderHash, amount: first, base: order.base })
    expect([cut.branch, cut.funds, cut.initiator, cut.returned], 'вся часть участку, остальным ноль').toEqual([first, 0n, 0n, 0n])

    // Вторая часть: остаток заказа при стоимости в одну единицу актива — делить нечего, всё возвращается.
    const rest = order.due - first
    const back = await chargeAndCompare('часть без стоимости', month2.row, { orderHash: order.orderHash, amount: rest, base: 1n })
    expect([back.charged, back.returned]).toEqual([0n, rest])

    totals.charged += cut.charged + back.charged
    totals.returned += cut.returned + back.returned
    totals.collected += order.due

    opsOfSplit = await waitForOps(chairmanToken, order.orderHash, ['o.mkt.charge', 'o.mkt.retdue'])
    expect(units(sumOf(opsOfSplit, 'o.mkt.charge').toFixed(4)), 'в нитке заказа списано ровно урезанная часть').toBe(first)
    expect(units(sumOf(opsOfSplit, 'o.mkt.retdue').toFixed(4)), 'в нитке заказа возвращён остаток').toBe(rest)
  }, 600_000)

  it('mkt.order.keu.growth.04 — итог двух месяцев: кошелёк к списанию пуст, списанное и возвращённое равны собранному', async () => {
    expect(await userWallet(bc, 'w.mkt.due', ekaterina.account)).toBe(dueAtStart)
    expect(totals.charged + totals.returned).toBe(totals.collected)
    expect(totals.returned > 0n).toBe(true)
  })

  it('mkt.order.keu.growth.05 — отказы списания: больше остатка, нулевые суммы, нет строки итога, участка нет', async () => {
    const order = orders2[0]
    const base = { coopname: COOP, username: ekaterina.account, braname: BRANAME, order_hash: order.orderHash, amount: asset(order.due), base: asset(order.base), period: period2 }
    const dueNow = await userWallet(bc, 'w.mkt.due', ekaterina.account)

    await expect(push(MARKET, 'chargeperiod', { ...base, amount: asset(dueNow + 1n) }), 'больше остатка кошелька').rejects.toThrow(/MARKETPLACE_DUE_EXCEEDS/)
    await expect(push(MARKET, 'chargeperiod', { ...base, amount: asset(0n) })).rejects.toThrow(/MARKETPLACE_DUE_AMOUNT_INVALID/)
    await expect(push(MARKET, 'chargeperiod', { ...base, base: asset(0n) })).rejects.toThrow(/MARKETPLACE_DUE_AMOUNT_INVALID/)
    await expect(push(MARKET, 'chargeperiod', { ...base, amount: asset(rub(1), 'AXON') })).rejects.toThrow(/MARKETPLACE_DUE_AMOUNT_INVALID/)
    await expect(push(MARKET, 'chargeperiod', { ...base, period: period2 + 7 })).rejects.toThrow(/MARKETPLACE_PERIOD_NOT_CLOSED/)
    await expect(push(MARKET, 'chargeperiod', { ...base, braname: 'nosuchbranch' })).rejects.toThrow()
    expect(await userWallet(bc, 'w.mkt.due', ekaterina.account), 'отказы кошелёк не тронули').toBe(dueNow)
  }, 120_000)
})

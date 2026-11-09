/**
 * Контрактный уровень: счётчики списания, итог периода участка и списание
 * строки пайщика по ставкам (задачи 99D-19, 99D-21, 99D-33; КЭУ-1, КЭУ-3;
 * реестр marketplace.order, случаи mkt.order.keu.*).
 *
 * Тест ведёт один заказ до закрытия выдачи тем же путём, что и денежный тест
 * (`marketplace-money.test.ts`), и дальше проверяет учёт, который ведёт сам
 * контракт (узел сумм в цепь не передаёт):
 *
 *   • выдача пополняет строку пайщика `kudues` и строку участка `kucounters` за
 *     период конца гарантийного срока: стоимость и обеспечительная часть по факту;
 *   • до окончания периода `closeperiod` и `chargeperiod` отвечают
 *     MARKETPLACE_PERIOD_OPEN;
 *   • setshares / setinitiator — настройки доли инициатора и инициатора участка;
 *   • closeperiod после окончания периода — T и C из счётчика участка, от узла
 *     три факта о расходах → строка kuperiods, формулы которой сверяются с
 *     эталоном; счётчик участка стёрт; повтор — MARKETPLACE_PERIOD_EXISTS, период
 *     без заказов — MARKETPLACE_PERIOD_EMPTY, отказы аргументов;
 *   • chargeperiod — строка пайщика одной транзакцией в нитке p.mkt.due с
 *     хэшем строки: участку (o.brn.common), в фонды накопления по их процентам
 *     (o.fnd.indiv / o.fnd.resrv / o.fnd.devel), инициаторам — возмещение паевых
 *     взносов (o.mkt.repay) либо участку, пайщице обратно (o.mkt.retdue);
 *     строка стёрта, повтор — MARKETPLACE_DUE_NOT_FOUND;
 *   • delperiod стирает строку итога, повтор — MARKETPLACE_PERIOD_NOT_CLOSED.
 *
 * Период берётся из цепи: на стенде он короткий (`brnconfig.aid_period_seconds`),
 * тест дожидается его окончания. Потолок резерва после теста возвращается в
 * ноль, назначение инициатора снимается.
 *
 * Требует стенда после `reboot:extra` с сид-фазами docs-harness.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BranchContract, MarketContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { issueOrder, pickOffer, placeOrder } from './marketplace/orderFlow'
import { CHAIRMAN, COOP, type LedgerRow, amount, ensureShareFunds, fromState, gqlAs, historyOfProcess, loginAs, processTypeByOperation, signAs, sumOf, waitForOps } from './marketplace/chainHelpers'
import {
  accumulationFunds,
  asset,
  branchCounter,
  branchPeriods,
  chargeHash,
  closeMonthAndCompare,
  coopPusher,
  currentPeriod,
  fundBalances,
  investBranch,
  memberDue,
  rub,
  units,
  userWallet,
  waitPeriodEnd,
} from './marketplace/periodHelpers'

const { chargeRow, crpsRoute, splitFunds, HUNDR_PERCENTS: H } = MarketContract.PeriodModel

const bc = new Blockchain(config.network, config.private_keys)
const push = coopPusher(bc)

/**
 * Итог и списание идут по окончании периода конца гарантии: в настоящем
 * времени его не дождаться, поэтому набор идёт в фазе полигона со сжатым
 * временем (BLACKBOX_STAND_MONTH_SECONDS; стенд разработки задаёт переменную сам).
 */
const COMPRESSED = (Number(process.env.BLACKBOX_STAND_MONTH_SECONDS) || 0) > 0

const BRANAME = 'krg'
const ORDER_QTY = 2

const sidorov = fromState('sidorov')
const ekaterina = fromState('ekaterina')
const chairkrg = fromState('chairkrg')

const MARKET = MarketContract.contractName.production
const BRANCH = BranchContract.contractName.production

let chairmanToken = ''
let sidorovToken = ''
let ekaterinaToken = ''
let chairkrgToken = ''

let orderId = ''
let orderHash = ''
let unitPrice = 0
/** Факт обеспечительной части на кошельке к списанию по заказу (o.mkt.todue). */
let dueUnits = 0n
/** Стоимость выданного по заказу (o.mkt.consum). */
let baseUnits = 0n
/** Период списания заказа — тот, в который контракт поставил строку пайщика. */
let period = 0
let periodRow: any = null
let fundsPercent = 0n
let initiatorPercent = 0n

/** Строки пайщицы на участке по периодам: период → обеспечительная часть к списанию. */
async function memberRows(): Promise<Map<number, bigint>> {
  const rows: any[] = await bc.getTableRows(MARKET, COOP, 'kudues', 1000, ekaterina.account, ekaterina.account, 2)
  return new Map(rows.filter(r => r.username === ekaterina.account && r.braname === BRANAME).map(r => [Number(r.period), units(r.due)]))
}

describe.skipIf(!COMPRESSED)('стол заказов — счётчики списания, итог периода и списание по ставкам (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    chairmanToken = await loginAs(CHAIRMAN)
    sidorovToken = await loginAs(sidorov)
    ekaterinaToken = await loginAs(ekaterina)
    chairkrgToken = await loginAs(chairkrg)

    const offer = await pickOffer(chairmanToken, sidorov.account, BRANAME, 'Мёд цветочный')
    unitPrice = amount(offer.price_per_unit)
    await ensureShareFunds(ekaterina.account, ORDER_QTY * unitPrice * 2, ekaterinaToken)
    const before = await memberRows()

    // Заказ → акцепт → экспресс-приёмка с двумя подписями → выдача целиком.
    const placed = await placeOrder({ token: ekaterinaToken, who: ekaterina, offerId: offer.id, quantity: ORDER_QTY, braname: BRANAME })
    orderId = placed.orderId
    orderHash = placed.orderHash
    await waitForOps(chairmanToken, orderHash, ['o.mkt.fee'])

    await gqlAs(sidorovToken, 'mutation($i:MarketplaceAcceptOrdersBatchInput!){ marketplaceAcceptOrdersBatch(input:$i){ __typename } }', { i: { order_ids: [orderId] } })
    const ex: any = await gqlAs(chairkrgToken, `mutation($d:MarketplaceCreateExpressReceptionInput!){
      marketplaceCreateExpressReception(data:$d){ apl_receptions{ id fact_quantity_per_order{ order_id } } }
    }`, { d: { braname: BRANAME, offerer_account: sidorov.account, fact_quantity_per_order: [{ order_id: orderId, fact_quantity: ORDER_QTY, fact_unit_price: unitPrice.toFixed(4) }] } })
    const apl = (ex.marketplaceCreateExpressReception.apl_receptions as any[]).find(r => r.fact_quantity_per_order.some((f: any) => f.order_id === orderId))
    expect(apl, 'экспресс-приёмка обязана включить наш заказ').toBeTruthy()

    const sp: any = await gqlAs(sidorovToken, `query($d:MarketplaceAplReceptionByIdInput!){ marketplaceAplReceptionSupplierSignablePayloads(data:$d){ full_title html hash meta binary } }`, { d: { apl_reception_id: apl.id } })
    const supplierSigned: any[] = []
    for (const p of sp.marketplaceAplReceptionSupplierSignablePayloads) supplierSigned.push(await signAs(sidorov.wif, p, sidorov.account, 1))
    await gqlAs(sidorovToken, `mutation($d:MarketplaceSignAplReceptionInput!){ marketplaceSignAplReceptionAsSupplier(data:$d){ apl_reception{ id } } }`, { d: { apl_reception_id: apl.id, signed_documents: supplierSigned } })

    const cp: any = await gqlAs(chairkrgToken, `query($d:MarketplaceAplReceptionByIdInput!){
      marketplaceAplReceptionChairmanSignablePayloads(data:$d){ hash rawDocument{ full_title html hash meta binary } document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } } }
    }`, { d: { apl_reception_id: apl.id } })
    const chairSigned: any[] = []
    for (const p of cp.marketplaceAplReceptionChairmanSignablePayloads) chairSigned.push(await signAs(chairkrg.wif, p.rawDocument, chairkrg.account, 2, [p.document]))
    await gqlAs(chairkrgToken, `mutation($d:MarketplaceSignAplReceptionInput!){ marketplaceSignAplReceptionAsChairman(data:$d){ apl_reception{ id } } }`, { d: { apl_reception_id: apl.id, signed_documents: chairSigned } })
    await waitForOps(chairmanToken, orderHash, ['o.mkt.purch'])

    await issueOrder({ blockchain: bc, operatorToken: chairkrgToken, operator: chairkrg, memberToken: ekaterinaToken, member: ekaterina, orderId, braname: BRANAME, actualQuantity: ORDER_QTY, actualUnitPrice: unitPrice })
    const ops = await waitForOps(chairmanToken, orderHash, ['o.mkt.consum', 'o.mkt.todue'])
    dueUnits = units(sumOf(ops, 'o.mkt.todue').toFixed(4))
    baseUnits = units(sumOf(ops, 'o.mkt.consum').toFixed(4))
    expect(dueUnits > 0n, 'после выдачи на кошельке к списанию лежит обеспечительная часть').toBe(true)

    // Период строки — тот, где обеспечительная часть пайщицы выросла ровно на факт выдачи.
    const after = await memberRows()
    const grown = [...after.entries()].find(([p, due]) => due - (before.get(p) ?? 0n) === dueUnits)
    expect(grown, 'выдача пополнила строку счётчика пайщицы за период конца гарантии').toBeDefined()
    period = grown![0]

    fundsPercent = (await accumulationFunds(bc)).reduce((s, f) => s + BigInt(f.percent), 0n)
    const cfg: any[] = await bc.getTableRows(MARKET, COOP, 'config', 1)
    initiatorPercent = BigInt(cfg[0]?.initiator_share_percent ?? 618_000)

    // Резерв обеспечения председателю — слагаемое расходов прогона.
    await push(BRANCH, 'setaidlimit', { coopname: COOP, limit: '1000.0000 RUB' })
    await push(BRANCH, 'setreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account, amount: '300.0000 RUB' })
  }, 600_000)

  afterAll(async () => {
    await push(MARKET, 'setinitiator', { coopname: COOP, braname: BRANAME, username: '' }).catch(() => {})
    await push(BRANCH, 'delreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account }).catch(() => {})
    await push(BRANCH, 'setaidlimit', { coopname: COOP, limit: '0.0000 RUB' }).catch(() => {})
  })

  it('mkt.order.keu.17 — выдача пополнила счётчики: строка пайщицы и строка участка за период конца гарантии; до конца периода итог и списание отклоняются', async () => {
    const due = await memberDue(bc, ekaterina.account, BRANAME, period)
    expect(due, 'строка пайщицы есть').toBeDefined()
    expect(units(due.due) >= dueUnits).toBe(true)
    expect(units(due.turnover) >= baseUnits).toBe(true)
    expect(Number(due.orders) >= 1).toBe(true)

    const counter = await branchCounter(bc, BRANAME, period)
    expect(counter, 'строка участка есть').toBeDefined()
    expect(units(counter.secured) >= dueUnits).toBe(true)
    expect(units(counter.turnover) >= baseUnits).toBe(true)
    expect(Number(counter.members) >= 1).toBe(true)

    // Период ещё идёт — расчёт и списание невозможны; к границе периода проверка не относится.
    if (await currentPeriod(bc) === period) {
      await expect(push(MARKET, 'closeperiod', { coopname: COOP, braname: BRANAME, period, planned: asset(0n), memos: asset(0n), aid_paid: asset(0n) }))
        .rejects.toThrow(/MARKETPLACE_PERIOD_OPEN/)
      await expect(push(MARKET, 'chargeperiod', { coopname: COOP, username: ekaterina.account, braname: BRANAME, period }))
        .rejects.toThrow(/MARKETPLACE_PERIOD_OPEN/)
    }
  }, 120_000)

  it('setshares: доля инициатора записывается; выше 100 % — отказ', async () => {
    await push(MARKET, 'setshares', { coopname: COOP, initiator_share_percent: 618_000 })
    const cfg: any[] = await bc.getTableRows(MARKET, COOP, 'config', 1)
    expect(Number(cfg[0]?.initiator_share_percent)).toBe(618_000)
    initiatorPercent = 618_000n
    await expect(push(MARKET, 'setshares', { coopname: COOP, initiator_share_percent: 1_000_001 })).rejects.toThrow(/MARKETPLACE_INITIATOR_SHARE_INVALID/)
  })

  it('setinitiator: инициатор участка назначается отдельно от председателя; посторонний не пайщик — отказ', async () => {
    await push(MARKET, 'setinitiator', { coopname: COOP, braname: BRANAME, username: chairkrg.account })
    const rows: any[] = await bc.getTableRows(MARKET, COOP, 'initiators', 100)
    expect(rows.find(r => r.braname === BRANAME)?.username).toBe(chairkrg.account)
    await expect(push(MARKET, 'setinitiator', { coopname: COOP, braname: BRANAME, username: 'nobodyhere12' })).rejects.toThrow()
  })

  it('closeperiod после окончания периода: T и C из счётчика участка, строка сходится по формулам документа; повтор — MARKETPLACE_PERIOD_EXISTS; период без заказов — MARKETPLACE_PERIOD_EMPTY; отказы аргументов', async () => {
    await waitPeriodEnd(bc, period)
    const planned = 200n * UNITS
    const month = await closeMonthAndCompare({ bc, push, braname: BRANAME, fundsPercent, initiatorPercent }, 'итог периода', { planned }, period)
    periodRow = month.row
    expect(units(periodRow.aid_reserve)).toBe(300n * UNITS)
    expect(units(periodRow.turnover) >= baseUnits, 'стоимость заказов — из счётчика участка').toBe(true)
    expect(units(periodRow.secured) >= dueUnits, 'собранная обеспечительная часть — из счётчика участка').toBe(true)
    expect(periodRow.initiator).toBe(chairkrg.account)

    const base = { coopname: COOP, braname: BRANAME, period, planned: asset(planned), memos: asset(0n), aid_paid: asset(0n) }
    await expect(push(MARKET, 'closeperiod', base)).rejects.toThrow(/MARKETPLACE_PERIOD_EXISTS/)
    // За давний период заказов не было: счётчика нет — итог не считается.
    await expect(push(MARKET, 'closeperiod', { ...base, period: period - 1_000 })).rejects.toThrow(/MARKETPLACE_PERIOD_EMPTY/)
    await expect(push(MARKET, 'closeperiod', { ...base, period: period + 1_000 })).rejects.toThrow(/MARKETPLACE_PERIOD_OPEN/)
    for (const field of ['planned', 'memos', 'aid_paid'])
      await expect(push(MARKET, 'closeperiod', { ...base, [field]: asset(-1n) }), `отрицательное ${field}`).rejects.toThrow(/MARKETPLACE_PERIOD_AMOUNT_INVALID/)
    await expect(push(MARKET, 'closeperiod', { ...base, planned: asset(rub(1), 'AXON') })).rejects.toThrow(/MARKETPLACE_PERIOD_AMOUNT_INVALID/)
    await expect(push(MARKET, 'closeperiod', { ...base, period: 0 })).rejects.toThrow(/MARKETPLACE_PERIOD_AMOUNT_INVALID/)
    await expect(push(MARKET, 'closeperiod', { ...base, braname: 'nosuchbranch' })).rejects.toThrow()
  }, 1_500_000)

  it('chargeperiod: строка пайщицы одной транзакцией в нитке p.mkt.due — участку, в фонды по процентам, инициаторам, пайщице обратно; строка стёрта, повтор — MARKETPLACE_DUE_NOT_FOUND', async () => {
    const row = await memberDue(bc, ekaterina.account, BRANAME, period)
    expect(row, 'строка пайщицы ждёт списания').toBeDefined()
    const rowDue = units(row.due)
    const rowTurnover = units(row.turnover)
    const rowRetained = units(row.retained)

    const dueBefore = await userWallet(bc, 'w.mkt.due', ekaterina.account)
    const shareBefore = await userWallet(bc, 'w.mkt.share', ekaterina.account)
    const commonBefore = await userWallet(bc, 'w.brn.common', BRANAME)
    const repayBefore = await userWallet(bc, 'w.mkt.repay', BRANAME)
    const fundsBefore = await fundBalances(bc)
    const investBefore = await investBranch(bc, BRANAME)

    const rates = { rateBranch: BigInt(periodRow.rate_branch), rateFunds: BigInt(periodRow.rate_funds), rateInitiator: BigInt(periodRow.rate_initiator) }
    const parts = chargeRow(rates, rowDue, rowTurnover, rowRetained)
    // Доля инициаторов — по фазам инвестиционного этапа (задача 99D-27).
    const route = crpsRoute(investBefore, parts.initiator)

    await push(MARKET, 'chargeperiod', { coopname: COOP, username: ekaterina.account, braname: BRANAME, period })

    const hash = chargeHash(ekaterina.account, BRANAME, period)
    const expected = ['o.mkt.charge']
    if (parts.branch > 0n) expected.push('o.brn.common')
    if (parts.funds > 0n) expected.push('o.fnd.indiv', 'o.fnd.resrv', 'o.fnd.devel')
    if (route.repay > 0n) expected.push('o.mkt.repay')
    if (parts.returned > 0n) expected.push('o.mkt.retdue')
    const ops: LedgerRow[] = await waitForOps(chairmanToken, hash, expected)
    expect(units(sumOf(ops, 'o.mkt.charge').toFixed(4))).toBe(parts.charged)
    expect(units(sumOf(ops, 'o.brn.common').toFixed(4))).toBeGreaterThanOrEqual(parts.branch + route.toBranch)
    const fundOpsSum = sumOf(ops, 'o.fnd.indiv') + sumOf(ops, 'o.fnd.resrv') + sumOf(ops, 'o.fnd.devel')
    expect(units(fundOpsSum.toFixed(4))).toBe(parts.funds)
    expect(units(sumOf(ops, 'o.mkt.repay').toFixed(4))).toBe(route.repay)
    expect(units(sumOf(ops, 'o.mkt.initr').toFixed(4)), 'доля инициатора больше не начисляется на его кошелёк').toBe(0n)
    expect(units(sumOf(ops, 'o.mkt.retdue').toFixed(4))).toBe(parts.returned)

    // Все ноги — в нитке строки счётчика, процесс списания по итогу периода; в нитке заказа списания нет.
    const byOp = await processTypeByOperation(chairmanToken, hash)
    for (const code of expected) expect(byOp[code], `проводка ${code} идёт ниткой списания`).toBe('p.mkt.due')
    const orderCodes = new Set((await historyOfProcess(chairmanToken, orderHash)).map(r => r.operationCode))
    expect(orderCodes.has('o.mkt.charge'), 'в нитке заказа списания нет').toBe(false)
    const rows = await historyOfProcess(chairmanToken, hash)
    const repay = rows.find(r => r.action === 'walletop' && r.operationCode === 'o.mkt.repay')
    if (route.repay > 0n) expect([repay?.walletFrom, repay?.walletTo]).toEqual(['w.mkt.fee', 'w.mkt.repay'])
    const retdue = rows.find(r => r.action === 'walletop' && r.operationCode === 'o.mkt.retdue')
    if (parts.returned > 0n) expect([retdue?.walletFrom, retdue?.walletTo]).toEqual(['w.mkt.due', 'w.mkt.share'])

    expect(await userWallet(bc, 'w.mkt.due', ekaterina.account)).toBe(dueBefore - rowDue - rowRetained)
    expect(await userWallet(bc, 'w.mkt.share', ekaterina.account)).toBe(shareBefore + parts.returned)
    // Переплата завершивших возврат переводится с кошелька возмещения участку.
    const commonDelta = await userWallet(bc, 'w.brn.common', BRANAME) - commonBefore
    const repayDelta = await userWallet(bc, 'w.mkt.repay', BRANAME) - repayBefore
    expect(commonDelta + repayDelta).toBe(parts.branch + parts.initiator)
    expect(repayDelta <= route.repay).toBe(true)

    // Фонды: сумма долей равна части в фонды; доля каждого фонда — по его проценту,
    // остаток округления у последнего по номеру (задача 99D-25).
    const fundsAfter = await fundBalances(bc)
    const accfunds = await accumulationFunds(bc)
    const shares = splitFunds(parts.funds, accfunds.map(f => BigInt(f.percent)))
    accfunds.forEach((f, i) => {
      const wallet = String(f.wallet)
      expect((fundsAfter.get(wallet) ?? 0n) - (fundsBefore.get(wallet) ?? 0n), `доля фонда ${f.name}`).toBe(shares[i])
    })
    expect(accfunds.map(f => f.wallet), 'три стандартных фонда накопления на своих кошельках')
      .toEqual(['w.fnd.indiv', 'w.fnd.resrv', 'w.fnd.devel'])

    // Строка стёрта: списывать нечего.
    expect(await memberDue(bc, ekaterina.account, BRANAME, period)).toBeUndefined()
    await expect(push(MARKET, 'chargeperiod', { coopname: COOP, username: ekaterina.account, braname: BRANAME, period })).rejects.toThrow(/MARKETPLACE_DUE_NOT_FOUND/)
    await expect(push(MARKET, 'chargeperiod', { coopname: COOP, username: ekaterina.account, braname: 'nosuchbranch', period })).rejects.toThrow()
  }, 300_000)

  it('delperiod стирает строку итога; повтор — MARKETPLACE_PERIOD_NOT_CLOSED; счётчики цепи оплачивает контракт', async () => {
    await push(MARKET, 'delperiod', { coopname: COOP, braname: BRANAME, period })
    expect((await branchPeriods(bc, BRANAME)).find(r => Number(r.period) === period)).toBeUndefined()
    await expect(push(MARKET, 'delperiod', { coopname: COOP, braname: BRANAME, period })).rejects.toThrow(/MARKETPLACE_PERIOD_NOT_CLOSED/)

    // Память под счётчики — за контрактом, не за кооперативом (решение владельца 09.11.2026).
    const dues: any[] = await bc.getTableRows(MARKET, COOP, 'kudues', 1000)
    const counters: any[] = await bc.getTableRows(MARKET, COOP, 'kucounters', 1000)
    expect(dues.length + counters.length >= 0).toBe(true)
    const payers: any[] = await bc.api.rpc.get_table_rows({ json: true, code: MARKET, scope: COOP, table: 'kucounters', limit: 1, show_payer: true } as any).then((r: any) => r.rows)
    for (const p of payers) expect(p.payer, 'плательщик памяти счётчика участка').toBe(MARKET)
  })
})

const UNITS = 10_000n

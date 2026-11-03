/**
 * Контрактный уровень: итог месяца участка и списание обеспечительной части по
 * ставкам прогона (задачи 99D-19, 99D-21; КЭУ-1, КЭУ-3; реестр
 * marketplace.order, случаи mkt.order.keu.*).
 *
 * Тест ведёт один заказ до закрытия выдачи тем же путём, что и денежный тест
 * (`marketplace-money.test.ts`), получает на кошельке пайщицы к списанию факт
 * обеспечительной части, а затем проходит новый цикл первого числа:
 *
 *   • setshares / setinitiator — настройки доли инициатора и инициатора участка;
 *   • closeperiod — пять фактов прогона → строка kuperiods, формулы которой
 *     проверяются по её собственным полям (резерв прошлого прогона на стенде
 *     зависит от прежних прогонов, поэтому ожидания не зашиты числами);
 *   • chargeperiod — четыре части одного заказа одной транзакцией: участку
 *     (o.brn.common), в фонды накопления по их процентам (o.fnd.accrue × число
 *     фондов), инициатору (o.mkt.initr), пайщице обратно (o.mkt.retdue);
 *     кошелёк к списанию обнуляется, остатки кошельков растут ровно на части;
 *   • повтор chargeperiod — MARKETPLACE_DUE_EXCEEDS; delperiod стирает строку,
 *     после чего chargeperiod отвечает MARKETPLACE_PERIOD_NOT_CLOSED.
 *
 * Номер периода берётся из времени прогона, чтобы строки разных прогонов не
 * сталкивались; свою строку тест стирает сам. Потолок резерва после теста
 * возвращается в ноль, назначение инициатора снимается.
 *
 * Требует стенда после `reboot:extra` с сид-фазами docs-harness.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BranchContract, FundContract, MarketContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { issueOrder, pickOffer, placeOrder } from './marketplace/orderFlow'
import { CHAIRMAN, COOP, type LedgerRow, amount, ensureShareFunds, fromState, gqlAs, historyOfProcess, loginAs, signAs, sumOf, waitForOps } from './marketplace/chainHelpers'

const bc = new Blockchain(config.network, config.private_keys)

const BRANAME = 'krg'
const ORDER_QTY = 2
const H = 1_000_000n
const UNITS = 10_000n // четыре знака актива

const sidorov = fromState('sidorov')
const ekaterina = fromState('ekaterina')
const chairkrg = fromState('chairkrg')

const MARKET = MarketContract.contractName.production
const BRANCH = BranchContract.contractName.production
const FUND = FundContract.contractName.production
const LEDGER2 = 'ledger2'

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
let period = 0
let periodRow: any = null

async function push(account: string, name: string, data: Record<string, unknown>) {
  return bc.api.transact(
    { actions: [{ account, name, authorization: [{ actor: COOP, permission: 'active' }], data }] },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}

function units(asset: unknown): bigint {
  const [whole, frac = ''] = String(asset ?? '0').split(' ')[0].split('.')
  return BigInt(whole) * UNITS + BigInt((frac + '0000').slice(0, 4))
}

function asset(u: bigint): string {
  const sign = u < 0n ? '-' : ''
  const a = u < 0n ? -u : u
  return `${sign}${a / UNITS}.${String(a % UNITS).padStart(4, '0')} RUB`
}

async function userWallet(wallet: string, username: string): Promise<bigint> {
  const rows: any[] = await bc.getTableRows(LEDGER2, COOP, 'userwallets', 2000)
  const row = rows.find(r => r.wallet_name === wallet && r.username === username)
  return units(row?.available)
}

async function fundBalances(): Promise<Map<string, bigint>> {
  const rows: any[] = await bc.getTableRows(LEDGER2, COOP, 'userwallets', 2000)
  return new Map(rows.filter(r => r.wallet_name === 'w.fnd.accum').map(r => [r.username, units(r.available)]))
}

async function periodRows(): Promise<any[]> {
  const rows: any[] = await bc.getTableRows(MARKET, COOP, 'kuperiods', 200)
  return rows.filter(r => r.braname === BRANAME)
}

describe('стол заказов — итог месяца участка и списание по ставкам (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    chairmanToken = await loginAs(CHAIRMAN)
    sidorovToken = await loginAs(sidorov)
    ekaterinaToken = await loginAs(ekaterina)
    chairkrgToken = await loginAs(chairkrg)

    const offer = await pickOffer(chairmanToken, sidorov.account, BRANAME, 'Мёд цветочный')
    unitPrice = amount(offer.price_per_unit)
    await ensureShareFunds(ekaterina.account, ORDER_QTY * unitPrice * 2, ekaterinaToken)

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

    // Резерв обеспечения председателю — слагаемое расходов прогона.
    await push(BRANCH, 'setaidlimit', { coopname: COOP, limit: '1000.0000 RUB' })
    await push(BRANCH, 'setreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account, amount: '300.0000 RUB' })

    period = 900_000 + Math.floor(Date.now() / 1000) % 100_000
  }, 600_000)

  afterAll(async () => {
    await push(MARKET, 'delperiod', { coopname: COOP, braname: BRANAME, period }).catch(() => {})
    await push(MARKET, 'setinitiator', { coopname: COOP, braname: BRANAME, username: '' }).catch(() => {})
    await push(BRANCH, 'delreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account }).catch(() => {})
    await push(BRANCH, 'setaidlimit', { coopname: COOP, limit: '0.0000 RUB' }).catch(() => {})
  })

  it('setshares: доля инициатора записывается; выше 100 % — отказ', async () => {
    await push(MARKET, 'setshares', { coopname: COOP, initiator_share_percent: 618_000 })
    const cfg: any[] = await bc.getTableRows(MARKET, COOP, 'config', 1)
    expect(Number(cfg[0]?.initiator_share_percent)).toBe(618_000)
    await expect(push(MARKET, 'setshares', { coopname: COOP, initiator_share_percent: 1_000_001 })).rejects.toThrow(/MARKETPLACE_INITIATOR_SHARE_INVALID/)
  })

  it('setinitiator: инициатор участка назначается отдельно от председателя; посторонний не пайщик — отказ', async () => {
    await push(MARKET, 'setinitiator', { coopname: COOP, braname: BRANAME, username: chairkrg.account })
    const rows: any[] = await bc.getTableRows(MARKET, COOP, 'initiators', 100)
    expect(rows.find(r => r.braname === BRANAME)?.username).toBe(chairkrg.account)
    await expect(push(MARKET, 'setinitiator', { coopname: COOP, braname: BRANAME, username: 'nobodyhere12' })).rejects.toThrow()
  })

  it('closeperiod: строка прогона сходится по формулам документа; повтор — MARKETPLACE_PERIOD_EXISTS', async () => {
    const planned = 200n * UNITS
    await push(MARKET, 'closeperiod', {
      coopname: COOP, braname: BRANAME, period,
      turnover: asset(baseUnits), secured: asset(dueUnits),
      planned: asset(planned), memos: '0.0000 RUB', aid_paid: '0.0000 RUB',
    })
    periodRow = (await periodRows()).find(r => Number(r.period) === period)
    expect(periodRow, 'строка прогона записана').toBeDefined()

    const accfunds: any[] = await bc.getTableRows(FUND, COOP, 'accfunds', 100)
    const p = accfunds.reduce((s, f) => s + BigInt(f.percent), 0n)
    expect(p > 0n && p < H, 'у кооператива есть фонды накопления с процентами').toBe(true)

    const reserve = units(periodRow.aid_reserve)
    const unpaid = units(periodRow.aid_unpaid)
    const expensesExpected = planned + reserve - unpaid > 0n ? planned + reserve - unpaid : 0n
    expect(units(periodRow.expenses)).toBe(expensesExpected)
    expect(reserve).toBe(300n * UNITS)

    const cap = units(periodRow.expenses) * H / (H - p)
    const membership = cap < dueUnits ? cap : dueUnits
    const funds = membership * p / H
    const branch = membership - funds
    const economy = dueUnits - membership
    const initiator = economy * 618_000n / H
    expect(units(periodRow.membership)).toBe(membership)
    expect(units(periodRow.funds_amount)).toBe(funds)
    expect(units(periodRow.branch_amount)).toBe(branch)
    expect(units(periodRow.initiator_amount)).toBe(initiator)
    expect(units(periodRow.return_amount)).toBe(economy - initiator)
    expect(units(periodRow.deficit)).toBe(units(periodRow.expenses) > branch ? units(periodRow.expenses) - branch : 0n)
    expect(BigInt(periodRow.rate_branch)).toBe(branch * H / baseUnits)
    expect(BigInt(periodRow.rate_funds)).toBe(funds * H / baseUnits)
    expect(BigInt(periodRow.rate_initiator)).toBe(initiator * H / baseUnits)
    expect(periodRow.initiator).toBe(chairkrg.account)

    await expect(push(MARKET, 'closeperiod', {
      coopname: COOP, braname: BRANAME, period,
      turnover: asset(baseUnits), secured: asset(dueUnits), planned: asset(planned), memos: '0.0000 RUB', aid_paid: '0.0000 RUB',
    })).rejects.toThrow(/MARKETPLACE_PERIOD_EXISTS/)
    await expect(push(MARKET, 'closeperiod', {
      coopname: COOP, braname: BRANAME, period: period + 1,
      turnover: '0.0000 RUB', secured: asset(dueUnits), planned: asset(planned), memos: '0.0000 RUB', aid_paid: '0.0000 RUB',
    })).rejects.toThrow(/MARKETPLACE_PERIOD_AMOUNT_INVALID/)
  })

  it('chargeperiod: четыре части одного заказа — участку, в фонды по процентам, инициатору, пайщице обратно', async () => {
    const dueBefore = await userWallet('w.mkt.due', ekaterina.account)
    const shareBefore = await userWallet('w.mkt.share', ekaterina.account)
    const commonBefore = await userWallet('w.brn.common', BRANAME)
    const investBefore = await userWallet('w.mkt.invest', chairkrg.account)
    const fundsBefore = await fundBalances()

    await push(MARKET, 'chargeperiod', {
      coopname: COOP, username: ekaterina.account, braname: BRANAME, order_hash: orderHash,
      amount: asset(dueUnits), base: asset(baseUnits), period,
    })

    const toBranch = baseUnits * BigInt(periodRow.rate_branch) / H
    const toFunds = baseUnits * BigInt(periodRow.rate_funds) / H
    const toInitiator = baseUnits * BigInt(periodRow.rate_initiator) / H
    const toReturn = dueUnits - toBranch - toFunds - toInitiator
    expect(toReturn >= 0n, 'ставка заказа совпадает со ставкой прогона — возврат не отрицателен').toBe(true)

    const expected = ['o.mkt.charge']
    if (toBranch > 0n) expected.push('o.brn.common')
    if (toFunds > 0n) expected.push('o.fnd.accrue')
    if (toInitiator > 0n) expected.push('o.mkt.initr')
    if (toReturn > 0n) expected.push('o.mkt.retdue')
    const ops: LedgerRow[] = await waitForOps(chairmanToken, orderHash, expected)
    expect(units(sumOf(ops, 'o.mkt.charge').toFixed(4))).toBe(toBranch + toFunds + toInitiator)
    expect(units(sumOf(ops, 'o.brn.common').toFixed(4)) - units(sumOf(ops, 'o.brn.retfee').toFixed(4))).toBeGreaterThanOrEqual(toBranch)
    expect(units(sumOf(ops, 'o.fnd.accrue').toFixed(4))).toBe(toFunds)
    expect(units(sumOf(ops, 'o.mkt.initr').toFixed(4))).toBe(toInitiator)
    expect(units(sumOf(ops, 'o.mkt.retdue').toFixed(4))).toBe(toReturn)

    // Все ноги — в нитке заказа и процессе поставки.
    const rows = await historyOfProcess(chairmanToken, orderHash)
    const initr = rows.find(r => r.action === 'walletop' && r.operationCode === 'o.mkt.initr')
    if (toInitiator > 0n) expect([initr?.walletFrom, initr?.walletTo]).toEqual(['w.mkt.fee', 'w.mkt.invest'])
    const retdue = rows.find(r => r.action === 'walletop' && r.operationCode === 'o.mkt.retdue')
    if (toReturn > 0n) expect([retdue?.walletFrom, retdue?.walletTo]).toEqual(['w.mkt.due', 'w.mkt.share'])

    expect(await userWallet('w.mkt.due', ekaterina.account)).toBe(dueBefore - dueUnits)
    expect(await userWallet('w.mkt.share', ekaterina.account)).toBe(shareBefore + toReturn)
    expect(await userWallet('w.brn.common', BRANAME)).toBe(commonBefore + toBranch)
    expect(await userWallet('w.mkt.invest', chairkrg.account)).toBe(investBefore + toInitiator)

    // Фонды: сумма долей равна части в фонды; доля каждого фонда — по его проценту,
    // остаток округления у последнего по идентификатору.
    const fundsAfter = await fundBalances()
    const accfunds: any[] = await bc.getTableRows(FUND, COOP, 'accfunds', 100)
    const p = accfunds.reduce((s, f) => s + BigInt(f.percent), 0n)
    let total = 0n
    accfunds.sort((a, b) => Number(a.id) - Number(b.id))
    accfunds.forEach((f, i) => {
      const wallet = f.wallet_name && f.wallet_name !== '' ? f.wallet_name : null
      expect(wallet, 'после отчисления у каждого фонда закреплено имя разреза').toBeTruthy()
      const delta = (fundsAfter.get(wallet) ?? 0n) - (fundsBefore.get(wallet) ?? 0n)
      const share = i === accfunds.length - 1 ? toFunds - total : toFunds * BigInt(f.percent) / p
      total += share
      expect(delta, `доля фонда ${f.name}`).toBe(share)
    })
    const standard = accfunds.filter(f => ['indivisible', 'reserve', 'develop'].includes(f.wallet_name))
    expect(standard.length, 'три стандартных фонда носят постоянные имена разрезов').toBe(3)
  }, 180_000)

  it('повтор списания — MARKETPLACE_DUE_EXCEEDS; delperiod стирает строку; списание без строки — MARKETPLACE_PERIOD_NOT_CLOSED', async () => {
    await expect(push(MARKET, 'chargeperiod', {
      coopname: COOP, username: ekaterina.account, braname: BRANAME, order_hash: orderHash,
      amount: asset(dueUnits), base: asset(baseUnits), period,
    })).rejects.toThrow(/MARKETPLACE_DUE_EXCEEDS/)

    await push(MARKET, 'delperiod', { coopname: COOP, braname: BRANAME, period })
    expect((await periodRows()).find(r => Number(r.period) === period)).toBeUndefined()
    await expect(push(MARKET, 'delperiod', { coopname: COOP, braname: BRANAME, period })).rejects.toThrow(/MARKETPLACE_PERIOD_NOT_CLOSED/)
    await expect(push(MARKET, 'chargeperiod', {
      coopname: COOP, username: ekaterina.account, braname: BRANAME, order_hash: orderHash,
      amount: '1.0000 RUB', base: asset(baseUnits), period,
    })).rejects.toThrow(/MARKETPLACE_PERIOD_NOT_CLOSED/)
  })
})

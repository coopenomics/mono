/**
 * Контрактный уровень, живая цепь: отказ пайщика после приёмки и цена при
 * выдаче (задача 99D-14; реестр marketplace.supply — mkt.supply.side.33,
 * marketplace.issuance — mkt.iss.side.50 и mkt.iss.side.51).
 *
 *   • side.33 — пайщица отказывается от принятого кооперативом имущества, пока
 *     выплата поставщику ждёт кассира: удержание проходит, заказ остаётся на
 *     цепи в статусе refused, подтверждение выплаты проводит Дт 76 / Кт 51 на
 *     принятую стоимость и стирает заказ; имущество остаётся на счёте 10.
 *   • side.51 — заказ поставщика выдан дешевле цены приёмки: разница уходит
 *     уценкой Дт 91 / Кт 10, счёт 10 по нитке заказа закрывается в ноль,
 *     повторная уценка отклоняется.
 *   • side.50 — поднять цену при выдаче нельзя: бэкенд не фиксирует факт выше
 *     цены прибытия, контракт отклоняет прямое заявление с суммой выдачи выше
 *     принятой стоимости.
 *
 * Суммы берутся из самого заказа и предложения, а не захардкожены. Каждый
 * сценарий ведёт свежий заказ, поэтому тест повторяем. Требует стенда после
 * `reboot:extra` с сид-фазами docs-harness и контракта marketplace с полем
 * `accepted_cost`.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { GatewayContract, MarketContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { acceptToCoop, issueOrder, pickOffer, placeOrder } from './marketplace/orderFlow'
import {
  ACC,
  CHAIN_URL,
  CHAIRMAN,
  COOP,
  type LedgerRow,
  amount,
  ensureShareFunds,
  fromState,
  gqlAs,
  historyOfProcess,
  loginAs,
  signAs,
  sumOf,
  waitForOps,
} from './marketplace/chainHelpers'

const bc = new Blockchain(config.network, config.private_keys)

const BRANAME = 'krg'
const QTY = 4
const TX = { blocksBehind: 3, expireSeconds: 30 }

const sidorov = fromState('sidorov')
const ekaterina = fromState('ekaterina')
const chairkrg = fromState('chairkrg')

let chairmanToken = ''
let sidorovToken = ''
let ekaterinaToken = ''
let chairkrgToken = ''

let offerId = ''
let unitPrice = 0

/** Строка заказа в таблице `marketplace::orders` по хэшу; стёртая запись — null. */
async function chainOrder(orderHash: string): Promise<any | null> {
  const want = orderHash.toLowerCase()
  let lowerBound = ''
  for (;;) {
    const res = await fetch(`${CHAIN_URL}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: true,
        code: MarketContract.contractName.production,
        scope: COOP,
        table: 'orders',
        limit: 500,
        lower_bound: lowerBound,
      }),
    })
    const d: any = await res.json()
    const row = (d.rows ?? []).find((r: any) => String(r.hash).toLowerCase() === want)
    if (row)
      return row
    if (!d.more || !d.next_key)
      return null
    lowerBound = String(d.next_key)
  }
}

/** Дождаться состояния заказа на цепи: дельты и обратные вызовы идут через пару блоков. */
async function waitForChainOrder(
  orderHash: string,
  ready: (row: any | null) => boolean,
  what: string,
  timeoutMs = 180_000,
): Promise<any | null> {
  const deadline = Date.now() + timeoutMs
  let last: any
  while (Date.now() < deadline) {
    last = await chainOrder(orderHash)
    if (ready(last))
      return last
    await new Promise(r => setTimeout(r, 1_500))
  }
  throw new Error(`заказ ${orderHash} на цепи не дошёл до состояния «${what}»: ${JSON.stringify(last)}`)
}

/** Кредитовое сальдо счёта по строкам нитки: кредит минус дебет. */
function creditNet(rows: LedgerRow[], accountId: number): number {
  return rows
    .filter(r => r.accountId === accountId)
    .reduce((s, r) => s + (r.action === 'credit' ? amount(r.quantity) : r.action === 'debit' ? -amount(r.quantity) : 0), 0)
}

/** Действие от имени кооператива напрямую в цепь — в обход бэкенда. */
function actAsCoop(account: string, name: string, data: Record<string, unknown>) {
  return bc.api.transact({
    actions: [{ account, name, authorization: [{ actor: COOP, permission: 'active' }], data }],
  }, TX)
}

/** Подписанный документ в форме `document2` цепи — так его отдаёт бэкенд (`toDocument`). */
function toChainDocument(signed: any) {
  return {
    version: signed.version,
    hash: signed.hash,
    doc_hash: signed.doc_hash,
    meta_hash: signed.meta_hash,
    meta: typeof signed.meta === 'string' ? signed.meta : JSON.stringify(signed.meta),
    signatures: signed.signatures,
  }
}

/** Свежий заказ пайщицы, принятый кооперативом целиком по цене предложения. */
async function acceptedOrder(): Promise<{ orderId: string, orderHash: string, acceptedCost: number }> {
  await ensureShareFunds(ekaterina.account, QTY * unitPrice * 2)
  const { orderId, orderHash } = await placeOrder({
    token: ekaterinaToken,
    who: ekaterina,
    offerId,
    quantity: QTY,
    braname: BRANAME,
  })
  await acceptToCoop({
    supplierToken: sidorovToken,
    supplier: sidorov,
    operatorToken: chairkrgToken,
    operator: chairkrg,
    orderId,
    braname: BRANAME,
    factQuantity: QTY,
    factUnitPrice: unitPrice,
  })
  await waitForOps(chairmanToken, orderHash, ['o.mkt.purch'])
  return { orderId, orderHash, acceptedCost: QTY * unitPrice }
}

describe('стол заказов — отказ после приёмки и цена при выдаче (contract, живая цепь)', () => {
  beforeAll(async () => {
    chairmanToken = await loginAs(CHAIRMAN)
    sidorovToken = await loginAs(sidorov)
    ekaterinaToken = await loginAs(ekaterina)
    chairkrgToken = await loginAs(chairkrg)

    const offer = await pickOffer(chairmanToken, sidorov.account, BRANAME, 'Мёд цветочный')
    offerId = offer.id
    unitPrice = amount(offer.price_per_unit)
  }, 180_000)

  it('mkt.supply.side.33: отказ после приёмки при ожидающей выплате — заказ ждёт кассира, выплата идёт на принятую стоимость и закрывает заказ', async () => {
    const { orderId, orderHash, acceptedCost } = await acceptedOrder()

    // Выплату поставщику бэкенд инициирует сам сразу после закрывающей подписи приёмки.
    const pending = await waitForChainOrder(orderHash, r => r?.payout_status === 'pending', 'выплата ждёт кассира')
    expect(amount(pending.accepted_cost), 'принятая стоимость фиксируется на приёмке').toBeCloseTo(acceptedCost, 2)
    const withheld = amount(pending.payout_withheld)

    await gqlAs(ekaterinaToken, 'mutation($i:MarketplaceCancelOrderInput!){ marketplaceCancelOrder(input:$i){ tx_hash } }', {
      i: { order_id: orderId },
    })

    const refused = await waitForChainOrder(orderHash, r => r?.status === 'refused', 'отказ ждёт расчёта с поставщиком')
    expect(refused.payout_status, 'отказ пайщицы не трогает выплату поставщику').toBe('pending')

    let ops = await waitForOps(chairmanToken, orderHash, ['o.mkt.penal', 'o.mkt.unlock'])
    expect(
      sumOf(ops, 'o.mkt.penal') + sumOf(ops, 'o.mkt.unlock'),
      'резерв заказа делится на удержание и возврат без остатка',
    ).toBeCloseTo(amount(refused.total_cost), 2)

    await expect(
      actAsCoop(MarketContract.contractName.production, MarketContract.Actions.CancelOrder.actionName, {
        coopname: COOP,
        orderer: ekaterina.account,
        order_hash: orderHash,
      }),
      'повторный отказ цепь обязана отклонить',
    ).rejects.toThrow(/Отказ по заказу уже зафиксирован/)

    // Кассир подтверждает банковский перевод поставщику.
    await actAsCoop(GatewayContract.contractName.production, GatewayContract.Actions.CompleteOutcome.actionName, {
      coopname: COOP,
      outcome_hash: orderHash,
    })

    ops = await waitForOps(chairmanToken, orderHash, ['o.mkt.payout'])
    expect(
      sumOf(ops, 'o.mkt.payout'),
      'выплата — принятая стоимость за вычетом удержанного долга, ровно сумма банковского перевода',
    ).toBeCloseTo(acceptedCost - withheld, 2)

    await waitForChainOrder(orderHash, r => r === null, 'запись стёрта после расчёта с поставщиком')

    const rows = await historyOfProcess(chairmanToken, orderHash)
    expect(
      creditNet(rows, ACC.SETTLEMENTS),
      'долг поставщику по заказу закрыт: на счёте 76 по нитке остаётся только удержанный долг',
    ).toBeCloseTo(withheld, 2)
    expect(
      -creditNet(rows, ACC.MATERIALS),
      'имущество осталось на складе участка по принятой стоимости',
    ).toBeCloseTo(acceptedCost, 2)
  }, 600_000)

  it('mkt.iss.side.51: заказ поставщика выдан дешевле цены приёмки — разница уходит уценкой Дт 91 / Кт 10, счёт 10 по заказу закрыт', async () => {
    const { orderId, orderHash, acceptedCost } = await acceptedOrder()
    const lowered = Math.floor(unitPrice * 90) / 100
    expect(lowered, 'для сценария нужна цена, которую есть куда снизить').toBeLessThan(unitPrice)

    await issueOrder({
      blockchain: bc,
      operatorToken: chairkrgToken,
      operator: chairkrg,
      memberToken: ekaterinaToken,
      member: ekaterina,
      orderId,
      braname: BRANAME,
      actualQuantity: QTY,
      actualUnitPrice: lowered,
    })

    const issuedCost = QTY * lowered
    const loss = acceptedCost - issuedCost
    const ops = await waitForOps(chairmanToken, orderHash, ['o.mkt.consum', 'o.mkt.loss'])
    expect(sumOf(ops, 'o.mkt.consum'), 'выдача списывает сумму выдачи').toBeCloseTo(issuedCost, 2)
    expect(sumOf(ops, 'o.mkt.loss'), 'уценка — стоимость прибытия выданного минус сумма выдачи').toBeCloseTo(loss, 2)

    const rows = await historyOfProcess(chairmanToken, orderHash)
    expect(
      rows.filter(r => r.action === 'debit' && r.accountId === ACC.OTHER && Math.abs(amount(r.quantity) - loss) < 0.005).length,
      'уценка обязана лечь Дт 91',
    ).toBeGreaterThan(0)
    expect(creditNet(rows, ACC.MATERIALS), 'со склада выбыло ровно то, что пришло: счёт 10 по заказу в нуле').toBeCloseTo(0, 2)

    const row = await waitForChainOrder(orderHash, r => r !== null && amount(r.markdown_cost) > 0, 'уценка записана в заказ')
    expect(amount(row.markdown_cost)).toBeCloseTo(loss, 2)

    await expect(
      actAsCoop(MarketContract.contractName.production, MarketContract.Actions.Markdown.actionName, {
        coopname: COOP,
        order_hash: orderHash,
        amount: `${(0.01).toFixed(4)} RUB`,
      }),
      'повторную уценку цепь обязана отклонить',
    ).rejects.toThrow(/уже списана/)
  }, 600_000)

  it('mkt.iss.side.50: поднять цену при выдаче нельзя — бэкенд не фиксирует факт, контракт отклоняет заявление с суммой выше принятой стоимости', async () => {
    const { orderId, orderHash, acceptedCost } = await acceptedOrder()
    const raised = unitPrice + 1
    const fixFact = (price: number) => gqlAs(chairkrgToken, `mutation($d:MarketplaceFixIssuanceFactInput!){
      marketplaceFixIssuanceFact(data:$d){ statement{ full_title html hash meta binary } }
    }`, { d: { order_id: orderId, actual_quantity: QTY, actual_unit_price: price.toFixed(4) } })

    // API-проба: интерфейс мог бы и не пустить завышенную цену, но сервер обязан отказать сам.
    await expect(fixFact(raised), 'бэкенд обязан отказать в цене выше цены прибытия').rejects.toThrow(/можно только снизить/)

    // Контракт — последний рубеж: заявление, подписанное пайщицей на допустимый
    // факт, отправляем в цепь напрямую с завышенной ценой.
    const fixed: any = await fixFact(unitPrice)
    const signed = await signAs(ekaterina.wif, fixed.marketplaceFixIssuanceFact.statement, ekaterina.account, 1)

    // Заявление принимается только у заказа, готового к выдаче: иначе цепь отказала
    // бы по статусу, и сценарий не дошёл бы до проверки цены.
    const before = await waitForChainOrder(orderHash, r => r !== null, 'заказ на цепи')
    if (before.status === 'acceptcoop') {
      await actAsCoop(MarketContract.contractName.production, MarketContract.Actions.ReadyIssue.actionName, {
        coopname: COOP,
        signer: chairkrg.account,
        order_hash: orderHash,
      })
    }
    await waitForChainOrder(orderHash, r => r?.status === 'readyrecv', 'готов к выдаче')

    await expect(
      actAsCoop(MarketContract.contractName.production, MarketContract.Actions.IssueStmt.actionName, {
        coopname: COOP,
        orderer: ekaterina.account,
        order_hash: orderHash,
        actual_quantity: before.quantity,
        actual_unit_price: `${raised.toFixed(4)} RUB`,
        statement: toChainDocument(signed),
        meta: '',
      }),
      'контракт обязан отклонить сумму выдачи выше принятой стоимости',
    ).rejects.toThrow(/сумма выдачи не может превышать стоимость/)

    const after = await chainOrder(orderHash)
    expect(after?.status, 'после отказа цепи заказ по-прежнему готов к выдаче').toBe('readyrecv')
    expect(amount(after?.accepted_cost), 'принятая стоимость не тронута').toBeCloseTo(acceptedCost, 2)
  }, 600_000)
})

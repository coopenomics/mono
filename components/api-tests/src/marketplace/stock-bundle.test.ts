/**
 * Бандл у стойки: две строки докладки и заказ с фактом дороже заказанного
 * (test-registry/marketplace.stock.yaml, mkt.stock.side.07).
 *
 * Пайщик у стойки получает свой заказ, который кооператив принял дороже, и
 * добирает два товара из остатка. Взносы и тело идут по строкам бандла по
 * порядку: сначала докладка, затем довзнос по заказу. Остатка членского
 * кошелька хватает только на первую строку докладки — недостающее по второй
 * строке и довзнос уходят одним заявлением 1110 на весь бандл. На подписи
 * суммы заявления сверяются по свежему балансу кошельков.
 *
 * Мир теста: остаток кооператива тест заводит сам недовыдачей двух заказов
 * (творог и томаты), остаток кошельков программы у получателя — отменённым
 * заказом; до этого кошельки обнуляет его собственный заказ на мёд.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ROLES, amount, availableShare, caseName, docMeta, ensureShareFunds, gql, gqlError, signDocument, tokenOf } from '../core'
import { KRG, acceptToCoop, ensureIdentityVerified, getOrder, issueOrder, labelInventory, pickOffer, placeOrder } from './flow'
import { CREATE_BUNDLE, FINALIZE, money, price2 } from './issuance.helpers'
import { cancelOrder, settledWallets } from './order.helpers'
import { PUBLISH_STOCK, STOCK_ISSUANCE_PAYLOADS, completeIssuance, listStock } from './stock.helpers'

const STOCK_PRODUCTS = ['Творог фермерский', 'Томаты сливовидные']
const ORDER_PRODUCT = 'Мёд цветочный'
const ARRIVAL_EXTRA = 100

const PAYLOADS = `query($d:MarketplaceResolveStockProposalInput!){
  marketplaceStockProposalSignablePayloads(data:$d){
    order_lines{ offer_id order_id order_hash statement{ full_title html hash meta binary } }
    convert{ amount membership_fee document{ full_title html hash meta binary } }
  }
}`

interface FundingLine { body: number, fee: number }

/** План сумм бандла — тем же порядком, что у узла: взнос с членского кошелька, тело с паевого программы, нехватка — заявлением. */
function planFunding(member: number, share: number, lines: FundingLine[]): { feeConvert: number, transfer: number, bodyWallet: number[] } {
  let feeConvert = 0
  const bodyWallet: number[] = []
  for (const line of lines) {
    const fromMember = Math.min(member, line.fee)
    member -= fromMember
    feeConvert += line.fee - fromMember
    const fromShare = Math.min(share, line.body)
    share -= fromShare
    bodyWallet.push(line.body - fromShare)
  }
  return { feeConvert, transfer: feeConvert + bodyWallet.reduce((a, b) => a + b, 0), bodyWallet }
}

describe('Стол заказов: бандл у стойки — две строки докладки и довзнос по факту', () => {
  const origin = ROLES.member()
  const buyer = ROLES.otherMember()
  const supplier = ROLES.supplier()
  const operator = ROLES.branchChairman()

  let operatorToken = ''
  let buyerToken = ''
  /** Предложения остатка кооператива: по килограмму творога и томатов. */
  const stock: { offerId: string, price: number }[] = []
  /** Ставка членского взноса — доля от стоимости, как её посчитал узел в заказе. */
  let feeRate = 0

  /** Недовыдача: заказано 2 кг, выдан 1 кг — килограмм остаётся кооперативу и публикуется по цене прибытия. */
  async function leftover(product: string): Promise<{ offerId: string, price: number }> {
    const offer = await pickOffer(supplier.account, KRG, product)
    const price = amount(offer.price_per_unit)
    const originToken = await tokenOf(origin)
    await ensureShareFunds(origin.account, price * 8, originToken)
    const placed = await placeOrder({ who: origin, offerId: offer.id, quantity: 2 })
    const order = await getOrder(originToken, placed.orderId)
    feeRate = (amount(order.total_cost_with_fee) - amount(order.total_cost)) / amount(order.total_cost)
    await acceptToCoop({ supplier, operator, orderId: placed.orderId, factQuantity: 2, factUnitPrice: price })
    await issueOrder({ operator, member: origin, orderId: placed.orderId, actualQuantity: 1, actualUnitPrice: price })
    const rows = (await listStock(operatorToken)).filter(r => r.order_id === placed.orderId)
    const pub = await gql<any>(operatorToken, PUBLISH_STOCK, { d: { inventory_ids: rows.map(r => r.id) } })
    const coop = pub.marketplacePublishStock[0]
    return { offerId: coop.id, price: amount(coop.price_per_unit) }
  }

  beforeAll(async () => {
    operatorToken = await tokenOf(operator)
    buyerToken = await tokenOf(buyer)
    for (const product of STOCK_PRODUCTS)
      stock.push(await leftover(product))
  }, 900_000)

  it(caseName('mkt.stock.side.07', 'членского кошелька хватает только на первую строку докладки — одно заявление 1110 на бандл: недостающий взнос второй строки и довзнос; суммы сверяются по свежему балансу'), async () => {
    expect(feeRate, 'ставка членского взноса известна').toBeGreaterThan(0)
    const honey = await pickOffer(supplier.account, KRG, ORDER_PRODUCT)
    const honeyPrice = amount(honey.price_per_unit)
    const [first, second] = stock.map(s => ({ body: s.price, fee: s.price * feeRate }))

    // Заказ пайщика забирает всё, что лежит в кошельках программы: дальше остаток известен точно.
    const residue = await settledWallets(buyerToken)
    const quantity = Math.max(1, Math.ceil(Math.max((residue['w.mkt.share'] ?? 0) / honeyPrice, (residue['w.mkt.member'] ?? 0) / (honeyPrice * feeRate)) + 0.01))
    expect(quantity, 'остаток кошельков программы получателя покрывается разумным заказом').toBeLessThanOrEqual(30)
    await ensureShareFunds(buyer.account, (quantity + 4) * (honeyPrice + ARRIVAL_EXTRA) * 2, buyerToken)
    const placed = await placeOrder({ who: buyer, offerId: honey.id, quantity })
    const drained = await settledWallets(buyerToken)
    expect(drained['w.mkt.member'] ?? 0, 'членский кошелёк ушёл в заказ').toBeCloseTo(0, 2)
    expect(drained['w.mkt.share'] ?? 0, 'паевой кошелёк программы ушёл в заказ').toBeCloseTo(0, 2)

    // Отменённый заказ оставляет в кошельках программы остаток: взноса — на первую строку и половину второй.
    const leave = async (share: number) => {
      const cancelled = await placeOrder({ who: buyer, offerId: honey.id, quantity: Math.round(share / honeyPrice * 1000) / 1000 })
      await cancelOrder(buyerToken, cancelled.orderId)
      return settledWallets(buyerToken)
    }
    await leave(first.body + second.body / 2)

    // Кооператив принял заказ дороже заказанного — у стойки будет довзнос.
    const arrival = price2(honeyPrice + ARRIVAL_EXTRA)
    await acceptToCoop({ supplier, operator, orderId: placed.orderId, factQuantity: quantity, factUnitPrice: arrival })
    await labelInventory(operatorToken, placed.orderId)
    await ensureIdentityVerified(buyer.account)

    const order = await getOrder(buyerToken, placed.orderId)
    const orderCost = amount(order.total_cost)
    const orderFee = amount(order.total_cost_with_fee) - orderCost
    const topup = { body: arrival * quantity - orderCost, fee: orderFee * (arrival * quantity) / orderCost - orderFee }
    const lines = [first, second, topup]

    // Бандл: две строки докладки и существующий заказ с фактом.
    const prepared = (await gql<any>(operatorToken, STOCK_ISSUANCE_PAYLOADS, {
      d: { braname: KRG, member_account: buyer.account, items: stock.map(s => ({ offer_id: s.offerId, quantity: 1, package_id: null })) },
    })).marketplaceStockIssuancePayloads as any[]
    const proposalId = (await gql<any>(operatorToken, CREATE_BUNDLE, {
      d: {
        braname: KRG,
        member_account: buyer.account,
        items: prepared.map(l => ({ offer_id: l.offer_id, quantity: 1, order_hash: l.order_hash, package_id: l.package_id })),
        order_items: [{ order_id: placed.orderId, actual_quantity: quantity, actual_unit_price: money(arrival) }],
      },
    })).marketplaceCreateStockProposal.id as string

    const payloads = async () => (await gql<any>(buyerToken, PAYLOADS, { d: { proposal_id: proposalId } })).marketplaceStockProposalSignablePayloads
    const signedLines = async (p: any) => {
      const out: any[] = []
      for (const l of p.order_lines as any[])
        out.push({ order_hash: l.order_hash, signed_statement: await signDocument(buyer.wif, l.statement, buyer.account, 1) })
      return out
    }

    const wallets = await settledWallets(buyerToken)
    const member = wallets['w.mkt.member'] ?? 0
    expect(member, 'условие случая: членского кошелька хватает на первую строку').toBeGreaterThanOrEqual(first.fee - 0.005)
    expect(member, 'условие случая: на вторую строку целиком — уже нет').toBeLessThan(first.fee + second.fee - 0.005)

    const stale = await payloads()
    expect(stale.order_lines, 'к подписи — заявление по каждой строке бандла').toHaveLength(3)
    expect(stale.convert, 'заявление 1110 одно на весь бандл').not.toBeNull()
    const expected = planFunding(member, wallets['w.mkt.share'] ?? 0, lines)
    expect(Number(docMeta(stale.convert.document.meta).registry_id)).toBe(1110)
    expect(amount(stale.convert.membership_fee), 'членская часть: недостающее по второй строке и довзнос').toBeCloseTo(expected.feeConvert, 2)
    expect(amount(stale.convert.amount)).toBeCloseTo(expected.transfer, 2)
    expect(amount(stale.convert.membership_fee), 'взнос первой строки в заявление не входит').toBeLessThan(second.fee + topup.fee)

    // Между показом и подписью остаток кошельков изменился — прежнее заявление не принимается.
    const staleConvert = await signDocument(buyer.wif, stale.convert.document, buyer.account, 1)
    const staleLines = await signedLines(stale)
    const moved = await leave(first.body + second.body * 0.75)
    expect(moved['w.mkt.member'] ?? 0, 'остаток членского кошелька вырос').toBeGreaterThan(member + 0.005)
    const refused = await gqlError(buyerToken, FINALIZE, { d: { proposal_id: proposalId, order_lines: staleLines, signed_convert: staleConvert } })
    expect(['MARKETPLACE_CONVERT_AMOUNT_CHANGED', 'MARKETPLACE_CONVERT_FEE_CHANGED'], JSON.stringify(refused)).toContain(String(refused?.code))

    // Заявление по свежему балансу проходит: перевод, затем заказы из остатка и выдача.
    const fresh = await payloads()
    const now = planFunding(moved['w.mkt.member'] ?? 0, moved['w.mkt.share'] ?? 0, lines)
    expect(amount(fresh.convert.membership_fee)).toBeCloseTo(now.feeConvert, 2)
    expect(amount(fresh.convert.amount)).toBeCloseTo(now.transfer, 2)

    const mainBefore = await availableShare(buyer.account)
    const done = (await gql<any>(buyerToken, FINALIZE, {
      d: { proposal_id: proposalId, order_lines: await signedLines(fresh), signed_convert: await signDocument(buyer.wif, fresh.convert.document, buyer.account, 1) },
    })).marketplaceFinalizeStockIssuance
    expect(done.sagas, 'по каждой строке бандла идёт выдача').toHaveLength(3)
    for (const saga of done.sagas as any[]) {
      expect(['DECISION_PENDING', 'DECISION_AUTHORIZED']).toContain(saga.stage)
      expect(saga.last_error ?? null).toBeNull()
    }
    // На подписи со свободного паевого уходят недостающие взносы и тело докладки;
    // доплата тела по заказу с фактом идёт позже, вместе с его выдачей.
    const topupBody = now.bodyWallet[2]
    expect(mainBefore - await availableShare(buyer.account), 'на подписи ушли взносы и тело докладки').toBeCloseTo(now.transfer - topupBody, 2)
    // Довзнос по заказу с фактом переведён в членский кошелёк и ждёт выдачи заказа; взносы докладки уже ушли в её заказы.
    const after = await settledWallets(buyerToken)
    expect(after['w.mkt.member'] ?? 0, 'в членском кошельке остался только довзнос по заказу').toBeCloseTo(topup.fee, 2)

    // Выдачи доводятся до конца: стенд остаётся без висящих саг.
    for (const saga of done.sagas as any[])
      await completeIssuance({ operator, member: buyer, orderId: saga.order_id })
    const closed = await settledWallets(buyerToken)
    expect.soft(closed['w.mkt.member'] ?? 0, 'после выдачи членский кошелёк израсходован до конца').toBeCloseTo(0, 2)
    expect.soft(closed['w.mkt.share'] ?? 0, 'после выдачи паевой кошелёк программы израсходован до конца').toBeCloseTo(0, 2)
    expect.soft(mainBefore - await availableShare(buyer.account), 'после выдачи со свободного паевого ушла вся сумма заявления').toBeCloseTo(now.transfer, 2)
  }, 1_500_000)
})

/**
 * Выдача дороже заказа: довзнос по факту и заявление 1110
 * (test-registry/marketplace.issuance.yaml, mkt.iss.side.44).
 *
 * Заказ оплачен по цене предложения, а кооператив принял имущество дороже —
 * факт выдачи стоит больше заказа. Разницу и членский взнос с неё пайщик
 * довносит: из кошельков программы, а чего в них не хватает — переводом со
 * свободного паевого по заявлению 1110. Случай «факт не больше заказа —
 * заявления нет» проверяет набор выдачи (mkt.iss.happy.40).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { ROLES, amount, availableShare, caseName, docMeta, ensureShareFunds, gql, gqlError, signDocument, tokenOf } from '../core'
import { acceptToCoop, ensureIdentityVerified, getOrder, labelInventory, pickOffer, placeOrder, sagaOf } from './flow'
import { money, price2, signStatement } from './issuance.helpers'
import { settledWallets } from './order.helpers'

describe('выдача дороже заказа: довзнос по факту', () => {
  let member: Who
  let supplier: Who
  let operator: Who
  let memberToken = ''
  let operatorToken = ''
  let offer: { id: string, product_name: string, price_per_unit: string }

  beforeAll(async () => {
    member = ROLES.member()
    supplier = ROLES.supplier()
    operator = ROLES.branchChairman()
    memberToken = await tokenOf(member)
    operatorToken = await tokenOf(operator)
    offer = await pickOffer(supplier.account, undefined, 'Мёд цветочный')
  }, 300_000)

  it(caseName('mkt.iss.side.44', 'факт дороже заказа, кошельков программы не хватает — к подписи заявление 1110 на недостающее; без него подача отвергается, с ним проходит'), async () => {
    const orderPrice = amount(offer.price_per_unit)
    const placed = await placeOrder({ who: member, offerId: offer.id, quantity: 1 })

    // Цена прибытия выше цены заказа на всё, что лежит в кошельках программы,
    // и ещё на двести рублей: доплату тела ими заведомо не покрыть.
    const residue = await settledWallets(memberToken)
    const arrival = price2(orderPrice + (residue['w.mkt.share'] ?? 0) + 200)
    await ensureShareFunds(member.account, arrival * 2, memberToken)
    await acceptToCoop({ supplier, operator, orderId: placed.orderId, factQuantity: 1, factUnitPrice: arrival })
    await labelInventory(operatorToken, placed.orderId)
    await ensureIdentityVerified(member.account)

    // Факт фиксируется по одиночному заказу. Через бандл у стойки такая выдача
    // сейчас не подписывается (находка 57, 01.10.2026, отчёт C28-85): заявление
    // 1110 бандла принимается, а подача заявления о выдаче по заказу требует
    // второе заявление и получает пустое.
    // Оператор отмечает поступление: заказ готов к выдаче (бандл делает это сам).
    const ready = await gql<any>(operatorToken, 'mutation($d:MarketplaceReadyIssueInput!){ marketplaceReadyIssue(data:$d){ id status } }', { d: { order_id: placed.orderId } })
    expect(ready.marketplaceReadyIssue.status).toBe('READY_TO_RECEIVE')
    const fixed = (await gql<any>(operatorToken, `mutation($d:MarketplaceFixIssuanceFactInput!){
      marketplaceFixIssuanceFact(data:$d){ saga{ id stage } statement{ full_title html hash meta binary } }
    }`, { d: { order_id: placed.orderId, actual_quantity: 1, actual_unit_price: money(arrival) } })).marketplaceFixIssuanceFact
    expect(fixed.saga.stage).toBe('FACT_FIXED')

    const wallets = await settledWallets(memberToken)
    const convert = (await gql<any>(memberToken, `query($d:MarketplaceIssuanceOrderInput!){
      marketplaceIssuanceConvertPayload(data:$d){ full_title html hash meta binary }
    }`, { d: { order_id: placed.orderId } })).marketplaceIssuanceConvertPayload
    expect(convert, 'заявление о переводе паевого взноса пришло к подписи').not.toBeNull()

    // Довзнос — по пропорции контракта: взнос факта относится к взносу заказа,
    // как стоимость факта к стоимости заказа.
    const order = await getOrder(memberToken, placed.orderId)
    const orderCost = amount(order.total_cost)
    const orderFee = amount(order.total_cost_with_fee) - orderCost
    const extraBody = arrival - orderCost
    const extraFee = orderFee * arrival / orderCost - orderFee
    const feeShortfall = Math.max(0, extraFee - (wallets['w.mkt.member'] ?? 0))
    const bodyShortfall = Math.max(0, extraBody - (wallets['w.mkt.share'] ?? 0))
    expect(bodyShortfall, 'условие случая: тела доплаты в кошельке программы не хватает').toBeGreaterThan(0)
    const meta = docMeta(convert.meta)
    expect(Number(meta.registry_id)).toBe(1110)
    expect(String(meta.order_hash).toLowerCase(), 'заявление адресовано своему заказу').toBe(placed.orderHash.toLowerCase())
    expect(amount(meta.membership_fee)).toBeCloseTo(feeShortfall, 2)
    expect(amount(meta.amount)).toBeCloseTo(bodyShortfall + feeShortfall, 2)

    const SIGN = `mutation($d:MarketplaceSignIssuanceStatementInput!){ marketplaceSignIssuanceStatement(data:$d){ id stage decision_id last_error } }`
    const signed_statement = await signStatement(member, fixed.statement)

    // Без заявления 1110 подача отвергается до цепи, ход выдачи на месте.
    const refused = await gqlError(memberToken, SIGN, { d: { order_id: placed.orderId, signed_statement } })
    expect(refused?.code).toBe('MARKETPLACE_CONVERT_STATEMENT_MISSING')
    const untouched = await sagaOf(memberToken, placed.orderId)
    expect(untouched.stage).toBe('FACT_FIXED')
    expect(untouched.decision_id ?? null).toBeNull()

    // С заявлением: перевод уходит со свободного паевого, выдача идёт дальше.
    const mainBefore = await availableShare(member.account)
    const d = await gql<any>(memberToken, SIGN, {
      d: { order_id: placed.orderId, signed_statement, signed_convert: await signDocument(member.wif, convert, member.account, 1) },
    })
    expect(['DECISION_PENDING', 'DECISION_AUTHORIZED']).toContain(d.marketplaceSignIssuanceStatement.stage)
    if (feeShortfall > 0)
      expect(mainBefore - await availableShare(member.account), 'членская часть ушла со свободного паевого').toBeGreaterThanOrEqual(feeShortfall - 0.01)
  })
})

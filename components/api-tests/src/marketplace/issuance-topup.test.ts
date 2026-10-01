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
import { FINALIZE, bundlePayloads, createBundle, finalizeInput, money, price2, signStatement } from './issuance.helpers'
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

    const proposalId = await createBundle(operatorToken, member.account, [
      { order_id: placed.orderId, actual_quantity: 1, actual_unit_price: money(arrival) },
    ])
    const wallets = await settledWallets(memberToken)
    const payloads = await bundlePayloads(memberToken, proposalId)
    expect(payloads.convert, 'заявление о переводе паевого взноса пришло к подписи').not.toBeNull()

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
    expect(amount(payloads.convert.membership_fee)).toBeCloseTo(feeShortfall, 2)
    expect(amount(payloads.convert.amount)).toBeCloseTo(bodyShortfall + feeShortfall, 2)
    const meta = docMeta(payloads.convert.document.meta)
    expect(Number(meta.registry_id)).toBe(1110)
    expect(String(meta.order_hash).toLowerCase()).toBe(placed.orderHash.toLowerCase())

    const lines = [{ order_hash: placed.orderHash, signed_statement: await signStatement(member, payloads.statements.get(placed.orderHash)) }]

    // Без заявления 1110 подача отвергается, ход выдачи на месте.
    const refused = await gqlError(memberToken, FINALIZE, finalizeInput(proposalId, lines))
    expect(refused, 'подача без заявления о переводе отклонена').not.toBeNull()
    const untouched = await sagaOf(memberToken, placed.orderId)
    expect(untouched.stage).toBe('FACT_FIXED')
    expect(untouched.decision_id ?? null).toBeNull()

    // С заявлением: недостающее уходит со свободного паевого, выдача идёт дальше.
    const mainBefore = await availableShare(member.account)
    const d = await gql<any>(memberToken, FINALIZE, {
      d: { proposal_id: proposalId, order_lines: lines, signed_convert: await signDocument(member.wif, payloads.convert.document, member.account, 1) },
    })
    const saga = d.marketplaceFinalizeStockIssuance.sagas.find((s: any) => s.order_id === placed.orderId)
    expect(['DECISION_PENDING', 'DECISION_AUTHORIZED']).toContain(saga.stage)
    expect(mainBefore - await availableShare(member.account), 'со свободного паевого ушла сумма заявления').toBeCloseTo(amount(payloads.convert.amount), 2)
  })
})

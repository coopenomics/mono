/**
 * Заказ пайщика снаружи: оформление корзины, приём и отказ поставщиком,
 * отмена заказчиком (test-registry/marketplace.order.yaml).
 *
 * Денежные проводки заказа проверяют наборы boot (marketplace-money,
 * marketplace-convert); здесь — то, что видит клиент API: коды отказов,
 * статусы заказа, счётчики предложения, корзина после оформления.
 *
 * Свои предложения подаёт ivanpetrov (второй поставщик стенда), одобряет
 * председатель: остаток и упаковки нужны точные, а предложения витрины sidorov
 * безлимитные. Заказчица — ekaterina; для отказа цепи — orderer2, у него
 * меняется пункт выдачи корзины.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, caseName, fixture, gql, gqlError, gqlRaw, signDocument, tokenOf } from '../core'
import type { Who } from '../core'
import { docMeta } from '../core/documents'
import { amount } from '../core/wallet'
import { KRG, acceptToCoop, issueOrder } from './flow'
import {
  RUN_TAG,
  cancelOrder,
  checkoutRaw,
  checkoutSigned,
  clearCart,
  createApprovedOffer,
  ensureDigitalWallet,
  fillCart,
  findActiveOffer,
  getCart,
  getOffer,
  getOrder,
  linesOf,
  minU,
  myOrdersOfOffer,
  preview,
  settledWallets,
  units,
  unitsOfRub,
  wallets,
} from './order.helpers'

const ADD_TO_CART = 'mutation($i:MarketplaceAddToCartInput!){ marketplaceAddToCart(input:$i){ id } }'
const ACCEPT = 'mutation($i:MarketplaceAcceptOrdersBatchInput!){ marketplaceAcceptOrdersBatch(input:$i){ cycle_id orders{ id status cycle_id } } }'
const DECLINE = 'mutation($i:MarketplaceDeclineOrdersBatchInput!){ marketplaceDeclineOrdersBatch(input:$i){ orders{ id status } } }'
const CANCEL = 'mutation($i:MarketplaceCancelOrderInput!){ marketplaceCancelOrder(input:$i){ order{ id status } } }'
const SET_POINT = 'mutation($i:MarketplaceSetCartDeliveryPointInput!){ marketplaceSetCartDeliveryPoint(input:$i){ delivery_braname } }'

/** КУ, которого нет в цепи: предложение на него проходит модерацию, заказ — нет. */
const MISSING_KU = 'nokuzz'

let member: Who
let other: Who
let seedSupplier: Who
let operator: Who
let mt: string
let ot: string
let st: string
let opt: string

let potato: any
let honey: any
let limited: any
let packaged: any
let withdrawable: any
let rejected: any
let missingKuOffer: any
let feeContractPercent: bigint

/** Свободный паевой и членский кошельки программы покрывают тело и взнос мелкого заказа. */
async function ensureProgramFunds(minShareRub: number): Promise<void> {
  const w = await settledWallets(mt)
  if ((w['w.mkt.share'] ?? 0) >= minShareRub && (w['w.mkt.member'] ?? 0) >= minShareRub / 5)
    return
  const qty = Math.ceil(minShareRub / Number.parseFloat(potato.price_per_unit)) + 10
  await fillCart(mt, [{ offer_id: potato.id, quantity: qty }])
  const r = await checkoutSigned(member)
  await cancelOrder(mt, r.created_orders[0].id)
  await settledWallets(mt)
}

/** Сколько килограммов мёда нужно, чтобы тело превысило свободный паевой программы. */
function honeyQtyAboveShare(w: Record<string, number>): number {
  return Math.floor((w['w.mkt.share'] ?? 0) / Number.parseFloat(honey.price_per_unit)) + 3
}

function bodyUnits(priceAsset: string, qty: number): bigint {
  return units(priceAsset) * BigInt(qty)
}

function feeUnits(body: bigint): bigint {
  return (body * feeContractPercent) / 1_000_000n
}

beforeAll(async () => {
  member = ROLES.member()
  other = ROLES.otherMember()
  seedSupplier = ROLES.supplier()
  operator = ROLES.branchChairman()
  mt = await tokenOf(member)
  ot = await tokenOf(other)
  st = await tokenOf(seedSupplier)
  opt = await tokenOf(operator)

  await ensureDigitalWallet(member, 60_000)

  potato = await findActiveOffer(seedSupplier.account, 'Картофель деревенский')
  honey = await findActiveOffer(seedSupplier.account, 'Мёд цветочный')

  limited = await createApprovedOffer(other, CHAIRMAN, {
    product_name: `Тест ${RUN_TAG} остаток 5 кг`,
    price_per_unit: '1.00',
    unit_of_measure: 'KG',
    unlimited_flag: false,
    quantity_available: 5,
  })
  packaged = await createApprovedOffer(other, CHAIRMAN, {
    product_name: `Тест ${RUN_TAG} молоко бутылками`,
    price_per_unit: '90.00',
    unit_of_measure: 'LITER',
    sale_form: 'PACKAGED',
    unlimited_flag: false,
    packages: [
      { package_type: 'бутылка', label: '0,5 л', size: 0.5, price: '50.00', quantity_available: 3 },
      { package_type: 'бутылка', label: '1 л', size: 1, price: '90.00', quantity_available: 8, is_default: true },
    ],
  })
  withdrawable = await createApprovedOffer(other, CHAIRMAN, {
    product_name: `Тест ${RUN_TAG} снимаемое`,
    price_per_unit: '10.00',
    unit_of_measure: 'KG',
    unlimited_flag: true,
  })
  missingKuOffer = await createApprovedOffer(other, CHAIRMAN, {
    product_name: `Тест ${RUN_TAG} на несуществующий КУ`,
    price_per_unit: '1000.00',
    unit_of_measure: 'KG',
    unlimited_flag: true,
    delivery_points: [{ braname: MISSING_KU, min_supply_volume: 1 }],
  })
  const rej = await gql<any>(ot, 'mutation($i:MarketplaceCreateOfferInput!){ marketplaceCreateOffer(input:$i){ id } }', {
    i: {
      product_name: `Тест ${RUN_TAG} отклонённое`,
      description: 'Предложение внешнего слоя тестов',
      category_id: 1,
      price_per_unit: '10.00',
      unit_of_measure: 'KG',
      unlimited_flag: true,
      shelf_life_days: 30,
      delivery_points: [{ braname: KRG, min_supply_volume: 1 }],
    },
  })
  rejected = (await gql<any>(await tokenOf(CHAIRMAN), 'mutation($i:MarketplaceRejectOfferInput!){ marketplaceRejectOffer(input:$i){ id status } }', {
    i: { offer_id: rej.marketplaceCreateOffer.id, reason: 'Проверка отказа модерации' },
  })).marketplaceRejectOffer

  const eco = await gql<any>(await tokenOf(CHAIRMAN), 'query{ marketplaceGetEconomyConfig{ membership_fee_percent } }')
  feeContractPercent = BigInt(Math.round(Number(eco.marketplaceGetEconomyConfig.membership_fee_percent) * 10_000))
})

describe('заказ: границы оформления', () => {
  it(caseName('mkt.order.side.01', 'предложения нет — «Предложение не найдено», в корзину и в заказ не попадает'), async () => {
    const before = await getCart(mt)
    const ghost = crypto.randomUUID()
    const err = await gqlError(mt, ADD_TO_CART, { i: { offer_id: ghost, quantity: 1, delivery_braname: KRG } })
    expect(err?.code).toBe('MARKETPLACE_OFFER_NOT_FOUND')
    const after = await getCart(mt)
    expect(after.items.some((i: any) => i.offer_id === ghost)).toBe(false)
    expect(after.items.length).toBe(before.items.length)
  })

  it(caseName('mkt.order.side.05', 'нулевое количество — «Количество должно быть больше нуля», отрицательное отвергается'), async () => {
    await clearCart(mt)
    const zero = await gqlError(mt, ADD_TO_CART, { i: { offer_id: potato.id, quantity: 0, delivery_braname: KRG } })
    expect(zero?.code).toBe('MARKETPLACE_QUANTITY_MUST_BE_POSITIVE')
    const negative = await gqlError(mt, ADD_TO_CART, { i: { offer_id: potato.id, quantity: -2, delivery_braname: KRG } })
    expect(negative).not.toBeNull()
    expect((await getCart(mt)).items).toHaveLength(0)
  })

  it(caseName('mkt.order.side.06', 'пункт получения не указан — отказ, корзина остаётся на прежнем КУ'), async () => {
    const err = await gqlError(mt, SET_POINT, { i: { delivery_braname: '' } })
    expect(err?.code).toBe('MARKETPLACE_CART_BRANCH_REQUIRED')
    expect((await getCart(mt)).delivery_braname).toBe(KRG)
  })

  it(caseName('mkt.order.side.03', 'предложение отклонено модерацией или снято с публикации — заказ не создаётся'), async () => {
    expect(rejected.status).toBe('REJECTED')
    const rej = await gqlError(mt, ADD_TO_CART, { i: { offer_id: rejected.id, quantity: 1, delivery_braname: KRG } })
    expect(rej?.code).toBe('MARKETPLACE_CART_OFFER_NOT_ACTIVE')

    // В корзину положено, пока предложение было опубликовано; к оформлению его сняли.
    await fillCart(mt, [{ offer_id: withdrawable.id, quantity: 2 }])
    const w = await gql<any>(ot, 'mutation($i:MarketplaceWithdrawOfferInput!){ marketplaceWithdrawOffer(input:$i){ id status } }', { i: { id: withdrawable.id } })
    expect(w.marketplaceWithdrawOffer.status).toBe('WITHDRAWN')
    const r = await checkoutRaw(mt, {})
    expect(r.errors).toEqual([])
    const res = r.data.marketplaceCheckoutCart
    expect(res.fully_completed).toBe(false)
    expect(res.created_orders).toHaveLength(0)
    expect(res.failed_lines.map((f: any) => f.offer_id)).toEqual([withdrawable.id])
    expect(res.failed_lines[0].reason).toBeTruthy()
    expect(await myOrdersOfOffer(mt, withdrawable.id)).toHaveLength(0)

    const again = await gqlError(mt, ADD_TO_CART, { i: { offer_id: withdrawable.id, quantity: 1, delivery_braname: KRG } })
    expect(again?.code).toBe('MARKETPLACE_CART_OFFER_NOT_ACTIVE')
    await clearCart(mt)
  })
})

describe('заказ: остаток предложения и упаковки', () => {
  let potatoOrderId: string
  let cancelledPotatoId: string
  let packagedOrderId: string

  it(caseName('mkt.order.side.09', 'предложение без ограничения количества — остаток не проверяется, заказ создаётся'), async () => {
    expect(potato.unlimited_flag).toBe(true)
    const qty = Math.floor(Number(potato.quantity_available)) + 3
    await settledWallets(mt)
    await fillCart(mt, [{ offer_id: potato.id, quantity: qty }])
    const r = await checkoutSigned(member)
    expect(r.fully_completed).toBe(true)
    expect(r.created_orders).toHaveLength(1)
    const o = r.created_orders[0]
    expect(o.status).toBe('ACTIVE')
    expect(o.offer_id).toBe(potato.id)
    expect(o.quantity).toBe(qty)
    potatoOrderId = o.id
  })

  it(caseName('mkt.order.side.39', 'заявления нет, одна строка не прошла подготовку — остальные оформлены одной транзакцией, непрошедшая осталась в корзине'), async () => {
    await ensureProgramFunds(500)
    await fillCart(mt, [{ offer_id: potato.id, quantity: 1 }, { offer_id: limited.id, quantity: 6 }])
    const pv = await preview(mt)
    // Условие случая: кошельков программы хватает — заявления о переводе нет.
    expect(pv.convert).toBeNull()
    expect(pv.lines).toHaveLength(2)

    const r = await checkoutRaw(mt, { lines: linesOf(pv) })
    expect(r.errors).toEqual([])
    const res = r.data.marketplaceCheckoutCart
    expect(res.fully_completed).toBe(false)
    expect(res.created_orders.map((o: any) => o.offer_id)).toEqual([potato.id])
    expect(res.created_orders[0].status).toBe('ACTIVE')
    expect(res.failed_lines.map((f: any) => f.offer_id)).toEqual([limited.id])
    expect(res.cart.items.map((i: any) => i.offer_id)).toEqual([limited.id])
    cancelledPotatoId = res.created_orders[0].id

    // Ни одна строка не прошла — транзакции нет, заказов нет.
    const again = await checkoutRaw(mt, {})
    expect(again.errors).toEqual([])
    expect(again.data.marketplaceCheckoutCart.created_orders).toHaveLength(0)
    expect(again.data.marketplaceCheckoutCart.failed_lines.map((f: any) => f.offer_id)).toEqual([limited.id])
    expect(await myOrdersOfOffer(mt, limited.id)).toHaveLength(0)
  })

  it(caseName('mkt.order.side.04', 'количество больше остатка — отказ с доступным количеством, бронь не ставится'), async () => {
    // Корзина с прошлого шага: 6 кг при остатке 5.
    const r = await checkoutRaw(mt, {})
    const res = r.data.marketplaceCheckoutCart
    expect(res.created_orders).toHaveLength(0)
    expect(res.failed_lines[0].offer_id).toBe(limited.id)
    expect(res.failed_lines[0].reason).toContain('5')
    const offer = await getOffer(ot, limited.id)
    expect(offer.quantity_available).toBe(5)
    expect(offer.quantity_blocked).toBe(0)
    await clearCart(mt)
  })

  it(caseName('mkt.order.side.15', 'отмену чужого заказа запрашивает другой пайщик — отказ, заказ активен'), async () => {
    const err = await gqlError(ot, CANCEL, { i: { order_id: cancelledPotatoId } })
    expect(err?.code).toBe('MARKETPLACE_ORDER_CANCEL_FORBIDDEN_NOT_OWNER')
    expect((await getOrder(mt, cancelledPotatoId)).status).toBe('ACTIVE')
  })

  it(caseName('mkt.order.side.17', 'отмена несуществующего заказа — «Заказ не найден»'), async () => {
    const err = await gqlError(mt, CANCEL, { i: { order_id: crypto.randomUUID() } })
    expect(err?.code).toBe('MARKETPLACE_ORDER_NOT_FOUND')
    // Заказчик отменяет свой заказ, повтор отмены уже закрыт.
    const done = await cancelOrder(mt, cancelledPotatoId)
    expect(done.order.status).toBe('CANCELLED_BY_ORDERER')
    const twice = await gqlError(mt, CANCEL, { i: { order_id: cancelledPotatoId } })
    expect(twice?.code).toBe('MARKETPLACE_ORDER_CANCEL_WRONG_STATUS')
  })

  it(caseName('mkt.order.side.35', 'бутылок 0,5 л не хватает, хотя литров хватает — отказ «Доступно только 3 упак.»'), async () => {
    const small = packaged.packages.find((p: any) => p.size === 0.5)
    expect(small.quantity_available).toBe(3)
    expect(packaged.quantity_available).toBeGreaterThanOrEqual(2.5)
    await ensureProgramFunds(500)
    await fillCart(mt, [{ offer_id: packaged.id, quantity: 5, package_id: small.id }])
    const pv = await preview(mt)
    expect(pv.convert).toBeNull()
    const r = await checkoutRaw(mt, { lines: linesOf(pv) })
    const res = r.data.marketplaceCheckoutCart
    expect(res.created_orders).toHaveLength(0)
    expect(res.failed_lines[0].offer_id).toBe(packaged.id)
    expect(res.failed_lines[0].reason).toContain('3')
    const offer = await getOffer(ot, packaged.id)
    expect(offer.packages.find((p: any) => p.id === small.id).quantity_blocked).toBe(0)
    expect(offer.quantity_blocked).toBe(0)
    await clearCart(mt)
  })

  it(caseName('mkt.order.side.08', 'заказ упаковками: в заказе и счётчиках базовое количество, у упаковки — число упаковок, цена за упаковку'), async () => {
    const small = packaged.packages.find((p: any) => p.size === 0.5)
    const big = packaged.packages.find((p: any) => p.size === 1)
    const before = await getOffer(ot, packaged.id)
    await settledWallets(mt)
    await fillCart(mt, [{ offer_id: packaged.id, quantity: 2, package_id: small.id }])
    const r = await checkoutSigned(member)
    expect(r.fully_completed).toBe(true)
    const o = r.created_orders[0]
    expect(o.quantity).toBe(1)
    expect(o.package_id).toBe(small.id)
    expect(o.package_size).toBe(0.5)
    expect(amount(o.price_per_unit)).toBe(50)
    expect(amount(o.total_cost)).toBe(100)
    packagedOrderId = o.id

    const after = await getOffer(ot, packaged.id)
    const smallAfter = after.packages.find((p: any) => p.id === small.id)
    expect(smallAfter.quantity_available).toBe(small.quantity_available - 2)
    expect(smallAfter.quantity_blocked).toBe(2)
    expect(after.packages.find((p: any) => p.id === big.id).quantity_blocked).toBe(0)
    expect(after.quantity_blocked).toBeCloseTo(before.quantity_blocked + 1, 6)
    expect(after.quantity_available).toBeCloseTo(before.quantity_available - 1, 6)
  })

  describe('приём и отказ поставщиком', () => {
    it(caseName('mkt.order.side.12', 'массовое действие с пустым списком — «Не выбрано ни одного заказа»'), async () => {
      expect((await gqlError(st, ACCEPT, { i: { order_ids: [] } }))?.code).toBe('MARKETPLACE_ORDER_NONE_SELECTED')
      expect((await gqlError(st, DECLINE, { i: { order_ids: [], reason: 'нет товара' } }))?.code).toBe('MARKETPLACE_ORDER_NONE_SELECTED')
    })

    it(caseName('mkt.order.side.11', 'отказ без причины — «Укажите причину отказа», заказ активен'), async () => {
      const err = await gqlError(st, DECLINE, { i: { order_ids: [potatoOrderId], reason: '   ' } })
      expect(err?.code).toBe('MARKETPLACE_DECLINE_REASON_REQUIRED')
      expect((await getOrder(mt, potatoOrderId)).status).toBe('ACTIVE')
    })

    it(caseName('mkt.order.side.13', 'действие по заказу на чужое предложение — отказ «только поставщику-владельцу»'), async () => {
      expect((await gqlError(ot, ACCEPT, { i: { order_ids: [potatoOrderId] } }))?.code).toBe('MARKETPLACE_ACTION_FORBIDDEN_NOT_OFFER_OWNER')
      expect((await gqlError(ot, DECLINE, { i: { order_ids: [potatoOrderId], reason: 'нет товара' } }))?.code).toBe('MARKETPLACE_ACTION_FORBIDDEN_NOT_OFFER_OWNER')
      expect((await getOrder(mt, potatoOrderId)).status).toBe('ACTIVE')
    })

    it(caseName('mkt.order.side.20', 'массовый приём с непроходным заказом — отказ до цепи, ни один заказ не принят'), async () => {
      const cases: Array<[string, string]> = [
        [packagedOrderId, 'MARKETPLACE_ACTION_FORBIDDEN_NOT_OFFER_OWNER'],
        [crypto.randomUUID(), 'MARKETPLACE_ORDER_NOT_FOUND'],
        [cancelledPotatoId, 'MARKETPLACE_ORDER_ACCEPT_WRONG_STATE'],
      ]
      for (const [bad, code] of cases) {
        const err = await gqlError(st, ACCEPT, { i: { order_ids: [potatoOrderId, bad] } })
        expect(err?.code).toBe(code)
        const o = await getOrder(mt, potatoOrderId)
        expect(o.status).toBe('ACTIVE')
        expect(o.cycle_id).toBeNull()
      }
    })

    it(caseName('mkt.order.side.21', 'массовый отказ с непроходным заказом — отказ до цепи, ни один отказ не отправлен'), async () => {
      const cases: Array<[string, string]> = [
        [crypto.randomUUID(), 'MARKETPLACE_ORDER_NOT_FOUND'],
        [packagedOrderId, 'MARKETPLACE_ACTION_FORBIDDEN_NOT_OFFER_OWNER'],
        [cancelledPotatoId, 'MARKETPLACE_ORDER_DECLINE_WRONG_STATE'],
      ]
      for (const [bad, code] of cases) {
        const err = await gqlError(st, DECLINE, { i: { order_ids: [potatoOrderId, bad], reason: 'нет товара' } })
        expect(err?.code).toBe(code)
        expect((await getOrder(mt, potatoOrderId)).status).toBe('ACTIVE')
      }
    })

    it(caseName('mkt.order.side.10', 'приём заказа, уже принятого в партию либо не активного, — отказ'), async () => {
      const ok = await gql<any>(st, ACCEPT, { i: { order_ids: [potatoOrderId] } })
      const accepted = ok.marketplaceAcceptOrdersBatch.orders.find((o: any) => o.id === potatoOrderId)
      expect(accepted.status).toBe('ACCEPTED')
      expect(accepted.cycle_id).toBeTruthy()

      expect((await gqlError(st, ACCEPT, { i: { order_ids: [potatoOrderId] } }))?.code).toBe('MARKETPLACE_ORDER_ACCEPT_WRONG_STATE')
      expect((await gqlError(st, DECLINE, { i: { order_ids: [potatoOrderId], reason: 'нет товара' } }))?.code).toBe('MARKETPLACE_ORDER_DECLINE_WRONG_STATE')
      expect((await gqlError(st, ACCEPT, { i: { order_ids: [cancelledPotatoId] } }))?.code).toBe('MARKETPLACE_ORDER_ACCEPT_WRONG_STATE')

      // Уборка: заказчица отказывается от принятого, поставщик отклоняет заказ упаковками.
      await cancelOrder(mt, potatoOrderId)
      const dec = await gql<any>(ot, DECLINE, { i: { order_ids: [packagedOrderId], reason: 'Проверка отказа поставщика' } })
      expect(dec.marketplaceDeclineOrdersBatch.orders[0].status).toBe('CANCELLED_BY_SUPPLIER')
    })
  })
})

describe('заказ: заявление 1110 при оформлении', () => {
  it(caseName('mkt.order.side.30', 'план по строкам: взнос — с членского кошелька, тело — со свободного паевого, недостающее — заявлением'), async () => {
    const w = await settledWallets(mt)
    const hq = honeyQtyAboveShare(w)
    await fillCart(mt, [{ offer_id: honey.id, quantity: hq }, { offer_id: potato.id, quantity: 1 }])
    const pv = await preview(mt)
    expect(pv.lines).toHaveLength(2)
    expect(pv.convert).not.toBeNull()

    let memberLeft = unitsOfRub(w['w.mkt.member'] ?? 0)
    let shareLeft = unitsOfRub(w['w.mkt.share'] ?? 0)
    let transfer = 0n
    let feeConvert = 0n
    const expected = [bodyUnits(honey.price_per_unit, hq), bodyUnits(potato.price_per_unit, 1)]
    pv.lines.forEach((l: any, i: number) => {
      const body = expected[i]
      const fee = feeUnits(body)
      expect(l.offer_id).toBe(i === 0 ? honey.id : potato.id)
      expect(units(l.membership_fee)).toBe(fee)
      expect(units(l.amount)).toBe(body + fee)
      const fromMember = minU(fee, memberLeft)
      memberLeft -= fromMember
      const fromProgram = minU(body, shareLeft)
      shareLeft -= fromProgram
      expect(units(l.from_member)).toBe(fromMember)
      expect(units(l.from_program)).toBe(fromProgram)
      expect(units(l.from_wallet)).toBe(body - fromProgram + fee - fromMember)
      transfer += units(l.from_wallet)
      feeConvert += fee - fromMember
    })
    expect(units(pv.convert.amount)).toBe(transfer)
    expect(units(pv.convert.membership_fee)).toBe(feeConvert)
  })

  it(caseName('mkt.order.side.31', 'превью отдаёт заявление 1110: якорь оформления, сумма и членская часть — из плана'), async () => {
    const pv = await preview(mt)
    const meta = docMeta(pv.convert.document.meta)
    expect(Number(meta.registry_id)).toBe(1110)
    expect(meta.username).toBe(member.account)
    expect(String(meta.order_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(units(String(meta.amount))).toBe(units(pv.convert.amount))
    expect(units(String(meta.membership_fee))).toBe(units(pv.convert.membership_fee))
    // Якорь — оформление корзины, а не заказ: у строк свои хэши.
    for (const l of pv.lines) expect(l.order_hash).not.toBe(meta.order_hash)
  })

  it(caseName('mkt.order.side.32', 'заявления нет, оно чужое, подписано чужим ключом или разошлось с суммой — отказ до цепи; сошедшееся проходит'), async () => {
    const pv = await preview(mt)
    const lines = linesOf(pv)
    const honeyBefore = (await myOrdersOfOffer(mt, honey.id, ['ACTIVE'])).length

    const missing = await checkoutRaw(mt, { lines })
    expect(missing.errors[0]?.code).toBe('MARKETPLACE_CONVERT_STATEMENT_MISSING')

    const foreignSigner = await signDocument(other.wif, pv.convert.document, other.account, 1)
    expect((await checkoutRaw(mt, { lines, signed_convert: foreignSigner })).errors[0]?.code).toBe('MARKETPLACE_CONVERT_WRONG_SIGNER')

    // Заявление с оформления другого пайщика — другой якорь.
    const ow = await settledWallets(ot)
    await fillCart(ot, [{ offer_id: honey.id, quantity: honeyQtyAboveShare(ow) }])
    const opv = await preview(ot)
    expect(opv.convert).not.toBeNull()
    const foreignStatement = await signDocument(other.wif, opv.convert.document, other.account, 1)
    await clearCart(ot)
    expect((await checkoutRaw(mt, { lines, signed_convert: foreignStatement })).errors[0]?.code).toBe('MARKETPLACE_CONVERT_STATEMENT_WRONG_CHECKOUT')

    // Корзина изменилась после подписи — недостающая сумма разошлась.
    const own = await signDocument(member.wif, pv.convert.document, member.account, 1)
    const honeyLine = (await getCart(mt)).items.find((i: any) => i.offer_id === honey.id)
    await gql(mt, 'mutation($i:MarketplaceUpdateCartItemInput!){ marketplaceUpdateCartItem(input:$i){ id } }', {
      i: { offer_id: honey.id, quantity: honeyLine.quantity + 1 },
    })
    expect((await checkoutRaw(mt, { lines, signed_convert: own })).errors[0]?.code).toBe('MARKETPLACE_CONVERT_AMOUNT_CHANGED')

    // Ни одна попытка не записала заказ и не тронула корзину.
    expect((await myOrdersOfOffer(mt, honey.id, ['ACTIVE'])).length).toBe(honeyBefore)
    expect((await getCart(mt)).items.map((i: any) => i.offer_id).sort()).toEqual([honey.id, potato.id].sort())

    // Свежее превью, подпись заказчицы — оформление проходит.
    const done = await checkoutSigned(member)
    expect(done.fully_completed).toBe(true)
    expect(done.created_orders).toHaveLength(2)
    for (const o of done.created_orders) await cancelOrder(mt, o.id)
  })

  it(caseName('mkt.order.side.38', 'заявление подписано, одна строка не прошла подготовку — оформление не запущено, брони сняты, позиция названа'), async () => {
    const w = await settledWallets(mt)
    await fillCart(mt, [{ offer_id: honey.id, quantity: honeyQtyAboveShare(w) }, { offer_id: limited.id, quantity: 50 }])
    const pv = await preview(mt)
    expect(pv.convert).not.toBeNull()
    const signed = await signDocument(member.wif, pv.convert.document, member.account, 1)
    const honeyBefore = await getOffer(mt, honey.id)
    const limitedBefore = await getOffer(ot, limited.id)
    const ordersBefore = (await myOrdersOfOffer(mt, honey.id, ['ACTIVE'])).length

    const r = await checkoutRaw(mt, { lines: linesOf(pv), signed_convert: signed })
    expect(r.errors).toHaveLength(1)
    expect(String(r.errors[0].code)).toBe('400')
    expect(r.errors[0].message).toContain(limited.product_name)

    expect((await myOrdersOfOffer(mt, honey.id, ['ACTIVE'])).length).toBe(ordersBefore)
    expect(await myOrdersOfOffer(mt, limited.id)).toHaveLength(0)
    expect((await getOffer(mt, honey.id)).quantity_blocked).toBe(honeyBefore.quantity_blocked)
    const limitedAfter = await getOffer(ot, limited.id)
    expect(limitedAfter.quantity_blocked).toBe(limitedBefore.quantity_blocked)
    expect(limitedAfter.quantity_available).toBe(limitedBefore.quantity_available)
    expect((await getCart(mt)).items).toHaveLength(2)
    await clearCart(mt)
  })
})

describe('заказ: отказ после приёмки и корзина из остатка', () => {
  let stockItemId: string

  it(caseName('mkt.order.side.37', 'отказ после приёмки части: принятое выбывает из предложения в остаток КУ, в свободное возвращается непоставленное'), async () => {
    const before = await getOffer(ot, limited.id)
    await settledWallets(mt)
    await fillCart(mt, [{ offer_id: limited.id, quantity: 2 }])
    const placed = await checkoutSigned(member)
    const orderId = placed.created_orders[0].id as string
    await acceptToCoop({ supplier: other, operator, orderId, factQuantity: 1, factUnitPrice: 1 })
    expect((await getOrder(mt, orderId)).status).toBe('ACCEPTED_TO_COOP')

    const cancelled = await cancelOrder(mt, orderId)
    expect(cancelled.order.status).toBe('CANCELLED_BY_ORDERER')

    const after = await getOffer(ot, limited.id)
    expect(after.quantity_available).toBeCloseTo(before.quantity_available - 1, 6)
    expect(after.quantity_blocked).toBeCloseTo(before.quantity_blocked, 6)
    expect(after.quantity_consumed).toBeCloseTo(before.quantity_consumed + 1, 6)

    const stock = await gql<any>(opt, 'query($b:String){ marketplaceListStock(braname:$b){ id order_id ownership quantity_per_label status } }', { b: KRG })
    const mine = (stock.marketplaceListStock as any[]).filter(i => i.order_id === orderId)
    expect(mine).toHaveLength(1)
    expect(mine[0].ownership).toBe('COOP')
    expect(mine[0].quantity_per_label).toBe(1)
    stockItemId = mine[0].id
  })

  it(caseName('mkt.order.happy.05', 'корзина из заказа у поставщика и заказа из остатка с заявлением — одна транзакция, оба заказа записаны, строки убраны'), async () => {
    const published = await gql<any>(opt, 'mutation($d:MarketplacePublishStockInput!){ marketplacePublishStock(data:$d){ id status stock_braname } }', {
      d: { inventory_ids: [stockItemId] },
    })
    const stockOffer = (published.marketplacePublishStock as any[]).find(o => o.stock_braname === KRG)
    expect(stockOffer?.status).toBe('ACTIVE')

    const w = await settledWallets(mt)
    await fillCart(mt, [{ offer_id: honey.id, quantity: honeyQtyAboveShare(w) }, { offer_id: stockOffer.id, quantity: 1 }])
    const pv = await preview(mt)
    expect(pv.convert).not.toBeNull()
    const signed = await signDocument(member.wif, pv.convert.document, member.account, 1)
    const r = await gqlRaw<any>(mt, `mutation($i:MarketplaceCheckoutCartInput){
      marketplaceCheckoutCart(input:$i){ checkout_id fully_completed failed_lines{ offer_id reason }
        created_orders{ id status offer_id checkout_id create_tx{ tx_hash } } cart{ items{ offer_id } } }
    }`, { i: { lines: linesOf(pv), signed_convert: signed } })
    expect(r.errors).toEqual([])
    const res = r.data.marketplaceCheckoutCart
    expect(res.fully_completed).toBe(true)
    expect(res.created_orders).toHaveLength(2)
    const bySupplier = res.created_orders.find((o: any) => o.offer_id === honey.id)
    const fromStock = res.created_orders.find((o: any) => o.offer_id === stockOffer.id)
    expect(bySupplier.status).toBe('ACTIVE')
    expect(fromStock.status).toBe('ACCEPTED_TO_COOP')
    expect(bySupplier.checkout_id).toBe(res.checkout_id)
    expect(fromStock.checkout_id).toBe(res.checkout_id)
    expect(bySupplier.create_tx.tx_hash).toBeTruthy()
    expect(fromStock.create_tx.tx_hash).toBe(bySupplier.create_tx.tx_hash)
    expect(res.cart.items.filter((i: any) => i.offer_id === honey.id || i.offer_id === stockOffer.id)).toHaveLength(0)

    await cancelOrder(mt, bySupplier.id)
  })
})

describe('заказ: отказ цепи в общей транзакции', () => {
  it(caseName('mkt.order.break.02', 'цепь отказала в заказе общей транзакции — отказ целиком, брони сняты, перевод откатился, корзина не тронута'), async () => {
    const buyer = fixture('orderer2')
    const bt = await tokenOf(buyer)
    await ensureDigitalWallet(buyer, 30_000)
    try {
      await clearCart(bt)
      await gql(bt, SET_POINT, { i: { delivery_braname: MISSING_KU } })
      const w0 = await settledWallets(bt)
      const qty = Math.floor((w0['w.mkt.share'] ?? 0) / 1000) + 2
      await gql(bt, ADD_TO_CART, { i: { offer_id: missingKuOffer.id, quantity: qty, delivery_braname: MISSING_KU } })
      const pv = await preview(bt)
      expect(pv.convert).not.toBeNull()
      const signed = await signDocument(buyer.wif, pv.convert.document, buyer.account, 1)
      const offerBefore = await getOffer(ot, missingKuOffer.id)

      const r = await checkoutRaw(bt, { lines: linesOf(pv), signed_convert: signed })
      expect(r.errors[0]?.code).toBe('CHAIN_ASSERT')

      expect(await myOrdersOfOffer(bt, missingKuOffer.id)).toHaveLength(0)
      const offerAfter = await getOffer(ot, missingKuOffer.id)
      expect(offerAfter.quantity_blocked).toBe(offerBefore.quantity_blocked)
      expect((await getCart(bt)).items.map((i: any) => i.offer_id)).toEqual([missingKuOffer.id])
      const w1 = await wallets(bt)
      for (const name of ['w.wal.share', 'w.mkt.member', 'w.mkt.share', 'w.mkt.order'])
        expect(w1[name] ?? 0).toBe(w0[name] ?? 0)
    }
    finally {
      await clearCart(bt)
      await gql(bt, SET_POINT, { i: { delivery_braname: KRG } })
    }
  })
})

describe('заказ: отмена после открытия акта выдачи', () => {
  it(caseName('mkt.order.side.16', 'после выдачи по акту отмена закрыта — отказ со статусом заказа'), async () => {
    await settledWallets(mt)
    await fillCart(mt, [{ offer_id: potato.id, quantity: 1 }])
    const placed = await checkoutSigned(member)
    const orderId = placed.created_orders[0].id as string
    const price = amount(potato.price_per_unit)
    await acceptToCoop({ supplier: seedSupplier, operator, orderId, factQuantity: 1, factUnitPrice: price })
    await issueOrder({ operator, member, orderId, actualQuantity: 1, actualUnitPrice: price })
    const status = (await getOrder(mt, orderId)).status
    expect(['READY_TO_RECEIVE', 'RECEIVED']).toContain(status)
    const err = await gqlError(mt, CANCEL, { i: { order_id: orderId } })
    expect(err?.code).toBe('MARKETPLACE_ORDER_CANCEL_WRONG_STATUS')
    expect((await getOrder(mt, orderId)).status).toBe(status)
  })
})

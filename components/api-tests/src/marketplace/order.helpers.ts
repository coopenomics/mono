/**
 * Помощники набора «заказ пайщика»: свои предложения поставщика, корзина с
 * несколькими строками и упаковками, превью и оформление, кошельки
 * программы. Только действия и чтение — ассерты живут в тестах.
 *
 * flow.placeOrder оформляет одну строку по мере; здесь нужны корзины из
 * нескольких строк, строки упаковкой и оформление без подписи или с чужой
 * подписью заявления — поэтому свой шаг корзины.
 */
import crypto from 'node:crypto'
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { gql, gqlRaw } from '../core/client'
import { signDocument } from '../core/documents'
import { waitFor } from '../core/wait'
import { amount } from '../core/wallet'
import { KRG } from './flow'

/** Метка прогона в названиях предложений — свои строки ищутся по ней. */
export const RUN_TAG = crypto.randomBytes(3).toString('hex')

export const OFFER_FIELDS = `id status product_name price_per_unit unit_of_measure unlimited_flag supplier_account stock_braname sale_form
  quantity_available quantity_blocked quantity_consumed
  packages{ id size price is_default quantity_available quantity_blocked quantity_consumed }`

export const ORDER_FIELDS = `id status order_hash offer_id quantity package_id package_size price_per_unit total_cost membership_fee
  orderer_account supplier_account delivery_braname cycle_id checkout_id create_tx{ tx_hash block_num }`

export async function getOffer(token: string, id: string): Promise<any> {
  const d = await gql<any>(token, `query($id:String!){ marketplaceGetOffer(id:$id){ ${OFFER_FIELDS} } }`, { id })
  return d.marketplaceGetOffer
}

export async function getOrder(token: string, orderId: string): Promise<any> {
  const d = await gql<any>(token, `query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ ${ORDER_FIELDS} } }`, { i: { order_id: orderId } })
  return d.marketplaceGetOrder
}

/** Поставщик подаёт предложение, председатель одобряет — предложение ACTIVE. */
export async function createApprovedOffer(supplier: Who, moderator: Who, input: Record<string, unknown>): Promise<any> {
  const created = await gql<any>(await tokenOf(supplier), `mutation($i:MarketplaceCreateOfferInput!){ marketplaceCreateOffer(input:$i){ id status } }`, {
    i: {
      category_id: 1,
      description: 'Предложение внешнего слоя тестов',
      shelf_life_days: 30,
      delivery_points: [{ braname: KRG, min_supply_volume: 1 }],
      ...input,
    },
  })
  const id = created.marketplaceCreateOffer.id as string
  await gql(await tokenOf(moderator), `mutation($i:MarketplaceApproveOfferInput!){ marketplaceApproveOffer(input:$i){ id status } }`, {
    i: { offer_id: id, warranty_days: 3 },
  })
  return getOffer(await tokenOf(supplier), id)
}

/** Активное предложение поставщика по названию (сид витрины). */
export async function findActiveOffer(token: string, supplierAccount: string, productName: string): Promise<any> {
  return waitFor(async () => {
    const d = await gql<any>(token, `query($i:MarketplaceListAllOffersInput){ marketplaceListAllOffers(input:$i){ items{ ${OFFER_FIELDS} } } }`, {
      i: { supplier_account: supplierAccount, statuses: ['ACTIVE'], limit: 100, page: 1 },
    })
    return (d.marketplaceListAllOffers.items as any[]).find(o => o.product_name === productName) ?? null
  }, { timeoutMs: 180_000, intervalMs: 5_000, label: `активное предложение «${productName}» у ${supplierAccount}` })
}

// ── Корзина ────────────────────────────────────────────────────────────────

export interface CartLine { offer_id: string, quantity: number, package_id?: string | null }

export const CART_FIELDS = 'id delivery_braname items{ offer_id package_id quantity }'

export async function clearCart(token: string): Promise<void> {
  await gql(token, 'mutation{ marketplaceClearCart{ id } }')
}

export async function getCart(token: string): Promise<any> {
  const d = await gql<any>(token, `query{ marketplaceGetCart{ ${CART_FIELDS} } }`)
  return d.marketplaceGetCart
}

/** Очистить корзину и положить строки на КУ. */
export async function fillCart(token: string, lines: CartLine[], braname = KRG): Promise<void> {
  await clearCart(token)
  for (const l of lines) {
    await gql(token, 'mutation($i:MarketplaceAddToCartInput!){ marketplaceAddToCart(input:$i){ id } }', {
      i: { offer_id: l.offer_id, quantity: l.quantity, package_id: l.package_id ?? null, delivery_braname: braname },
    })
  }
}

export const PREVIEW_QUERY = `query{
  marketplaceCheckoutSignablePayloads{
    lines{ offer_id package_id order_hash amount membership_fee from_member from_program from_wallet }
    convert{ amount membership_fee document{ full_title html hash meta binary } }
  }
}`

export async function preview(token: string): Promise<any> {
  const d = await gql<any>(token, PREVIEW_QUERY)
  return d.marketplaceCheckoutSignablePayloads
}

export const CHECKOUT_MUTATION = `mutation($i:MarketplaceCheckoutCartInput){
  marketplaceCheckoutCart(input:$i){
    checkout_id fully_completed
    created_orders{ ${ORDER_FIELDS} }
    failed_lines{ offer_id product_name quantity reason }
    cart{ ${CART_FIELDS} }
  }
}`

export function linesOf(pv: any): any[] {
  return (pv.lines as any[]).map(l => ({ offer_id: l.offer_id, package_id: l.package_id, order_hash: l.order_hash }))
}

/** Оформление ответом целиком — для проверок отказа. */
export async function checkoutRaw(token: string, input: { lines?: any[] | null, signed_convert?: unknown }) {
  return gqlRaw<any>(token, CHECKOUT_MUTATION, { i: { lines: input.lines ?? null, signed_convert: input.signed_convert ?? null } })
}

/** Превью → подпись заявления ключом заказчика (если оно есть) → оформление. */
export async function checkoutSigned(who: Who): Promise<any> {
  const token = await tokenOf(who)
  const pv = await preview(token)
  const signed = pv.convert ? await signDocument(who.wif, pv.convert.document, who.account, 1) : null
  const d = await gql<any>(token, CHECKOUT_MUTATION, { i: { lines: linesOf(pv), signed_convert: signed } })
  return d.marketplaceCheckoutCart
}

export async function cancelOrder(token: string, orderId: string): Promise<any> {
  const d = await gql<any>(token, `mutation($i:MarketplaceCancelOrderInput!){ marketplaceCancelOrder(input:$i){ tx_hash order{ ${ORDER_FIELDS} } } }`, {
    i: { order_id: orderId },
  })
  return d.marketplaceCancelOrder
}

export async function myOrdersOfOffer(token: string, offerId: string, statuses?: string[]): Promise<any[]> {
  const d = await gql<any>(token, `query($i:MarketplaceListOrdersInput,$o:PaginationInput){
    marketplaceListMyOrders(input:$i, options:$o){ items{ ${ORDER_FIELDS} } }
  }`, { i: { offer_id: offerId, statuses: statuses ?? null }, o: { page: 1, limit: 100, sortOrder: 'DESC' } })
  return d.marketplaceListMyOrders.items
}

// ── Кошельки программы ─────────────────────────────────────────────────────

export type Wallets = Record<string, number>

/** Остатки кошельков пайщика на Столе заказов: name → available. */
export async function wallets(token: string): Promise<Wallets> {
  const d = await gql<any>(token, 'query{ marketplaceMemberWallet{ wallets{ name available } } }')
  const out: Wallets = {}
  for (const w of d.marketplaceMemberWallet.wallets as any[]) out[w.name] = amount(w.available)
  return out
}

/**
 * Остатки после того, как зеркало кошельков догнало цепь: два чтения подряд
 * совпали. Превью и оформление считают план по зеркалу; если оно ещё
 * догоняет отмену или заказ, суммы превью и оформления разойдутся.
 */
export async function settledWallets(token: string): Promise<Wallets> {
  let prev = JSON.stringify(await wallets(token))
  return waitFor(async () => {
    // timing: backoff — зеркало кошельков догоняет последнюю транзакцию пайщика
    await new Promise(r => setTimeout(r, 1_500))
    const now = await wallets(token)
    const same = JSON.stringify(now) === prev
    prev = JSON.stringify(now)
    return same ? now : null
  }, { timeoutMs: 60_000, intervalMs: 100, label: 'зеркало кошельков программы успокоилось' })
}

/** «12.3400 RUB» → минимальные единицы (4 знака). */
export function units(asset: string): bigint {
  const [num] = String(asset).split(' ')
  const [int, frac = ''] = num.split('.')
  return BigInt(int || '0') * 10_000n + BigInt((frac + '0000').slice(0, 4) || '0')
}

export function unitsOfRub(n: number): bigint {
  return units(n.toFixed(4))
}

export function minU(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

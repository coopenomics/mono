/**
 * Помощники набора «предложение поставщика» (marketplace.offer).
 *
 * Поставщик под набор — свежий пайщик: у фонового поставщика витрины sidorov
 * засев уже завёл десять предложений, и лимит «10 предложений в час на
 * поставщика» закрыл бы ему создание на всё время прогона. Свежего поставщика
 * допускают тем же путём, что рабочий стол: реквизиты для выплат заводит сам
 * пайщик, в реестр поставщиков его добавляет председатель.
 */
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { gql } from '../core/client'
import { signDocument } from '../core/documents'
import { COOP } from '../core/env'
import { freshMember } from '../core/participants'
import { CHAIRMAN } from '../core/roles'

export const OFFER_FIELDS = `id status product_name supplier_account stock_braname unit_of_measure sale_form price_per_unit
  quantity_available quantity_blocked quantity_consumed unlimited_flag shelf_life_days
  approved_at approved_by reject_reason warranty_days barcode_strategy pack_size
  delivery_points { braname min_supply_volume }
  images { bucket_key }
  packages { id size price label package_type is_default quantity_available quantity_blocked quantity_consumed }`

export interface Supplier {
  who: Who
  token: string
}

/** Свежий допущенный поставщик с реквизитами для выплат. */
export async function freshSupplier(prefix = 'mkof'): Promise<Supplier> {
  const who = freshMember({ prefix, lastName: 'Поставщиков' })
  const token = await tokenOf(who)
  const pm = await gql<any>(token, `mutation($d:AddPaymentMethodInput!){ addPaymentMethod(data:$d){ method_id } }`, {
    d: {
      username: who.account,
      is_default: true,
      bank_transfer_data: {
        account_number: '40817810099910004312',
        bank_name: 'ПАО Сбербанк',
        currency: 'RUB',
        card_number: '',
        details: { bik: '044525225', corr: '30101810400000000225' },
      },
    },
  })
  await gql(await tokenOf(CHAIRMAN), `mutation($i:MarketplaceAddSupplierInput!){
    marketplaceAddSupplier(input:$i){ member_account status }
  }`, { i: { member_account: who.account } })
  await gql(token, `mutation($i:MarketplaceSetSupplierPayoutMethodInput!){
    marketplaceSetSupplierPayoutMethod(input:$i){ has_payout_method }
  }`, { i: { method_id: pm.addPaymentMethod.method_id } })
  return { who, token }
}

/** Категория, доступная для публикации (с учётом ограничений кооператива). */
export async function availableCategoryId(token: string): Promise<number> {
  const d = await gql<any>(token, 'query{ marketplaceListAvailableCategories{ id } }')
  const first = d.marketplaceListAvailableCategories[0]
  if (!first)
    throw new Error('в кооперативе нет ни одной доступной категории')
  return first.id as number
}

export const CREATE_OFFER = `mutation($i:MarketplaceCreateOfferInput!){ marketplaceCreateOffer(input:$i){ ${OFFER_FIELDS} } }`
export const UPDATE_OFFER = `mutation($i:MarketplaceUpdateOfferInput!){ marketplaceUpdateOffer(input:$i){ ${OFFER_FIELDS} } }`
export const WITHDRAW_OFFER = `mutation($i:MarketplaceWithdrawOfferInput!){ marketplaceWithdrawOffer(input:$i){ id status } }`
export const REPUBLISH_OFFER = `mutation($i:MarketplaceRepublishOfferInput!){ marketplaceRepublishOffer(input:$i){ id status } }`
export const APPROVE_OFFER = `mutation($i:MarketplaceApproveOfferInput!){ marketplaceApproveOffer(input:$i){ id status warranty_days approved_by } }`
export const REJECT_OFFER = `mutation($i:MarketplaceRejectOfferInput!){ marketplaceRejectOffer(input:$i){ id status reject_reason } }`

/** Вход создания по мере: минимально заполненная карточка, поверх — правки теста. */
export function offerInput(name: string, categoryId: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    product_name: name,
    description: 'Предложение внешнего теста',
    category_id: categoryId,
    price_per_unit: '100.00',
    unit_of_measure: 'KG',
    quantity_available: 10,
    unlimited_flag: false,
    delivery_points: [{ braname: 'krg', min_supply_volume: 1 }],
    shelf_life_days: 10,
    ...overrides,
  }
}

export async function createOffer(token: string, input: Record<string, unknown>): Promise<any> {
  const d = await gql<any>(token, CREATE_OFFER, { i: input })
  return d.marketplaceCreateOffer
}

export async function getOffer(token: string, id: string): Promise<any> {
  const d = await gql<any>(token, `query($id:String!){ marketplaceGetOffer(id:$id){ ${OFFER_FIELDS} } }`, { id })
  return d.marketplaceGetOffer
}

/** Все предложения поставщика (любого статуса) — у свежего поставщика их единицы. */
export async function myOffers(token: string): Promise<any[]> {
  const d = await gql<any>(token, `query($i:MarketplaceListMyOffersInput){
    marketplaceListMyOffers(input:$i){ items { id product_name status } }
  }`, { i: { page: 1, limit: 100 } })
  return d.marketplaceListMyOffers.items
}

export async function approve(offerId: string, warrantyDays = 14): Promise<any> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), APPROVE_OFFER, { i: { offer_id: offerId, warranty_days: warrantyDays } })
  return d.marketplaceApproveOffer
}

/**
 * Оформление корзины из нескольких строк (в том числе упаковкой) — путь
 * рабочего стола: корзина → превью → оформление, заявление 1110 из превью
 * подписывается ключом пайщика.
 */
export async function checkoutLines(who: Who, lines: { offer_id: string, quantity: number, package_id?: string | null }[], braname = 'krg'): Promise<any[]> {
  const token = await tokenOf(who)
  await gql(token, 'mutation{ marketplaceClearCart{ __typename } }')
  for (const l of lines) {
    await gql(token, 'mutation($i:MarketplaceAddToCartInput!){ marketplaceAddToCart(input:$i){ __typename } }', {
      i: { offer_id: l.offer_id, quantity: l.quantity, package_id: l.package_id ?? null, delivery_braname: braname },
    })
  }
  const sp = await gql<any>(token, `query{
    marketplaceCheckoutSignablePayloads{
      lines{ offer_id package_id order_hash }
      convert{ amount membership_fee document{ full_title html hash meta binary } }
    }
  }`)
  const preview = sp.marketplaceCheckoutSignablePayloads
  const signed_convert = preview.convert ? await signDocument(who.wif, preview.convert.document, who.account, 1) : null
  const co = await gql<any>(token, `mutation($i:MarketplaceCheckoutCartInput){
    marketplaceCheckoutCart(input:$i){ fully_completed created_orders{ id offer_id status quantity } failed_lines{ reason } }
  }`, { i: { lines: preview.lines.map((p: any) => ({ offer_id: p.offer_id, package_id: p.package_id, order_hash: p.order_hash })), signed_convert } })
  const result = co.marketplaceCheckoutCart
  if (!result.fully_completed)
    throw new Error(`оформление не прошло целиком: ${JSON.stringify(result.failed_lines)}`)
  return result.created_orders
}


/**
 * Помощники наборов economy / return / supply: выданный заказ целиком, отказ
 * с кодом, чтение экономики участка. Только действия и чтение — ассерты живут
 * в тестах.
 */
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { type GqlError, gql, gqlRaw } from '../core/client'
import { amount, ensureShareFunds } from '../core/wallet'
import { KRG, acceptToCoop, issueOrder, placeOrder } from './flow'

/** Минимальный валидный PNG 1×1: фото к заявлениям о возврате обязательны. */
export const PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
export const PHOTO = { base64: PIXEL_PNG, mime_type: 'image/png' }

/** Довести паевой остаток пайщика до минимума и дождаться его в зеркале контроллера. */
export async function fundShare(who: Who, minimumRub: number): Promise<void> {
  await ensureShareFunds(who.account, minimumRub, await tokenOf(who))
}

/** Первая ошибка вызова (или null, если прошёл) — код строкой: сервер отдаёт и числа (400/403), и имена. */
export async function refusal(token: string | null, query: string, variables?: unknown): Promise<GqlError & { codeText: string } | null> {
  const r = await gqlRaw(token, query, variables)
  const e = r.errors[0]
  if (!e)
    return null
  return { ...e, codeText: String(e.code) }
}

/** Заказ пайщика, прошедший приёмку и выдачу целиком. */
export interface IssuedOrder {
  orderId: string
  orderHash: string
  /** Цена заказа за единицу. */
  unitPrice: number
  quantity: number
}

/**
 * Заказ от корзины до получения: оформление, приёмка по факту, выдача.
 * Цены приёмки и выдачи по умолчанию — цена заказа.
 */
export async function issuedOrder(args: {
  member: Who
  supplier: Who
  operator: Who
  offer: { id: string, price_per_unit: string }
  quantity: number
  receptionUnitPrice?: number
  issueUnitPrice?: number
  braname?: string
}): Promise<IssuedOrder> {
  const { member, supplier, operator, offer, quantity, braname = KRG } = args
  const unitPrice = amount(offer.price_per_unit)
  // Сумма с членским взносом не больше двойной стоимости при любой ставке ≤ 100%.
  await fundShare(member, quantity * unitPrice * 2)
  const placed = await placeOrder({ who: member, offerId: offer.id, quantity, braname })
  await acceptToCoop({
    supplier,
    operator,
    orderId: placed.orderId,
    braname,
    factQuantity: quantity,
    factUnitPrice: args.receptionUnitPrice ?? unitPrice,
  })
  await issueOrder({
    operator,
    member,
    orderId: placed.orderId,
    braname,
    actualQuantity: quantity,
    actualUnitPrice: args.issueUnitPrice ?? args.receptionUnitPrice ?? unitPrice,
  })
  return { orderId: placed.orderId, orderHash: placed.orderHash, unitPrice, quantity }
}

export const BRANCH_ECONOMY = `query($b:String!){ marketplaceGetBranchEconomy(braname:$b){
  braname total_weight common_balance reserve_amount available_to_distribute
  weights{ username weight share_percent personal_balance }
} }`

export interface BranchEconomy {
  braname: string
  total_weight: number
  common_balance: string
  reserve_amount: string
  available_to_distribute: string
  weights: { username: string, weight: number, share_percent: number, personal_balance: string }[]
}

export async function branchEconomy(token: string, braname: string): Promise<BranchEconomy> {
  const d = await gql<any>(token, BRANCH_ECONOMY, { b: braname })
  return d.marketplaceGetBranchEconomy as BranchEconomy
}

/** Персональный баланс участника из экономики участка (0, если его нет в сетке). */
export function personalOf(eco: BranchEconomy, username: string): number {
  return amount(eco.weights.find(w => w.username === username)?.personal_balance)
}

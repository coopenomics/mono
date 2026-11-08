/**
 * Помощники наборов economy / return / supply: выданный заказ целиком, отказ
 * с кодом, чтение экономики участка. Только действия и чтение — ассерты живут
 * в тестах.
 */
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { type GqlError, gql, gqlRaw } from '../core/client'
import { transact } from '../core/chain'
import { COOP } from '../core/env'
import { COOP_SIGNER, amount, ensureShareFunds, rub } from '../core/wallet'
import { ROLES } from '../core/roles'
import { KRG, acceptToCoop, getOrder, issueOrder, pickOffer, placeOrder } from './flow'

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
  // Сумма с обеспечительной частью не больше двойной стоимости при любой ставке ≤ 100%.
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

/**
 * Списание обеспечительной части выданного заказа в членский взнос участка
 * (задача 99D-18). Узел делает это сам первого числа месяца после окончания
 * гарантийного срока; набору ждать нельзя, поэтому он зовёт то же действие
 * цепи ключом кооператива — контракт сроки не проверяет, держит только
 * потолок остатка кошелька к списанию.
 */
export async function chargeSecurePart(args: { member: Who, orderId: string, orderHash: string, braname?: string }): Promise<number> {
  const order = await getOrder(await tokenOf(args.member), args.orderId)
  const securePart = amount(order.total_cost_with_fee) - amount(order.total_cost)
  await transact(COOP_SIGNER, [{
    account: 'marketplace',
    name: 'chargedue',
    authorization: [{ actor: COOP, permission: 'active' }],
    data: { coopname: COOP, username: args.member.account, braname: args.braname ?? KRG, order_hash: args.orderHash, amount: rub(securePart) },
  }])
  return securePart
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

/**
 * Членские взносы в общий кошелёк участка — настоящим путём: заказ пайщика
 * выдаётся, и его обеспечительная часть списывается участку (chargedue).
 * Обеспечительная часть невыданных заказов лежит на кошельке пайщика под
 * заказы (05.11.2026), общий пул открытыми заказами не наполняется — брать
 * взнос для участка из пула больше нечем.
 */
export async function chargeToBranch(need: number): Promise<void> {
  const member = ROLES.member()
  const offer = await pickOffer(ROLES.supplier().account, KRG, 'Мёд цветочный')
  const price = amount(offer.price_per_unit)
  // Ставка обеспечительной части не ниже 10 % — заказ с запасом покрывает нужное.
  const quantity = Math.max(1, Math.ceil(need / (price * 0.1)))
  const order = await issuedOrder({ member, supplier: ROLES.supplier(), operator: ROLES.branchChairman(), offer, quantity })
  const charged = await chargeSecurePart({ member, orderId: order.orderId, orderHash: order.orderHash })
  if (charged < need)
    throw new Error(`списание заказа ${order.orderId} дало участку ${charged} RUB, нужно ${need}`)
}

/**
 * Персональный кошелёк получателя на участке krg не меньше нужного. Вес в
 * распределении задаёт председатель участка; по умолчанию получатель — он сам.
 */
export async function ensurePersonalFunds(need: number, recipient: Who = ROLES.branchChairman()): Promise<void> {
  const chair = ROLES.branchChairman()
  const token = await tokenOf(chair)
  for (let round = 0; round < 3; round++) {
    const eco = await branchEconomy(token, KRG)
    const mine = eco.weights.find(w => w.username === recipient.account)
    const have = amount(mine?.personal_balance)
    if (have >= need)
      return
    if (!mine) {
      await gql(token, 'mutation($d:MarketplaceSetTrusteeWeightInput!){ marketplaceSetTrusteeWeight(data:$d) }', {
        d: { braname: KRG, username: recipient.account, weight: 1 },
      })
      continue
    }
    const total = Number(eco.total_weight) || Number(mine.weight)
    const toDistribute = Math.ceil((need - have) * total / Number(mine.weight)) + 1
    const reserve = amount(eco.reserve_amount)
    const common = amount(eco.common_balance)
    const shortage = toDistribute + reserve - common
    if (shortage > 0) {
      await chargeToBranch(Math.ceil(shortage) + 1)
    }
    await gql(token, 'mutation($d:MarketplaceDistributeBranchFundsInput!){ marketplaceDistributeBranchFunds(data:$d) }', {
      d: { braname: KRG, amount: toDistribute },
    })
  }
  throw new Error(`персональный кошелёк ${recipient.account} на участке не набрал ${need} RUB`)
}

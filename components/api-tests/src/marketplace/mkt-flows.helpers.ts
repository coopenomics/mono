/**
 * Помощники наборов economy / return / supply: выданный заказ целиком, отказ
 * с кодом, чтение экономики участка. Только действия и чтение — ассерты живут
 * в тестах.
 */
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { type GqlError, gql, gqlRaw } from '../core/client'
import { chainMessage, tableRows, transact } from '../core/chain'
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

/** Длина периода списания из настроек участков, секунд; ноль — календарный месяц UTC. */
async function periodSeconds(): Promise<number> {
  const rows = await tableRows<any>('branch', COOP, 'brnconfig')
  return Number(rows[0]?.aid_period_seconds ?? 0)
}

/** Номер периода момента — так же, как контракт (`Branch::aid_period`). */
function periodOf(seconds: number, at: Date): number {
  return seconds > 0 ? Math.floor(at.getTime() / 1000 / seconds) : at.getUTCFullYear() * 12 + at.getUTCMonth() + 1
}

/**
 * Списание обеспечительной части выданного заказа в членский взнос участка
 * (задачи 99D-18, 99D-33). Суммы контракт берёт из своих счётчиков: узел и
 * набор называют только пайщика, участок и период. Контракт списывает после
 * окончания периода конца гарантии, поэтому набор дожидается смены периода
 * стенда (на стенде период короткий), при нужде считает итог участка и зовёт
 * списание ключом кооператива — как крон узла.
 */
export async function chargeSecurePart(args: { member: Who, orderId: string, orderHash: string, braname?: string }): Promise<number> {
  const braname = args.braname ?? KRG
  const order = await getOrder(await tokenOf(args.member), args.orderId)
  const securePart = amount(order.total_cost_with_fee) - amount(order.total_cost)

  // Строка пайщика с наибольшим периодом — заказ, выданный последним.
  const dues = await tableRows<any>('marketplace', COOP, 'kudues', { lower: args.member.account, upper: args.member.account, index: 2, keyType: 'name' })
  const periods = dues.filter(r => r.username === args.member.account && r.braname === braname).map(r => Number(r.period))
  if (!periods.length)
    throw new Error(`у пайщика ${args.member.account} нет строки счётчика списания на участке ${braname}`)
  const period = Math.max(...periods)

  const seconds = await periodSeconds()
  if (seconds === 0)
    throw new Error('период списания — календарный месяц: дождаться его окончания в наборе нельзя, задайте brnconfig.aid_period_seconds на стенде')
  const deadline = Date.now() + 25 * 60_000
  while (periodOf(seconds, new Date()) <= period) {
    if (Date.now() > deadline)
      throw new Error(`период ${period} не закончился за 25 минут`)
    // timing: schedule — ждём смены периода стенда, факта в цепи нет: период — функция времени
    await new Promise(r => setTimeout(r, 5_000))
  }

  // Итог участка за период: если крон узла его ещё не рассчитал — считаем сами с нулевыми фактами о расходах.
  const closed = await tableRows<any>('marketplace', COOP, 'kuperiods')
  if (!closed.some(r => r.braname === braname && Number(r.period) === period)) {
    await transact(COOP_SIGNER, [{
      account: 'marketplace',
      name: 'closeperiod',
      authorization: [{ actor: COOP, permission: 'active' }],
      data: { coopname: COOP, braname, period, planned: rub(0), memos: rub(0), aid_paid: rub(0) },
    }]).catch((e) => {
      // Крон узла рассчитал итог между чтением и отправкой — списание идёт по его ставкам.
      if (!chainMessage(e).includes('MARKETPLACE_PERIOD_EXISTS'))
        throw e
    })
  }
  await transact(COOP_SIGNER, [{
    account: 'marketplace',
    name: 'chargeperiod',
    authorization: [{ actor: COOP, permission: 'active' }],
    data: { coopname: COOP, username: args.member.account, braname, period },
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
 * выдаётся, и его обеспечительная часть списывается участку по окончании
 * периода (chargeperiod по строке счётчика пайщика, задача 99D-33).
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

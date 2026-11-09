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
import { KRG, acceptToCoop, getOrder, issueOrder, placeOrder } from './flow'
import { BRANCH_INVESTMENT, ensureAgreement, investMoney } from './invest.helpers'

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

/** Период строки счётчика пайщика на участке — наибольший: заказ, выданный последним. */
async function memberRowPeriod(member: Who, braname: string): Promise<number> {
  const dues = await tableRows<any>('marketplace', COOP, 'kudues', { lower: member.account, upper: member.account, index: 2, keyType: 'name' })
  const periods = dues.filter(r => r.username === member.account && r.braname === braname).map(r => Number(r.period))
  if (!periods.length)
    throw new Error(`у пайщика ${member.account} нет строки счётчика списания на участке ${braname}`)
  return Math.max(...periods)
}

/** Строка счётчика пайщика за период ещё в цепи. */
async function memberRowExists(member: Who, braname: string, period: number): Promise<boolean> {
  const dues = await tableRows<any>('marketplace', COOP, 'kudues', { lower: member.account, upper: member.account, index: 2, keyType: 'name' })
  return dues.some(r => r.username === member.account && r.braname === braname && Number(r.period) === period)
}

/**
 * Списание обеспечительной части выданного заказа в членский взнос участка
 * (задачи 99D-18, 99D-33). Суммы контракт берёт из своих счётчиков: узел и
 * набор называют только пайщика, участок и период. Контракт списывает после
 * окончания периода конца гарантии, поэтому набор дожидается смены периода
 * стенда (на стенде период короткий), при нужде считает итог участка и зовёт
 * списание ключом кооператива — как крон узла.
 *
 * Крон узла работает в той же фазе и мог посчитать итог и списать строку
 * раньше набора: тогда итог уже есть (MARKETPLACE_PERIOD_EXISTS), а строки
 * нет (MARKETPLACE_DUE_NOT_FOUND) — списание состоялось, это не сбой.
 * `planned` — плановые расходы участка, которые набор передаёт в итог, если
 * считает его сам (узел берёт их из реестра планов).
 */
export async function chargeSecurePart(args: { member: Who, orderId: string, orderHash: string, braname?: string, planned?: number }): Promise<number> {
  const braname = args.braname ?? KRG
  const order = await getOrder(await tokenOf(args.member), args.orderId)
  const securePart = amount(order.total_cost_with_fee) - amount(order.total_cost)
  const period = await memberRowPeriod(args.member, braname)

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

  // Итог участка за период: если крон узла его ещё не рассчитал — считаем сами.
  const closed = await tableRows<any>('marketplace', COOP, 'kuperiods')
  if (!closed.some(r => r.braname === braname && Number(r.period) === period)) {
    await transact(COOP_SIGNER, [{
      account: 'marketplace',
      name: 'closeperiod',
      authorization: [{ actor: COOP, permission: 'active' }],
      data: { coopname: COOP, braname, period, planned: rub(args.planned ?? 0), memos: rub(0), aid_paid: rub(0) },
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
  }]).catch(async (e) => {
    // Крон узла списал строку раньше набора — строки в цепи больше нет.
    if (!chainMessage(e).includes('MARKETPLACE_DUE_NOT_FOUND') || await memberRowExists(args.member, braname, period))
      throw e
  })
  return securePart
}

const CREATE_PLAN = 'mutation($d:CreateExpensePlanInput!){ createExpensePlan(data:$d){ id } }'
const DELETE_PLAN = 'mutation($d:DeleteExpensePlanInput!){ deleteExpensePlan(data:$d) }'

/**
 * Списание, которое наполняет общий кошелёк участка. Участок получает из
 * обеспечительной части только свои расходы периода — плановые расходы,
 * служебные записки и резерв помощи (формула итога, 99D-21); без расходов
 * всё после фондов — экономия инициатору и пайщику. Набор заводит плановый
 * расход на сумму обеспечительной части со сроком в периоде строки: итог,
 * кто бы его ни посчитал — набор или крон узла, — отдаёт её участку. После
 * списания план стирается, чтобы не держать резерв расходов.
 */
export async function chargeIntoCommon(args: { member: Who, orderId: string, orderHash: string }): Promise<number> {
  const chair = ROLES.branchChairman()
  const token = await tokenOf(chair)
  const order = await getOrder(await tokenOf(args.member), args.orderId)
  const securePart = amount(order.total_cost_with_fee) - amount(order.total_cost)
  const period = await memberRowPeriod(args.member, KRG)
  const seconds = await periodSeconds()
  const start = period * seconds * 1000
  const end = (period + 1) * seconds * 1000
  const due = Math.max(Date.now() + 30_000, start + 5_000)
  if (due >= end)
    throw new Error(`срок планового расхода не помещается в период ${period}`)
  const plan = await gql<any>(token, CREATE_PLAN, {
    d: { braname: KRG, title: `Внешний слой: расход периода ${period}`, amount: securePart, due_date: new Date(due).toISOString(), pay_to: 'Получатель по договору, р/с 40702810000000000001' },
  })
  try {
    return await chargeSecurePart({ ...args, planned: securePart })
  } finally {
    await gql(token, DELETE_PLAN, { d: { plan_id: Number(plan.createExpensePlan.id) } }).catch(() => {})
  }
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
 * Деньги под заявление на материальную помощь (createaid, задача 99D-28).
 * Контракт берёт помощь с персонального кошелька получателя на участке, а при
 * нехватке — из свободных средств инициаторов участка. Набор пополняет вторые
 * денежным взносом председателя участка: без списания заказа и без ожидания
 * конца периода, в любой фазе стенда.
 */
export async function ensureAidFunds(gross: number, recipient: Who = ROLES.branchChairman()): Promise<void> {
  const chair = ROLES.branchChairman()
  const token = await tokenOf(chair)
  if (personalOf(await branchEconomy(token, KRG), recipient.account) >= gross)
    return
  const view = (await gql<any>(token, BRANCH_INVESTMENT, { b: KRG })).marketplaceBranchInvestment
  const free = amount(view.unused_total) - amount(view.reserved)
  if (free >= gross)
    return
  const need = Math.ceil(gross - free) + 1
  await ensureAgreement(chair)
  await ensureShareFunds(chair.account, need, token)
  await investMoney(chair, KRG, need)
}

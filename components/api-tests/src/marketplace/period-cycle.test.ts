/**
 * Коэффициент экономического участия — полный цикл снаружи, через API и цепь
 * (задача 99D-23, документ модели dd5bf19e, разделы 5–9, 16).
 *
 * Набор ходит только на стенде со сжатым временем: прогон первого числа делает
 * крон узла по шкале STAND_MONTH_SECONDS, и тест ждёт его. Полигон blackbox
 * живёт в настоящем времени, поэтому без переменной BLACKBOX_STAND_MONTH_SECONDS
 * набор пропускается целиком (scripts/blackbox/stack.sh пробрасывает её из
 * STAND_MONTH_SECONDS вместе с STAND_DAY_SECONDS в окружение контроллера).
 *
 * Стенд общий: в прогон участка krg попадают и заказы соседних наборов, поэтому
 * абсолютные суммы итога месяца не утверждаются. Утверждаются: формулы
 * контракта по строке итога (У = min(C, РК), Ф = (C − У) × p, Э = C − У − Ф,
 * И = Э × φ, В = Э − И), ставки по строке, разбивка наших заказов по этим
 * ставкам, предел материальной помощи по резерву и возвраты пайщикам.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, ROLES, amount, caseName, gql, tableRows, tokenOf, waitFor } from '../core'
import { KRG, pickOffer } from './flow'
import { type IssuedOrder, issuedOrder, refusal } from './mkt-flows.helpers'

const STAND_MONTH_SECONDS = Number(process.env.BLACKBOX_STAND_MONTH_SECONDS) || 0
const COMPRESSED = STAND_MONTH_SECONDS > 0

const chairkrg = ROLES.branchChairman()
const ekaterina = ROLES.member()
const ivanpetrov = ROLES.otherMember()
const sidorov = ROLES.supplier()

const SETTINGS = 'query{ marketplaceGetEconomySettings{ membership_fee_percent initiator_share_percent aid_month_limit funds_percent funds{ name percent wallet_name } } }'
const SET_INITIATOR_SHARE = 'mutation($d:MarketplaceSetInitiatorShareInput!){ marketplaceSetInitiatorShare(data:$d){ initiator_share_percent } }'
const SET_AID_LIMIT = 'mutation($d:MarketplaceSetAidLimitInput!){ marketplaceSetAidLimit(data:$d){ aid_month_limit } }'
const RESERVES = 'query($b:String!){ marketplaceGetBranchReserves(braname:$b){ braname limit rows{ username amount submitted remaining } } }'
const SET_RESERVE = 'mutation($d:MarketplaceSetBranchReserveInput!){ marketplaceSetBranchReserve(data:$d){ rows{ username amount remaining } } }'
const DEL_RESERVE = 'mutation($d:MarketplaceDeleteBranchReserveInput!){ marketplaceDeleteBranchReserve(data:$d){ rows{ username } } }'
const PERIODS = `query($b:String!,$o:PaginationInput){ marketplaceListBranchPeriods(braname:$b, options:$o){ items{
  period turnover secured planned memos aid_paid aid_reserve aid_unpaid planned_target target target_prev target_funded expenses membership funds_amount branch_amount
  initiator_amount return_amount deficit rate_percent initiator rows_total rows_charged archived } } }`
const CURRENT = 'query($b:String!){ marketplaceGetBranchCurrentPeriod(braname:$b){ period planned memos aid_paid aid_reserve planned_target target_prev expenses ripening_orders ripening_turnover ripening_secured } }'
const INITIATOR = 'query($b:String!){ marketplaceGetBranchInitiator(braname:$b){ username assigned invest_balance } }'
const SECURE_PART = 'query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ secure_part{ state amount due_amount charged_amount returned_amount rate_percent settled_at } } }'

const H = 1_000_000n
const units = (asset: string | number): bigint => BigInt(Math.round(amount(asset) * 10_000))
const percentUnits = (percent: number): bigint => BigInt(Math.round(percent * 10_000))

/** Период стенда по его ключу: месяц сжатого времени — отрезок STAND_MONTH_SECONDS. */
function standPeriodNow(): number {
  return Math.floor(Date.now() / 1000 / STAND_MONTH_SECONDS)
}

/** Сколько секунд осталось до первого числа стенда. */
function secondsLeftInStandMonth(): number {
  return STAND_MONTH_SECONDS - ((Date.now() / 1000) % STAND_MONTH_SECONDS)
}

/**
 * Два заказа с приёмкой и выдачей обязаны лечь в один месяц стенда: итог месяца
 * считается по заказам, выданным до первого числа. Столько секунд на них
 * нужно с запасом; если до конца месяца осталось меньше — набор ждёт начала
 * следующего.
 */
const ORDERS_BUDGET_SECONDS = Math.min(240, Math.floor(STAND_MONTH_SECONDS / 2))

/** Месяц стенда, в котором выданы заказы набора: по нему ищется строка итога. */
let ordersPeriod = 0

let chairmanToken = ''
let krgToken = ''
let memberToken = ''
let otherToken = ''
let settings: any = null
const RESERVE_CHAIR = 200_000
const RESERVE_TRUSTED = 100_000

describe.skipIf(!COMPRESSED)('коэффициент экономического участия — полный цикл на стенде со сжатым временем', () => {
  let orders: IssuedOrder[] = []
  let periodRow: any = null

  beforeAll(async () => {
    chairmanToken = await tokenOf(CHAIRMAN)
    krgToken = await tokenOf(chairkrg)
    memberToken = await tokenOf(ekaterina)
    otherToken = await tokenOf(ivanpetrov)
  })

  afterAll(async () => {
    // Снимаем свои строки резерва, чтобы соседние наборы с материальной помощью не упёрлись в предел.
    for (const username of [chairkrg.account]) {
      await gql(krgToken, DEL_RESERVE, { d: { braname: KRG, username } }).catch(() => {})
    }
  })

  it(caseName('mkt.order.keu.api.01', 'администратор задаёт долю инициатора и потолок резерва; настройки читаются с процентами фондов'), async () => {
    const share = await gql<any>(chairmanToken, SET_INITIATOR_SHARE, { d: { initiator_share_percent: 61.8 } })
    expect(share.marketplaceSetInitiatorShare.initiator_share_percent).toBeCloseTo(61.8, 4)
    const limit = await gql<any>(chairmanToken, SET_AID_LIMIT, { d: { aid_month_limit: RESERVE_CHAIR } })
    expect(amount(limit.marketplaceSetAidLimit.aid_month_limit)).toBeCloseTo(RESERVE_CHAIR, 4)

    settings = (await gql<any>(chairmanToken, SETTINGS)).marketplaceGetEconomySettings
    expect(settings.initiator_share_percent).toBeCloseTo(61.8, 4)
    expect(settings.funds_percent, 'проценты фондов складываются из строк').toBeCloseTo(
      settings.funds.reduce((s: number, f: any) => s + Number(f.percent), 0), 4,
    )

    const over = await refusal(chairmanToken, SET_INITIATOR_SHARE, { d: { initiator_share_percent: 101 } })
    expect(over, 'доля выше 100 % отклоняется до цепи').toBeTruthy()
  })

  it(caseName('mkt.order.keu.api.02', 'председатель участка задаёт резерв получателям; выше потолка и постороннему — отказ'), async () => {
    const mine = await gql<any>(krgToken, SET_RESERVE, { d: { braname: KRG, username: chairkrg.account, amount: RESERVE_CHAIR } })
    expect(mine.marketplaceSetBranchReserve.rows.find((r: any) => r.username === chairkrg.account)).toBeTruthy()

    const over = await refusal(krgToken, SET_RESERVE, { d: { braname: KRG, username: chairkrg.account, amount: RESERVE_CHAIR + 1 } })
    expect(over?.codeText ?? '').toMatch(/BRANCH_RESERVE_OVER_LIMIT|400/)
    const stranger = await refusal(krgToken, SET_RESERVE, { d: { braname: KRG, username: ekaterina.account, amount: 10 } })
    expect(stranger?.codeText ?? '').toMatch(/MARKETPLACE_RESERVE_RECIPIENT_NOT_TRUSTED|BRANCH_RESERVE_NOT_TRUSTED|400/)

    const reserves = (await gql<any>(krgToken, RESERVES, { b: KRG })).marketplaceGetBranchReserves
    expect(amount(reserves.limit)).toBeCloseTo(RESERVE_CHAIR, 4)
    const row = reserves.rows.find((r: any) => r.username === chairkrg.account)
    expect(amount(row.amount)).toBeCloseTo(RESERVE_CHAIR, 4)
    // Доступно — накопленное право получателя (задача 99D-34): копится каждый месяц, невзятое не сгорает.
    expect(amount(row.remaining), 'доступно — накопленное право, не меньше нуля').toBeGreaterThanOrEqual(0)
  })

  it(caseName('mkt.order.keu.api.03', 'два заказа на участке выданы; текущий месяц показывает их как созревающие'), async () => {
    const offer = await pickOffer(sidorov.account, KRG)
    if (secondsLeftInStandMonth() < ORDERS_BUDGET_SECONDS) {
      // timing: schedule — ждём первое число стенда, чтобы оба заказа были выданы в одном месяце
      await new Promise(resolve => setTimeout(resolve, (secondsLeftInStandMonth() + 2) * 1000))
    }
    ordersPeriod = standPeriodNow()
    orders = [
      await issuedOrder({ member: ekaterina, supplier: sidorov, operator: chairkrg, offer, quantity: 1 }),
      await issuedOrder({ member: ivanpetrov, supplier: sidorov, operator: chairkrg, offer, quantity: 2 }),
    ]
    expect(standPeriodNow(), 'оба заказа выданы в одном месяце стенда').toBe(ordersPeriod)
    const current = (await gql<any>(krgToken, CURRENT, { b: KRG })).marketplaceGetBranchCurrentPeriod
    expect(current.ripening_orders, 'наши заказы без гарантии созреют к первому числу').toBeGreaterThanOrEqual(2)
    expect(amount(current.aid_reserve), 'право получателей помощи на следующий месяц — не меньше суммы строки').toBeGreaterThanOrEqual(RESERVE_CHAIR)
    // Ожидаемые расходы по цели резерва: траты месяца + цель − собранное прошлым итогом, не меньше нуля.
    const expected = amount(current.planned) + amount(current.memos) + amount(current.aid_paid) + amount(current.planned_target) + amount(current.aid_reserve) - amount(current.target_prev)
    expect(amount(current.expenses)).toBeCloseTo(Math.max(0, expected), 4)
  }, 600_000)

  it(caseName('mkt.order.keu.api.04', 'первое число: итог месяца участка сходится по формулам контракта и ставкам'), async () => {
    // Строка итога — за месяц, в котором выданы заказы; её пишет первый проход следующего месяца.
    const period = ordersPeriod
    periodRow = await waitFor(async () => {
      const d = await gql<any>(krgToken, PERIODS, { b: KRG, o: { page: 1, limit: 5, sortOrder: 'DESC' } })
      return (d.marketplaceListBranchPeriods.items as any[]).find(r => Number(r.period) === period) ?? null
    }, { timeoutMs: STAND_MONTH_SECONDS * 2_500, intervalMs: 3_000, label: 'итог месяца участка krg' })

    const C = units(periodRow.secured)
    const RK = units(periodRow.expenses)
    const U = C < RK ? C : RK
    const p = percentUnits(settings.funds_percent)
    const F = (C - U) * p / H
    const E = C - U - F
    const I = E * percentUnits(settings.initiator_share_percent) / H
    expect(units(periodRow.branch_amount), 'У = min(C, РК)').toBe(U)
    expect(units(periodRow.deficit), 'Д = РК − У').toBe(RK - U)
    expect(units(periodRow.funds_amount), 'Ф = (C − У) × p').toBe(F)
    expect(units(periodRow.membership), 'М = У + Ф').toBe(U + F)
    expect(units(periodRow.initiator_amount), 'И = Э × φ').toBe(I)
    expect(units(periodRow.return_amount), 'В = Э − И').toBe(E - I)
    // Расходы по цели резерва (задача 99D-34): РК = траты месяца + T − F_пр, не меньше нуля;
    // T = цель плановых расходов + право получателей помощи; F = max(0, T − Д) + излишек прошлого сбора.
    const target = units(periodRow.planned_target) + units(periodRow.aid_reserve)
    expect(units(periodRow.target), 'T = ЦП + ЦМ').toBe(target)
    const raw = [periodRow.planned, periodRow.memos, periodRow.aid_paid].map(units).reduce((a, b) => a + b, 0n) + target - units(periodRow.target_prev)
    expect(units(periodRow.expenses), 'РК = ПО + СЗ + МП + T − F_пр').toBe(raw > 0n ? raw : 0n)
    // Излишек прошлого сбора (собрано больше, чем понадобилось) переходит дальше.
    const surplus = raw < 0n ? -raw : 0n
    expect(units(periodRow.target_funded), 'F = max(0, T − Д) + излишек').toBe((target > RK - U ? target - (RK - U) : 0n) + surplus)
    const T = units(periodRow.turnover)
    const rate = (U + F + I) * H / T
    // Ставка в строке — проценты с двумя знаками, расчётная — доли шкалы контракта (1 000 000 = 100 %).
    expect(Number(periodRow.rate_percent.replace(',', '.')), 'коэффициент экономического участия = (У + Ф + И) / T').toBeCloseTo(Number(rate) / 10_000, 1)
    expect(periodRow.rows_total).toBeGreaterThanOrEqual(2)
  }, 60 * 60_000)

  it(caseName('mkt.order.keu.api.05', 'строки учёта обоих заказов закрыты по ставке итога; возврат пайщикам сходится с строкой'), async () => {
    for (const [i, order] of orders.entries()) {
      const token = i === 0 ? memberToken : otherToken
      const part = await waitFor(async () => {
        const d = await gql<any>(token, SECURE_PART, { i: { order_id: order.orderId } })
        const sp = d.marketplaceGetOrder.secure_part
        return sp && sp.state === 'CHARGED' ? sp : null
      }, { timeoutMs: 180_000, intervalMs: 3_000, label: `списание заказа ${order.orderId}` })
      const base = units(String(order.unitPrice * order.quantity))
      const expectedCharged = base * (units(periodRow.branch_amount) + units(periodRow.funds_amount) + units(periodRow.initiator_amount)) * H / units(periodRow.turnover) / H
      // Части считаются по ставкам в единицах; остаток округления достаётся пайщику.
      expect(Number(units(part.charged_amount) - expectedCharged), 'списано по трём ставкам').toBeLessThanOrEqual(3)
      expect(units(part.charged_amount) + units(part.returned_amount), 'списано + возвращено = обеспечительная часть').toBe(units(part.amount))
      expect(part.rate_percent, 'ставка месяца в карточке').toBe(periodRow.rate_percent)
    }
    const initiator = (await gql<any>(krgToken, INITIATOR, { b: KRG })).marketplaceGetBranchInitiator
    expect(initiator.username, 'без назначения долю получает председатель участка').toBe(chairkrg.account)
    // С 99D-27 доля инициаторов возмещает паевые взносы участка (кошелёк возмещения)
    // либо направляется участку; кошелёк договора участия пополняют только паевые взносы.
    expect(amount(initiator.invest_balance)).toBeGreaterThanOrEqual(0)
  }, 240_000)

  it(caseName('mkt.order.keu.api.06', 'строки прогонов в цепи — не больше двух на участок; на узле история остаётся'), async () => {
    const rows = await tableRows<any>('marketplace', COOP, 'kuperiods')
    expect(rows.filter(r => r.braname === KRG).length).toBeLessThanOrEqual(2)
    const mirrored = (await gql<any>(krgToken, PERIODS, { b: KRG, o: { page: 1, limit: 20, sortOrder: 'DESC' } })).marketplaceListBranchPeriods.items as any[]
    expect(mirrored.length).toBeGreaterThanOrEqual(1)
  })
})

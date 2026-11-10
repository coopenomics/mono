/**
 * Эталон расчёта итога месяца кооперативного участка и списания обеспечительной
 * части по ставкам (коэффициент экономического участия, задачи 99D-21 и 99D-22).
 *
 * Источник истины — контракт: `marketplace::closeperiod`, `marketplace::chargeperiod`
 * и `fund::accrue`. Этот модуль повторяет их арифметику шаг в шаг — целые единицы
 * актива, деление вниз, тот же порядок действий — и нужен для двух дел:
 *  - тесты сверяют с ним строку итога и части списания, которые посчитал контракт;
 *  - сервер показывает по нему ожидаемый расчёт до транзакции.
 * Суммы для цепи по нему не считают: ИСТОК передаёт контракту факты, делит контракт.
 *
 * Все суммы — в единицах актива (четыре знака: 1 ₽ = 10 000), проценты и ставки —
 * в долях `HUNDR_PERCENTS` (1 000 000 = 100 %).
 */

/** Контрактная шкала процентов: 1 000 000 = 100 %. */
export const HUNDR_PERCENTS = BigInt(1_000_000)

const ZERO = BigInt(0)

/** Факты прогона: пять чисел от ИСТОКА и четыре числа из таблиц цепи. */
export interface IPeriodFacts {
  /** T — стоимость заказов прогона. */
  turnover: bigint
  /** C — собранная по ним обеспечительная часть. */
  secured: bigint
  /** ПР — плановые расходы участка за месяц. */
  planned: bigint
  /** СЗ — служебные записки сверх плана за месяц. */
  memos: bigint
  /** МП — материальная помощь, выплаченная за месяц. */
  aidPaid: bigint
  /** Р — сумма строк резерва социально-экономического обеспечения участка. */
  reserve: bigint
  /** Р_пр — резерв из строки прошлого прогона участка; строки нет — ноль. */
  reservePrev: bigint
  /** p — сумма процентов фондов накопления кооператива. */
  fundsPercent: bigint
  /**
   * ЦП — цель плановых расходов (задача 99D-34). Задана — расчёт по цели
   * резерва: `planned` — оплачено по плану, `memos` и `aidPaid` — траты из
   * денег участка, `reserve` — ЦМ, накопленное право получателей помощи на
   * следующий период, `fundedPrev` — собранная часть цели прошлой строки.
   * Не задана — прежняя формула с невыплаченной частью прошлого резерва.
   */
  plannedTarget?: bigint
  /** F_пр — собранная часть цели прошлой строки участка; строки нет — ноль. */
  fundedPrev?: bigint
  /** φи — доля инициатора в экономии. */
  initiatorPercent: bigint
}

/** Строка итога месяца так, как её записывает контракт. */
export interface IPeriodTotals {
  /** Н — невыплаченная часть прошлого резерва; по цели резерва — ноль. */
  unpaid: bigint
  /** T — цель резерва участка; по прежней формуле — ноль. */
  target: bigint
  /** F — собранная часть цели вместе с излишком прошлого сбора; по прежней формуле — ноль. */
  funded: bigint
  /** РК — расходы участка за прогон. */
  expenses: bigint
  /** У — участку на расходы. */
  branch: bigint
  /** Д — дефицит участка. */
  deficit: bigint
  /** Ф — в фонды накопления. */
  funds: bigint
  /** М — членский взнос участка. */
  membership: bigint
  /** Э — экономия. */
  economy: bigint
  /** И — инициатору. */
  initiator: bigint
  /** В — пайщикам обратно. */
  returned: bigint
  rateBranch: bigint
  rateFunds: bigint
  rateInitiator: bigint
}

/** Ставки строки итога, по которым делится списание заказа. */
export type IPeriodRates = Pick<IPeriodTotals, 'rateBranch' | 'rateFunds' | 'rateInitiator'>

/** Части списания одного заказа. */
export interface IChargeParts {
  branch: bigint
  funds: bigint
  initiator: bigint
  /** Возврат пайщику на свободный паевой. */
  returned: bigint
  /** Списано в членский взнос: участку, в фонды и инициатору вместе. */
  charged: bigint
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

/**
 * Расчёт `closeperiod`: расходы участка первыми, из остатка проценты фондов,
 * остаток делят инициатор и пайщики. С задачи 99D-34 расходы — по цели резерва:
 * РК = траты из денег участка + T − F_пр, собранная часть цели
 * F = max(0, T − Д) + излишек, где излишек = max(0, F_пр − траты − T): собранное
 * прошлым итогом сверх нужного переходит дальше и не собирается второй раз.
 */
export function closePeriod(facts: IPeriodFacts): IPeriodTotals {
  const byTarget = facts.plannedTarget !== undefined
  const target = byTarget ? (facts.plannedTarget as bigint) + facts.reserve : ZERO
  const unpaid = byTarget ? ZERO : (facts.reservePrev > facts.aidPaid ? facts.reservePrev - facts.aidPaid : ZERO)
  const rawExpenses = byTarget
    ? facts.planned + facts.memos + facts.aidPaid + target - (facts.fundedPrev ?? ZERO)
    : facts.planned + facts.memos + facts.reserve - unpaid
  const expenses = rawExpenses > ZERO ? rawExpenses : ZERO
  // Собрано прошлым итогом больше, чем понадобилось: излишек остаётся
  // собранной частью цели и уменьшает расходы следующих месяцев.
  const surplus = byTarget && rawExpenses < ZERO ? -rawExpenses : ZERO

  const branch = min(expenses, facts.secured)
  const deficit = expenses - branch
  const afterExpenses = facts.secured - branch
  const funds = afterExpenses * facts.fundsPercent / HUNDR_PERCENTS
  const membership = branch + funds
  const economy = afterExpenses - funds
  const initiator = economy * facts.initiatorPercent / HUNDR_PERCENTS
  const returned = economy - initiator

  const rate = (part: bigint) => (facts.turnover > ZERO ? part * HUNDR_PERCENTS / facts.turnover : ZERO)
  const funded = (byTarget && target > deficit ? target - deficit : ZERO) + surplus
  return {
    unpaid,
    target,
    funded,
    expenses,
    branch,
    deficit,
    funds,
    membership,
    economy,
    initiator,
    returned,
    rateBranch: rate(branch),
    rateFunds: rate(funds),
    rateInitiator: rate(initiator),
  }
}

/**
 * Расчёт `chargeperiod` по одному заказу: `amount` — остаток обеспечительной
 * части заказа, `base` — стоимость заказа. Остатки округления достаются пайщику.
 * Если ставка заказа была ниже ставки прогона, части уменьшаются по порядку:
 * возврат, инициатору, фонды, участку.
 */
export function chargeOrder(rates: IPeriodRates, amount: bigint, base: bigint): IChargeParts {
  const part = (rate: bigint) => base * rate / HUNDR_PERCENTS
  let branch = part(rates.rateBranch)
  let funds = part(rates.rateFunds)
  let initiator = part(rates.rateInitiator)
  let returned = amount - branch - funds - initiator

  if (returned < ZERO) {
    let shortfall = -returned
    returned = ZERO
    const take = (from: bigint): bigint => {
      const cut = min(shortfall, from)
      shortfall -= cut
      return from - cut
    }
    initiator = take(initiator)
    funds = take(funds)
    branch = take(branch)
  }
  return { branch, funds, initiator, returned, charged: branch + funds + initiator }
}

/**
 * Расчёт `chargeperiod` по строке счётчика пайщика за период (задача 99D-33):
 * `due` — обеспечительная часть к списанию по ставкам, `turnover` — стоимость
 * выданных заказов строки, `retained` — удержания при отказе, которые целиком
 * достаются участку и в ставки не входят. Строка без стоимости (одни удержания)
 * ставок не требует.
 */
export function chargeRow(rates: IPeriodRates, due: bigint, turnover: bigint, retained: bigint): IChargeParts {
  const parts = turnover > ZERO
    ? chargeOrder(rates, due, turnover)
    : { branch: ZERO, funds: ZERO, initiator: ZERO, returned: due, charged: ZERO }
  const branch = parts.branch + retained
  return { ...parts, branch, charged: branch + parts.funds + parts.initiator }
}

/**
 * Строка-основание хэша нитки списания (`Marketplace::Dues::charge_hash`):
 * sha256 от неё — хэш процесса p.mkt.due строки счётчика. Хэширует вызывающий:
 * у пакета типов нет зависимости от криптографии.
 */
export function chargeProcessSeed(coopname: string, username: string, braname: string, period: number): string {
  return `p.mkt.due:${coopname}:${username}:${braname}:${period}`
}

/**
 * Расчёт `fund::accrue`: сумма отчислений делится между фондами накопления по
 * их процентам в порядке номеров; фонды с нулевым процентом не участвуют,
 * остаток округления достаётся последнему. Возвращает доли в порядке `percents`.
 */
export function splitFunds(amount: bigint, percents: bigint[]): bigint[] {
  const total = percents.reduce((sum, p) => sum + p, ZERO)
  let last = -1
  percents.forEach((p, i) => {
    if (p > ZERO)
      last = i
  })
  let distributed = ZERO
  return percents.map((p, i) => {
    if (p <= ZERO)
      return ZERO
    const share = i === last ? amount - distributed : amount * p / total
    distributed += share
    return share
  })
}

/** Коэффициент экономического участия месяца: участку, в фонды и инициатору вместе — доля стоимости заказа. */
export function chargeRate(rates: IPeriodRates): bigint {
  return rates.rateBranch + rates.rateFunds + rates.rateInitiator
}

// ── Возврат паевых взносов инициаторам (CRPS), задача 99D-27 ──────────────────
//
// Повторяет `lib/core/marketplace/invest.hpp` шаг в шаг: единицы инициатора —
// использованный паевой взнос (имущество с момента приёма, деньги по мере расхода
// пула), база участка — сумма единиц активных инициаторов, счётчик `acc` —
// возвращено на единицу базы × CRPS_SCALE. Деление вниз, uint128 → bigint.

/** Точность счётчика возврата. */
export const CRPS_SCALE = BigInt(1_000_000_000_000)

/** Строка участка: то, что нужно расчёту из `invbranches`. */
export interface ICrpsBranch {
  base: bigint
  acc: bigint
  sJoin: bigint
  sFixed: bigint
  unusedTotal: bigint
  reserved: bigint
  /**
   * Σ использованных денег активных инициаторов — денежная часть базы
   * (`base_money`). Не задана — ноль, как у строки прежней сборки.
   */
  baseMoney?: bigint
}

/** Строка инициатора: то, что нужно расчёту из `investors`. */
export interface ICrpsInvestor {
  active: boolean
  money: bigint
  property: bigint
  usedMoney: bigint
  claimed: bigint
  returnedFixed: bigint
  accJoin: bigint
}

const unitsOf = (i: ICrpsInvestor): bigint => i.usedMoney + i.property

/** Возвращено инициатору при текущем счётчике участка. */
export function crpsReturned(i: ICrpsInvestor, acc: bigint): bigint {
  const u = unitsOf(i)
  if (!i.active || u <= ZERO)
    return i.returnedFixed
  return i.returnedFixed + (u * (acc - i.accJoin)) / CRPS_SCALE
}

/** Непогашенный остаток использованного по участку. */
export function crpsOutstanding(b: ICrpsBranch): bigint {
  if (b.base <= ZERO)
    return ZERO
  const left = b.base - b.sFixed - (b.base * b.acc - b.sJoin) / CRPS_SCALE
  return left > ZERO ? left : ZERO
}

/**
 * Доля инициаторов из списания: сколько возмещает паевые взносы, сколько — на
 * общий кошелёк участка, и новый счётчик (`route_initiator_share`).
 */
/**
 * Доля денег в сумме возмещения (`split_repay`): пропорционально денежной части
 * в единицах, вниз; остаток округления — доле имущества.
 */
export function crpsMoneyShare(amount: bigint, moneyUnits: bigint, units: bigint): bigint {
  if (amount <= ZERO || units <= ZERO)
    return ZERO
  const m = moneyUnits > units ? units : (moneyUnits > ZERO ? moneyUnits : ZERO)
  return (amount * m) / units
}

/**
 * Маршрут доли инициаторов в списании (`route_initiator_share`): возмещение,
 * остаток участку, новый счётчик и погашение 26 (`o.mkt.icover`, Дт 86 / Кт 26)
 * — доля денег в возмещении; имущество 26 не гасит. Сторно на переплату
 * завершивших возврат считается по их строкам и здесь не входит.
 */
export function crpsRoute(b: ICrpsBranch, share: bigint): { repay: bigint, toBranch: bigint, acc: bigint, cover: bigint } {
  const left = crpsOutstanding(b)
  const repay = b.base > ZERO ? (share < left ? share : left) : ZERO
  const acc = repay > ZERO ? b.acc + (repay * CRPS_SCALE) / b.base : b.acc
  const cover = crpsMoneyShare(repay, b.baseMoney ?? ZERO, b.base)
  return { repay, toBranch: share - repay, acc, cover }
}

/**
 * Сколько инициатор вправе транслировать в главный паевой сейчас
 * (`claimable_of`): возвращённое минус забранное и, когда возврат завершён или
 * участку нечего возвращать, неиспользованные деньги.
 */
export function crpsClaimable(b: ICrpsBranch, i: ICrpsInvestor): { returned: bigint, unused: bigint, total: bigint } {
  const u = unitsOf(i)
  let r = crpsReturned(i, b.acc)
  if (r > u)
    r = u
  let returned = r - i.claimed
  if (returned < ZERO)
    returned = ZERO
  let unused = ZERO
  const unusedOwn = i.money - i.usedMoney
  if ((!i.active || b.base <= ZERO) && unusedOwn > ZERO) {
    unused = unusedOwn
    // Выделенное под расход и ещё не оплаченное держит неиспользованное у
    // любого инициатора — и у завершившего возврат.
    const free = b.unusedTotal - b.reserved
    if (unused > free)
      unused = free > ZERO ? free : ZERO
  }
  return { returned, unused, total: returned + unused }
}

/** Строка резерва получателя помощи — поля, по которым считается накопленное право. */
export interface IReserveRight {
  /** Сумма строки — начисление права за период. */
  amount: bigint
  /** Период, по который право начислено; нет — строка до 99D-34. */
  accruedPeriod?: number
  /** Право на период `accruedPeriod`: начислено минус подано. */
  outstanding?: bigint
}

/**
 * Накопленное право получателя на материальную помощь на период `now` — как
 * `Branch::outstanding_of` (задача 99D-34): остаток плюс сумма строки за каждый
 * прошедший период. Строка до 99D-34 — сумма строки минус `legacyUsed`,
 * поданное за текущий период по накопителю `aidmonths`.
 */
export function reserveRight(row: IReserveRight, now: number, legacyUsed: bigint = ZERO): bigint {
  if (row.accruedPeriod === undefined || row.outstanding === undefined)
    return row.amount > legacyUsed ? row.amount - legacyUsed : ZERO
  // Разрыв больше MAX_ACCRUAL_GAP или номер меньше прежнего — смена режима
  // нумерации периодов (стенд), а не прошедшее время: право не доначисляется.
  const gap = now - row.accruedPeriod
  const elapsed = gap > 0 && gap <= MAX_ACCRUAL_GAP ? BigInt(gap) : ZERO
  return row.outstanding + row.amount * elapsed
}

/** Наибольший разрыв периодов, за который доначисляется право получателя помощи (`Branch::MAX_ACCRUAL_GAP`). */
export const MAX_ACCRUAL_GAP = 1200

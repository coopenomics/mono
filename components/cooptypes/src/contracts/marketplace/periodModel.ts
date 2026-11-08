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
  /** φи — доля инициатора в экономии. */
  initiatorPercent: bigint
}

/** Строка итога месяца так, как её записывает контракт. */
export interface IPeriodTotals {
  /** Н — невыплаченная часть прошлого резерва. */
  unpaid: bigint
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

/** Расчёт `closeperiod`: расходы участка первыми, из остатка проценты фондов, остаток делят инициатор и пайщики. */
export function closePeriod(facts: IPeriodFacts): IPeriodTotals {
  const unpaid = facts.reservePrev > facts.aidPaid ? facts.reservePrev - facts.aidPaid : ZERO
  const rawExpenses = facts.planned + facts.memos + facts.reserve - unpaid
  const expenses = rawExpenses > ZERO ? rawExpenses : ZERO

  const branch = min(expenses, facts.secured)
  const deficit = expenses - branch
  const afterExpenses = facts.secured - branch
  const funds = afterExpenses * facts.fundsPercent / HUNDR_PERCENTS
  const membership = branch + funds
  const economy = afterExpenses - funds
  const initiator = economy * facts.initiatorPercent / HUNDR_PERCENTS
  const returned = economy - initiator

  const rate = (part: bigint) => part * HUNDR_PERCENTS / facts.turnover
  return {
    unpaid,
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
export function crpsRoute(b: ICrpsBranch, share: bigint): { repay: bigint, toBranch: bigint, acc: bigint } {
  const left = crpsOutstanding(b)
  const repay = b.base > ZERO ? (share < left ? share : left) : ZERO
  const acc = repay > ZERO ? b.acc + (repay * CRPS_SCALE) / b.base : b.acc
  return { repay, toBranch: share - repay, acc }
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
    if (i.active) {
      const free = b.unusedTotal - b.reserved
      if (unused > free)
        unused = free > ZERO ? free : ZERO
    }
  }
  return { returned, unused, total: returned + unused }
}

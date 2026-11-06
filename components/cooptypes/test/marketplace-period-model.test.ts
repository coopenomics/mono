import { describe, expect, it } from 'vitest'
import { MarketContract } from '../src'

/**
 * Коэффициент экономического участия — эталон расчёта итога месяца участка и
 * списания по ставкам (задачи 99D-21, 99D-22; документ модели dd5bf19e,
 * разделы 8, 9, 16; реестр marketplace.order, случаи mkt.order.keu.model.*).
 *
 * Эталон повторяет арифметику контрактов `closeperiod`, `chargeperiod` и
 * `fund::accrue`. Тест цепи `boot/src/tests/marketplace-period-math.test.ts`
 * сверяет с ним строки, которые посчитал контракт; здесь проверяются свойства
 * самой модели на сотнях ситуаций, без цепи:
 *  - контрольные примеры документа (участки А и Б);
 *  - рост оборота при неизменных расходах: коэффициент экономического участия падает, пайщик
 *    платит не больше обеспечительной части заказа;
 *  - сохранение суммы: ни одна единица не теряется и не возникает;
 *  - деление по заказам: сумма частей заказов не превышает итог месяца.
 */
const { closePeriod, chargeOrder, splitFunds, chargeRate, HUNDR_PERCENTS: H } = MarketContract.PeriodModel

/** Рубли в единицы актива: четыре знака. */
const rub = (value: number): bigint => BigInt(Math.round(value * 10_000))
const percent = (value: number): bigint => BigInt(Math.round(value * 10_000))

const X = percent(38)
const FUNDS = percent(21)
const INITIATOR = percent(61.8)

/** Факты месяца участка со ставкой обеспечительной части X от оборота. */
function facts(turnoverRub: number, over: Partial<MarketContract.PeriodModel.IPeriodFacts> = {}): MarketContract.PeriodModel.IPeriodFacts {
  const turnover = rub(turnoverRub)
  return {
    turnover,
    secured: turnover * X / H,
    planned: rub(200_000),
    memos: 0n,
    aidPaid: 0n,
    reserve: rub(300_000),
    reservePrev: 0n,
    fundsPercent: FUNDS,
    initiatorPercent: INITIATOR,
    ...over,
  }
}

/** Детерминированный генератор случайных чисел: прогон воспроизводим. */
function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('mkt.order.keu.model.01 — контрольные примеры документа модели', () => {
  it('участок А, первый прогон: расходы выше собранного — всё участку, дефицит 120 000 ₽', () => {
    const t = closePeriod(facts(1_000_000))
    expect(t.expenses).toBe(rub(500_000))
    expect(t.branch).toBe(rub(380_000))
    expect(t.deficit).toBe(rub(120_000))
    expect(t.funds).toBe(0n)
    expect(t.membership).toBe(rub(380_000))
    expect(t.initiator).toBe(0n)
    expect(t.returned).toBe(0n)
    expect([t.rateBranch, t.rateFunds, t.rateInitiator]).toEqual([380_000n, 0n, 0n])
  })

  it('участок Б, выросший: невыплаченная часть резерва 50 000 ₽, экономия делится', () => {
    const t = closePeriod(facts(3_000_000, { memos: rub(50_000), aidPaid: rub(250_000), reservePrev: rub(300_000) }))
    expect(t.unpaid).toBe(rub(50_000))
    expect(t.expenses).toBe(rub(500_000))
    expect(t.branch).toBe(rub(500_000))
    expect(t.deficit).toBe(0n)
    expect(t.funds).toBe(rub(134_400))
    expect(t.membership).toBe(rub(634_400))
    expect(t.economy).toBe(rub(505_600))
    expect(t.initiator).toBe(rub(312_460.8))
    expect(t.returned).toBe(rub(193_139.2))
    expect([t.rateBranch, t.rateFunds, t.rateInitiator]).toEqual([166_666n, 44_800n, 104_153n])
  })

  it('заказ 10 000 ₽ на ставках участка Б: 1 666,66 участку, 448,00 в фонды, 1 041,53 инициатору, 643,81 пайщику', () => {
    const rates = { rateBranch: 166_666n, rateFunds: 44_800n, rateInitiator: 104_153n }
    expect(chargeOrder(rates, rub(3_800), rub(10_000))).toEqual({
      branch: rub(1_666.66),
      funds: rub(448),
      initiator: rub(1_041.53),
      returned: rub(643.81),
      charged: rub(3_156.19),
    })
  })

  it('заказ по прежней ставке 30 % на ставках участка Б: возврата нет, урезается доля инициатора', () => {
    const rates = { rateBranch: 166_666n, rateFunds: 44_800n, rateInitiator: 104_153n }
    expect(chargeOrder(rates, rub(3_000), rub(10_000))).toEqual({
      branch: rub(1_666.66),
      funds: rub(448),
      initiator: rub(885.34),
      returned: 0n,
      charged: rub(3_000),
    })
  })

  it('заказ на ставках участка А: вся обеспечительная часть участку; при ставке заказа 30 % — 3 000 ₽', () => {
    const rates = { rateBranch: 380_000n, rateFunds: 0n, rateInitiator: 0n }
    expect(chargeOrder(rates, rub(3_800), rub(10_000))).toMatchObject({ branch: rub(3_800), returned: 0n })
    expect(chargeOrder(rates, rub(3_000), rub(10_000))).toMatchObject({ branch: rub(3_000), funds: 0n, initiator: 0n, returned: 0n })
  })

  it('отчисление 1 000 ₽ в фонды 1 / 15 / 5: 47,6190 / 714,2857 / 238,0953, остаток округления у последнего', () => {
    const shares = splitFunds(rub(1_000), [percent(1), percent(15), percent(5)])
    expect(shares).toEqual([rub(47.619), rub(714.2857), rub(238.0953)])
    expect(shares.reduce((a, b) => a + b, 0n)).toBe(rub(1_000))
  })

  it('фонд с нулевым процентом в делении не участвует, остаток получает последний фонд с процентом', () => {
    expect(splitFunds(100n, [percent(1), 0n, percent(2), 0n])).toEqual([33n, 0n, 67n, 0n])
    expect(splitFunds(1n, [percent(1), percent(15), percent(5)])).toEqual([0n, 0n, 1n])
  })
})

describe('mkt.order.keu.model.02 — рост оборота участка при неизменных расходах', () => {
  // Расходы участка 500 000 ₽ в месяц: планы 200 000 и резерв 300 000.
  const turnovers = [200_000, 500_000, 1_000_000, 1_315_789.4737, 1_500_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000, 50_000_000, 1_000_000_000]
  const months = turnovers.map(t => ({ turnover: t, totals: closePeriod(facts(t)) }))

  it('пока собранного меньше расходов, коэффициент экономического участия равен ставке обеспечительной части, пайщику не возвращается ничего', () => {
    for (const m of months.filter(m => m.turnover < 1_315_789)) {
      expect(chargeRate(m.totals), `оборот ${m.turnover}`).toBe(X)
      expect(m.totals.returned).toBe(0n)
      expect(m.totals.deficit > 0n).toBe(true)
    }
  })

  it('оборот, при котором собранное равно расходам: дефицита и экономии нет', () => {
    const t = closePeriod(facts(0, { turnover: rub(1_000_000), secured: rub(500_000) }))
    expect([t.branch, t.deficit, t.funds, t.initiator, t.returned]).toEqual([rub(500_000), 0n, 0n, 0n, 0n])
  })

  it('дальше коэффициент экономического участия с каждым ростом оборота только снижается и выше ставки обеспечительной части не бывает', () => {
    for (let i = 1; i < months.length; i++) {
      const prev = chargeRate(months[i - 1].totals)
      const cur = chargeRate(months[i].totals)
      expect(cur <= prev, `оборот ${months[i].turnover}: ставка ${cur} не выше ${prev}`).toBe(true)
      expect(cur <= X).toBe(true)
    }
    expect(chargeRate(months[months.length - 1].totals) < chargeRate(months[2].totals)).toBe(true)
  })

  it('участок получает ровно расходы месяца при любом обороте выше порога', () => {
    for (const m of months.filter(m => m.turnover > 1_315_790)) {
      expect(m.totals.branch, `оборот ${m.turnover}`).toBe(rub(500_000))
      expect(m.totals.deficit).toBe(0n)
    }
  })

  it('предел ставки при бесконечном обороте: доля фондов и инициатора от ставки обеспечительной части', () => {
    // Э делится: фонды p, инициатор φ от остатка → в членский взнос идёт p + (1 − p)·φ = 69,822 % собранного.
    const floor = X * (FUNDS + (H - FUNDS) * INITIATOR / H) / H
    const far = chargeRate(months[months.length - 1].totals)
    expect(far >= floor).toBe(true)
    expect(far - floor < 500n, 'при обороте в миллиард ставка отличается от предела меньше чем на 0,05 %').toBe(true)
    expect(Number(floor) / 10_000).toBeCloseTo(26.532, 2)
  })

  it('пайщик с заказом 10 000 ₽ платит тем меньше, чем больше оборот участка, и никогда больше 3 800 ₽', () => {
    let prev = rub(3_800)
    for (const m of months) {
      const parts = chargeOrder(m.totals, rub(3_800), rub(10_000))
      expect(parts.charged <= prev, `оборот ${m.turnover}`).toBe(true)
      expect(parts.charged + parts.returned).toBe(rub(3_800))
      prev = parts.charged
    }
    expect(prev < rub(2_660), 'на большом обороте списание близко к 26,53 % стоимости').toBe(true)
  })
})

describe('mkt.order.keu.model.03 — крайние значения фактов месяца', () => {
  it('расходов нет: участку ноль, всё собранное — экономия', () => {
    const t = closePeriod(facts(1_000_000, { planned: 0n, reserve: 0n }))
    expect([t.expenses, t.branch, t.deficit]).toEqual([0n, 0n, 0n])
    expect(t.funds + t.initiator + t.returned).toBe(rub(380_000))
  })

  it('невыплаченная часть прошлого резерва больше расходов месяца: расходы ноль, отрицательными не становятся', () => {
    const t = closePeriod(facts(1_000_000, { planned: rub(10_000), reserve: 0n, reservePrev: rub(300_000), aidPaid: 0n }))
    expect(t.unpaid).toBe(rub(300_000))
    expect(t.expenses).toBe(0n)
    expect(t.branch).toBe(0n)
  })

  it('материальной помощи выплачено больше прошлого резерва: невыплаченной части нет', () => {
    const t = closePeriod(facts(1_000_000, { reservePrev: rub(100_000), aidPaid: rub(150_000) }))
    expect(t.unpaid).toBe(0n)
    expect(t.expenses).toBe(rub(500_000))
  })

  it('фондов накопления нет: вся экономия делится между инициатором и пайщиками', () => {
    const t = closePeriod(facts(3_000_000, { fundsPercent: 0n }))
    expect(t.funds).toBe(0n)
    expect(t.initiator + t.returned).toBe(t.economy)
    expect(t.economy).toBe(rub(640_000))
  })

  it('фонды 100 %: весь остаток после расходов в фонды, инициатору и пайщикам ноль', () => {
    const t = closePeriod(facts(3_000_000, { fundsPercent: H }))
    expect([t.funds, t.initiator, t.returned]).toEqual([rub(640_000), 0n, 0n])
  })

  it('доля инициатора 0 %: экономия целиком пайщикам; 100 % — целиком инициатору', () => {
    const none = closePeriod(facts(3_000_000, { initiatorPercent: 0n }))
    expect([none.initiator, none.returned]).toEqual([0n, none.economy])
    const all = closePeriod(facts(3_000_000, { initiatorPercent: H }))
    expect([all.initiator, all.returned]).toEqual([all.economy, 0n])
  })

  it('наименьшие суммы: одна единица актива не теряется', () => {
    const t = closePeriod({ turnover: 3n, secured: 1n, planned: 0n, memos: 0n, aidPaid: 0n, reserve: 0n, reservePrev: 0n, fundsPercent: FUNDS, initiatorPercent: INITIATOR })
    expect(t.branch + t.funds + t.initiator + t.returned).toBe(1n)
    expect(t.returned).toBe(1n)
  })

  it('обороты в триллионы рублей считаются без потери точности', () => {
    const t = closePeriod(facts(9_000_000_000_000))
    expect(t.branch + t.funds + t.initiator + t.returned).toBe(rub(9_000_000_000_000) * X / H)
    expect(t.branch).toBe(rub(500_000))
  })

  it('стоимость заказа ноль и ставки ноль: списывать нечего, всё возвращается пайщику', () => {
    expect(chargeOrder({ rateBranch: 0n, rateFunds: 0n, rateInitiator: 0n }, rub(100), rub(1_000))).toMatchObject({ charged: 0n, returned: rub(100) })
  })

  it('остаток обеспечительной части меньше доли участка: списывается только остаток, порядок урезания — инициатор, фонды, участок', () => {
    const rates = { rateBranch: 166_666n, rateFunds: 44_800n, rateInitiator: 104_153n }
    expect(chargeOrder(rates, rub(2_000), rub(10_000))).toEqual({ branch: rub(1_666.66), funds: rub(333.34), initiator: 0n, returned: 0n, charged: rub(2_000) })
    expect(chargeOrder(rates, rub(1_000), rub(10_000))).toEqual({ branch: rub(1_000), funds: 0n, initiator: 0n, returned: 0n, charged: rub(1_000) })
  })
})

describe('mkt.order.keu.model.04 — свойства расчёта на случайных месяцах', () => {
  const random = prng(20261105)
  const pick = (max: number) => BigInt(Math.floor(random() * max))

  const cases = Array.from({ length: 2_000 }, () => {
    const turnover = pick(5_000_000_000_0) + 1n
    const rate = pick(600_000) + 1n
    const secured = turnover * rate / H + 1n
    return {
      rate,
      facts: {
        turnover,
        secured,
        planned: pick(3_000_000_000_0),
        memos: pick(500_000_000_0),
        aidPaid: pick(500_000_000_0),
        reserve: pick(1_000_000_000_0),
        reservePrev: pick(1_000_000_000_0),
        fundsPercent: pick(1_000_001),
        initiatorPercent: pick(1_000_001),
      } satisfies MarketContract.PeriodModel.IPeriodFacts,
    }
  })

  it('собранное делится без остатка: участку + фонды + инициатору + пайщикам = собрано', () => {
    for (const c of cases) {
      const t = closePeriod(c.facts)
      expect(t.branch + t.funds + t.initiator + t.returned).toBe(c.facts.secured)
      expect(t.membership).toBe(t.branch + t.funds)
      expect(t.economy).toBe(t.initiator + t.returned)
      expect(t.branch + t.deficit).toBe(t.expenses)
      for (const v of [t.unpaid, t.expenses, t.branch, t.deficit, t.funds, t.initiator, t.returned]) expect(v >= 0n).toBe(true)
    }
  })

  it('при дефиците в фонды, инициатору и пайщикам не идёт ничего', () => {
    for (const c of cases) {
      const t = closePeriod(c.facts)
      if (t.deficit > 0n)
        expect([t.funds, t.initiator, t.returned]).toEqual([0n, 0n, 0n])
    }
  })

  it('списание по заказу: части не отрицательны, списано + возвращено = остаток, списано не больше остатка', () => {
    for (const c of cases) {
      const t = closePeriod(c.facts)
      const base = pick(Number(c.facts.turnover > 10_000_000_000n ? 10_000_000_000n : c.facts.turnover)) + 1n
      const amount = pick(Number(base)) + 1n
      const parts = chargeOrder(t, amount, base)
      for (const v of [parts.branch, parts.funds, parts.initiator, parts.returned]) expect(v >= 0n).toBe(true)
      expect(parts.charged + parts.returned).toBe(amount)
      expect(parts.charged <= amount).toBe(true)
    }
  })

  it('заказы месяца с одной ставкой: сумма частей по заказам не превышает итог месяца, расхождение — только округление', () => {
    for (const c of cases.slice(0, 300)) {
      // Месяц из заказов: оборот и собранное складываются из заказов, как делает ИСТОК.
      const count = Number(pick(40)) + 1
      const orders = Array.from({ length: count }, () => {
        const base = pick(500_000_000) + 10_000n
        return { base, amount: base * c.rate / H }
      })
      const turnover = orders.reduce((s, o) => s + o.base, 0n)
      const secured = orders.reduce((s, o) => s + o.amount, 0n)
      if (secured === 0n)
        continue
      const t = closePeriod({ ...c.facts, turnover, secured })
      const sum = { branch: 0n, funds: 0n, initiator: 0n, returned: 0n }
      for (const o of orders) {
        const p = chargeOrder(t, o.amount, o.base)
        sum.branch += p.branch
        sum.funds += p.funds
        sum.initiator += p.initiator
        sum.returned += p.returned
      }
      expect(sum.branch + sum.funds + sum.initiator + sum.returned, 'списано и возвращено всё собранное').toBe(secured)
      // Ставка округляется вниз один раз на месяц (до T/H единиц на часть), доля заказа — вниз на каждом заказе.
      const slack = turnover / H + BigInt(count) + 1n
      for (const [got, total] of [[sum.branch, t.branch], [sum.funds, t.funds], [sum.initiator, t.initiator]] as const) {
        expect(got <= total, 'участок, фонды и инициатор не получают больше итога месяца').toBe(true)
        expect(total - got <= slack + BigInt(count), 'недобор — только остатки округления').toBe(true)
      }
      expect(sum.returned >= t.returned, 'остатки округления достаются пайщикам').toBe(true)
    }
  })
})

/**
 * Сверка инвариантов учёта Стола заказов на данных стенда
 * (test-registry/marketplace.supply.yaml).
 *
 * Председатель запускает ту же сверку, что часовой крон. Стенд к этому
 * моменту несёт всё, что оставили наборы поставки, выдачи, возвратов и
 * остатка: принятые и не выплаченные заказы, удержанные и признанные долги,
 * заказы из свободного паевого. Расхождения на таких данных быть не должно —
 * нарушение инварианта снаружи не создать, оно проверяется юнит-тестами.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, caseName, ensureShareFunds, gql, gqlError, tokenOf } from '../core'
import { acceptToCoop, pickOffer, placeOrder } from './flow'

const INVARIANTS = 'query{ marketplaceLedgerInvariants{ invariant ok expected actual violation details{ process_hash message } } }'

interface Invariant {
  invariant: string
  ok: boolean
  expected: string | null
  actual: string | null
  violation: string | null
  details: { process_hash: string, message: string }[]
}

let results: Invariant[] = []

function of(code: string): Invariant {
  const found = results.find(r => r.invariant === code)
  expect(found, `сверка отдаёт инвариант ${code}`).toBeTruthy()
  return found!
}

function explain(r: Invariant): string {
  return `${r.invariant}: ${r.violation ?? ''} ожидалось ${r.expected}, по факту ${r.actual}; ${r.details.map(d => `${d.process_hash.slice(0, 12)} ${d.message}`).join('; ')}`
}

describe('Стол заказов: инварианты учёта на данных стенда', () => {
  beforeAll(async () => {
    const member = ROLES.member()
    const supplier = ROLES.supplier()
    const operator = ROLES.branchChairman()
    const offer = await pickOffer(supplier.account, undefined, 'Картофель деревенский')
    await ensureShareFunds(member.account, 2_000, await tokenOf(member))
    // Приёмка без выплаты: обязательство перед поставщиком висит на счёте 76.
    const placed = await placeOrder({ who: member, offerId: offer.id, quantity: 1 })
    await acceptToCoop({ supplier, operator, orderId: placed.orderId, factQuantity: 1, factUnitPrice: Number.parseFloat(offer.price_per_unit) })

    results = (await gql<any>(await tokenOf(CHAIRMAN), INVARIANTS)).marketplaceLedgerInvariants
  }, 600_000)

  it(caseName('mkt.supply.side.40', 'расчёты с поставщиками закрыты на принятую сумму: I1 сходится'), async () => {
    const i1 = of('I1')
    expect(i1.ok, explain(i1)).toBe(true)
    expect(i1.details).toEqual([])
  })

  it(caseName('mkt.supply.side.41', 'проводки по 86, резервы заказов и долг поставщикам на данных стенда сходятся: I2, I6, I7'), async () => {
    // I6: стенд полон недовыдач и выдач по сниженной цене — часть резерва
    // возвращена, часть списана. До 02.10.2026 сверка считала это нарушением.
    for (const code of ['I2', 'I6', 'I7']) {
      const r = of(code)
      expect(r.ok, explain(r)).toBe(true)
    }
  })

  it(caseName('mkt.supply.side.36', 'приёмка без выплаты и признанный, но не удержанный долг не дают расхождения счёта 76'), async () => {
    const i7 = of('I7')
    expect(i7.ok, explain(i7)).toBe(true)
    expect(i7.violation ?? null).toBeNull()
  })

  it(caseName('mkt.supply.side.41', 'сверка целиком зелёная и закрыта от пайщика'), async () => {
    expect(results.filter(r => !r.ok).map(explain)).toEqual([])
    const denied = await gqlError(await tokenOf(ROLES.member()), INVARIANTS)
    expect(denied).not.toBeNull()
  })
})

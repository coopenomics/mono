/**
 * Перечисление удержанного НДФЛ снаружи: стол бухгалтера (председатель
 * стенда) видит долг перед бюджетом, отправляет его кассиру, кассир платит
 * или отказывает. Долг на стенде появляется от настоящей выплаты материальной
 * помощи (удержание o.brn.aidtax); если удержанного уже хватает, выплата не
 * повторяется.
 *
 * Отказ кассира в перечислении API не даёт — его делает кооператив в цепи
 * (gateway::outdecline), как обработчик платёжного шлюза; это подготовка
 * состояния, итог читается через API стола бухгалтера.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, ROLES, caseName, gql, gqlError, tokenOf, transact, waitFor } from '../core'
import { COOP_SIGNER, amount } from '../core/wallet'
import {
  cashierPaid,
  mskParts,
  payAid,
  paymentByHash,
  uvPeriodOf,
  withheldPayments,
  withheldState,
} from '../documents/docs-reports.helpers'

const PAY = 'mutation($d:PayWithheldTaxInput!){ payWithheldTax(data:$d) }'
const STATE = 'query{ getWithheldTaxState{ withheld in_payment available } }'

describe('отчёты: перечисление удержанного НДФЛ в бюджет', () => {
  let chair: string
  /** Платёж, от которого кассир откажется, и платёж, который он проведёт. */
  let declinedHash = ''
  let paidHash = ''
  const reason = `Внешний слой: реквизиты налоговой не приняты банком ${crypto.randomBytes(3).toString('hex')}`

  beforeAll(async () => {
    chair = await tokenOf(CHAIRMAN)
    if ((await withheldState()).available < 5)
      await payAid(100)
  }, 1_200_000)

  it(caseName('rep.tax.side.06', 'больше удержанного, ноль или минус — отказ, на цепь ничего не уходит'), async () => {
    const before = await withheldState()
    const historyBefore = (await withheldPayments()).map(p => p.hash)
    const tooMuch = await gqlError(chair, PAY, { d: { amount: before.available + 1 } })
    expect(String(tooMuch?.code), tooMuch?.message).toBe('400')
    expect((await gqlError(chair, PAY, { d: { amount: 0 } }))?.code).toBe('REPORTS_PAYMENT_AMOUNT_NOT_POSITIVE')
    expect((await gqlError(chair, PAY, { d: { amount: -1 } }))?.code).toBe('REPORTS_PAYMENT_AMOUNT_NOT_POSITIVE')
    const member = await tokenOf(ROLES.member())
    expect((await gqlError(member, PAY, { d: { amount: 1 } }))?.code, 'пайщику перечисление недоступно').toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await gqlError(member, STATE))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect(await withheldState()).toEqual(before)
    expect((await withheldPayments()).map(p => p.hash)).toEqual(historyBefore)
  })

  it(caseName('rep.tax.happy.02', 'удержанный налог уходит кассиру: платёж и заявка на цепи с одним хэшем, назначение и реквизиты готовы'), async () => {
    const before = await withheldState()
    const known = new Set((await withheldPayments()).map(p => p.hash))
    const sent = await gql<any>(chair, PAY, { d: { amount: 1 } })
    expect(amount(sent.payWithheldTax)).toBe(1)
    const after = await withheldState()
    expect(after.withheld, 'долг перед бюджетом не меняется до оплаты').toBeCloseTo(before.withheld, 4)
    expect(after.in_payment - before.in_payment).toBeCloseTo(1, 4)
    expect(before.available - after.available).toBeCloseTo(1, 4)

    const item = (await withheldPayments()).find(p => !known.has(p.hash))
    expect(item, 'платёж в истории перечислений').toBeTruthy()
    declinedHash = item.hash
    expect(amount(item.amount)).toBe(1)
    expect(item.status).toBe('PENDING')
    expect(String(item.memo).length, 'назначение платежа').toBeGreaterThan(0)
    expect(item.requisite_rows?.length ?? 0, 'реквизиты бюджета снимком с платежа').toBeGreaterThan(0)

    const cashier = await paymentByHash(declinedHash, 'TAX')
    expect(cashier, 'платёж у кассира с тем же хэшем').toBeTruthy()
    expect(cashier!.status).toBe('PENDING')
    expect(cashier!.quantity).toBe(1)
    expect(cashier!.username).toBe(COOP)
  })

  it(caseName('rep.tax.happy.01', 'у платежа расчётный период по налоговому поясу и подпись периода из календаря отчётности'), async () => {
    const item = (await withheldPayments()).find(p => p.hash === declinedHash)
    const parts = mskParts(item.created_at)
    expect(item.report_year).toBe(parts.year)
    expect(item.report_period, 'до 22-го — первая половина, с 23-го — вторая').toBe(uvPeriodOf(parts.month, parts.day))
    const d = await gql<any>(chair, 'query($y:Int!){ getReportCalendar(year:$y){ reportType periods{ periodCode reportYear label } } }', { y: item.report_year })
    const row = (d.getReportCalendar as any[]).find(r => r.reportType === 'UV_NDFL')
    const cell = (row.periods as any[]).find(p => p.periodCode === item.report_period && p.reportYear === item.report_year)
    expect(cell, 'период есть в календаре уведомлений').toBeTruthy()
    expect(item.report_period_label).toBe(cell.label)
  })

  it(caseName('rep.tax.side.06', 'уже отправленное кассиру вычитается из доступного: повторно его не отправить'), async () => {
    const state = await withheldState()
    expect(state.in_payment).toBeGreaterThanOrEqual(1)
    const again = await gqlError(chair, PAY, { d: { amount: state.available + state.in_payment } })
    expect(String(again?.code), again?.message).toBe('400')
    expect(await withheldState()).toEqual(state)
  })

  it(caseName('rep.tax.side.03', 'кассир не смог заплатить: состояние и причина доходят до стола бухгалтера как есть'), async () => {
    const before = await withheldState()
    await transact(COOP_SIGNER, [{ account: 'gateway', name: 'outdecline', data: { coopname: COOP, outcome_hash: declinedHash, reason } }])
    // Отказ приходит из ленты цепи (soviet::taxdecline) — ждём его в истории.
    const item = await waitFor(async () => {
      const p = (await withheldPayments()).find(x => x.hash === declinedHash)
      return p && p.status !== 'PENDING' ? p : null
    }, { timeoutMs: 90_000, intervalMs: 1_500, label: 'отказ кассира в истории перечислений' })
    expect(item.status).toBe('FAILED')
    expect(item.message).toBe(reason)
    const after = await withheldState()
    expect(before.in_payment - after.in_payment, 'сумма вернулась из оплаты').toBeCloseTo(1, 4)
    expect(after.available - before.available).toBeCloseTo(1, 4)
    expect(after.withheld).toBeCloseTo(before.withheld, 4)
  })

  it(caseName('rep.tax.happy.02', 'кассир провёл перевод: долг перед бюджетом погашен, платёж исполнен'), async () => {
    const before = await withheldState()
    const known = new Set((await withheldPayments()).map(p => p.hash))
    await gql(chair, PAY, { d: { amount: 2 } })
    const item = (await withheldPayments()).find(p => !known.has(p.hash))
    paidHash = item.hash
    const cashier = await paymentByHash(paidHash, 'TAX')
    await cashierPaid(cashier!.id)
    const done = await waitFor(async () => {
      const p = (await withheldPayments()).find(x => x.hash === paidHash)
      return p && p.status === 'COMPLETED' ? p : null
    }, { timeoutMs: 90_000, intervalMs: 1_500, label: 'исполненный налоговый платёж в истории' })
    expect(done.completed_at).toBeTruthy()
    const after = await withheldState()
    expect(before.withheld - after.withheld, 'удержанное уменьшилось на перечисленное').toBeCloseTo(2, 4)
    expect(after.in_payment).toBeCloseTo(before.in_payment, 4)
  })

  it(caseName('rep.tax.side.05', 'история постранично — от новых платежей к старым'), async () => {
    const first = await withheldPayments(1, 1)
    const second = await withheldPayments(2, 1)
    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
    expect(first[0].hash, 'первая страница — последний платёж').toBe(paidHash)
    expect(second[0].hash, 'вторая — предыдущий').toBe(declinedHash)
    expect(new Date(first[0].created_at).getTime()).toBeGreaterThanOrEqual(new Date(second[0].created_at).getTime())
  })
})

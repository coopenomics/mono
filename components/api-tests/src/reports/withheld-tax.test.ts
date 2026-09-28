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
import { CHAIRMAN, COOP, caseName, gql, gqlError, tokenOf, transact, waitFor } from '../core'
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
import type { WsConn, WsSub } from '../platform/platform-a.helpers'
import { chainChangesOf, settleSubscriptions, waitSignal, wsAs } from '../platform/platform-a.helpers'

const PAY = 'mutation($d:PayWithheldTaxInput!){ payWithheldTax(data:$d) }'
const OUTCOMES = { code: 'gateway', table: 'outcomes' }

describe('отчёты: перечисление удержанного НДФЛ в бюджет', () => {
  let chair: string
  /** Платёж, от которого кассир откажется, и платёж, который он проведёт. */
  let declinedHash = ''
  let paidHash = ''
  const reason = `Внешний слой: реквизиты налоговой не приняты банком ${crypto.randomBytes(3).toString('hex')}`
  /** Лента изменений глазами совета: перечисление кассиру — строка выплаты шлюза. */
  let conn: WsConn
  let outcomesSub: WsSub

  beforeAll(async () => {
    chair = await tokenOf(CHAIRMAN)
    if ((await withheldState()).available < 5)
      await payAid(100)
  }, 1_200_000)

  it(caseName('rep.tax.happy.02', 'удержанный налог уходит кассиру: сумма переходит в оплату, платёж с назначением в истории перечислений'), async () => {
    const before = await withheldState()
    const known = new Set((await withheldPayments()).map(p => p.hash))
    conn = await wsAs(chair)
    outcomesSub = chainChangesOf(conn, [OUTCOMES])
    await settleSubscriptions()
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
    // Реквизиты бюджета — из справочника по стране кооператива; до 25.09.2026
    // засев стенда писал страну текстом, справочник её не узнавал (C28-80).
    expect((item.requisite_rows as any[]).map(r => r.label), 'реквизиты бюджета в карточке кассира').toContain('КБК')
  })

  it(caseName('rt.cc.happy.08', 'выплата шлюза (перечисление налога кассиру) — сигнал совету по таблице выплат'), async () => {
    // До 25.09.2026 контракта gateway не было в публикации индексера, и лента
    // по выплатам шлюза молчала. Приход шлюза так не проверить: строка
    // прихода создаётся и закрывается в одном блоке, дельты по ней нет.
    const sig = await waitSignal(outcomesSub, OUTCOMES)
    expect(sig.primary_key).not.toBe('')
    conn.close()
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

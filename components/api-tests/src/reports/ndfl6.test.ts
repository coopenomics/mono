/**
 * 6-НДФЛ и уведомление об исчисленных суммах снаружи: суммы берутся из
 * настоящих выплат материальной помощи на стенде. Тест проводит две выплаты
 * председателю участка krg (100 ₽ с удержанием 13 ₽ и 3 ₽, где налог
 * округляется в ноль) и сравнивает форму до и после — так чужие выплаты,
 * накопленные стендом, не мешают.
 *
 * Сроки и периоды зависят от даты выплаты по московскому времени; тест
 * вычисляет ожидаемую ячейку из времени проводки, а не из «сегодня».
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ROLES, caseName } from '../core'
import {
  type AidPayout,
  generateReport,
  initialEdits,
  mskParts,
  payAid,
  uvPeriodOf,
} from '../documents/docs-reports.helpers'
import { gql } from '../core/client'
import { tokenOf } from '../core/auth'
import { CHAIRMAN } from '../core/roles'

const NDFL_KBK = '18210102010011000110'

interface Tax { peopleCount: number, incomeTotal: number, deductionsTotal: number, taxBase: number, taxCalculated: number, withheldTotal: number, byTerm: number[] }

function taxOf(edits: any): Tax {
  return edits.tax
}

function delta(after: Tax, before: Tax): Tax {
  return {
    peopleCount: after.peopleCount - before.peopleCount,
    incomeTotal: after.incomeTotal - before.incomeTotal,
    deductionsTotal: after.deductionsTotal - before.deductionsTotal,
    taxBase: after.taxBase - before.taxBase,
    taxCalculated: after.taxCalculated - before.taxCalculated,
    withheldTotal: after.withheldTotal - before.withheldTotal,
    byTerm: after.byTerm.map((v, i) => v - before.byTerm[i]),
  }
}

describe('отчёты: 6-НДФЛ и уведомление по НДФЛ из выплат материальной помощи', () => {
  const now = mskParts(new Date().toISOString())
  const Y = now.year
  const Q = Math.ceil(now.month / 3)
  const P = uvPeriodOf(now.month, now.day)
  const recipient = ROLES.branchChairman().account

  const before: Record<string, any> = {}
  const afterFirst: Record<string, any> = {}
  const afterSecond: Record<string, any> = {}
  let aid1: AidPayout
  let aid2: AidPayout

  /** Формы, по которым сравниваются суммы до и после выплат. */
  function keys(): { key: string, type: string, year: number, period: number }[] {
    const list = [
      { key: `ndfl6:${Y}:${Q}`, type: 'NDFL6', year: Y, period: Q },
      { key: `ndfl6:${Y - 1}:4`, type: 'NDFL6', year: Y - 1, period: 4 },
      { key: `uv:${Y}:${P}`, type: 'UV_NDFL', year: Y, period: P },
    ]
    for (let q = Q + 1; q <= 4; q++) list.push({ key: `ndfl6:${Y}:${q}`, type: 'NDFL6', year: Y, period: q })
    if (Q > 1)
      list.push({ key: `ndfl6:${Y}:${Q - 1}`, type: 'NDFL6', year: Y, period: Q - 1 })
    return list
  }

  async function snapshot(into: Record<string, any>): Promise<void> {
    for (const k of keys()) into[k.key] = await initialEdits(k.type, k.year, k.period)
  }

  beforeAll(async () => {
    await snapshot(before)
    aid1 = await payAid(100)
    const paid = mskParts(aid1.paidAt)
    if (paid.year !== Y || Math.ceil(paid.month / 3) !== Q || uvPeriodOf(paid.month, paid.day) !== P)
      throw new Error(`выплата ${aid1.paidAt} попала на границу периода — снимок «до» снят для другого периода, перезапустить`)
    await snapshot(afterFirst)
    aid2 = await payAid(3)
    afterSecond[`ndfl6:${Y}:${Q}`] = await initialEdits('NDFL6', Y, Q)
    afterSecond.annual = await initialEdits('NDFL6', Y, 4)
  }, 1_200_000)

  it(caseName('rep.ndfl6.happy.01', 'выплата с удержанием: доход — выплата плюс налог, база равна доходу, исчислено = удержано'), async () => {
    expect(aid1.tax, 'налог 13% со 100 ₽').toBe(13)
    expect(aid1.net).toBeCloseTo(87, 2)
    const d = delta(taxOf(afterFirst[`ndfl6:${Y}:${Q}`]), taxOf(before[`ndfl6:${Y}:${Q}`]))
    expect(d.incomeTotal, 'доход до удержания').toBeCloseTo(aid1.net + aid1.tax, 2)
    expect(d.incomeTotal).toBeCloseTo(100, 2)
    expect(d.taxBase).toBeCloseTo(d.incomeTotal, 2)
    expect(d.taxCalculated).toBe(13)
    expect(d.withheldTotal).toBe(13)
    expect(taxOf(afterFirst[`ndfl6:${Y}:${Q}`]).deductionsTotal, 'вычеты к матпомощи не применяются').toBe(0)
  })

  it(caseName('rep.ndfl6.happy.02', 'суммы разложены по разделам: итог в 020/160, срок — в своей из шести строк, ставка 13% и КБК НДФЛ'), async () => {
    const edits = afterFirst[`ndfl6:${Y}:${Q}`]
    const d = delta(taxOf(edits), taxOf(before[`ndfl6:${Y}:${Q}`]))
    const paid = mskParts(aid1.paidAt)
    const term = ((paid.month - 1) % 3) * 2 + (paid.day <= 22 ? 0 : 1)
    d.byTerm.forEach((v, i) => expect(v, `срок ${i + 1}`).toBe(i === term ? 13 : 0))

    const report = await generateReport('NDFL6', Y, Q, edits)
    expect(report.xml.length).toBeGreaterThan(0)
    const tax = taxOf(edits)
    expect(report.xml).toContain(`КБК="${NDFL_KBK}"`)
    expect(report.xml).toContain('Ставка="13"')
    expect(report.xml, 'строка 020').toContain(`СумНалУд="${tax.withheldTotal}"`)
    expect(report.xml, 'строка 160').toContain(`СумНалУдерж="${tax.withheldTotal}"`)
    expect(report.xml, `строка 02${term + 1}`).toContain(`СумНал${term + 1}Срок="${tax.byTerm[term]}"`)
  })

  // До 25.09.2026 на стенде не были заведены реквизиты отчётов (ОКТМО), и XML
  // не проходил схему ФНС; реквизиты заводит подготовка стенда (C28-80).
  it(caseName('rep.ndfl6.break.03', 'квартальный с суммами и годовой со справками проходят схему ФНС'), async () => {
    const quarter = await generateReport('NDFL6', Y, Q, afterSecond[`ndfl6:${Y}:${Q}`])
    expect(quarter.errors).toEqual([])
    expect(quarter.isValid).toBe(true)
    const annual = await generateReport('NDFL6', Y, 4, afterSecond.annual)
    expect(annual.errors).toEqual([])
    expect(annual.isValid).toBe(true)
  })

  it(caseName('rep.ndfl6.happy.04', 'уведомление за расчётный период: КБК НДФЛ, удержанный налог, проходит схему'), async () => {
    const uv = await generateReport('UV_NDFL', Y, P, await initialEdits('UV_NDFL', Y, P))
    expect(uv.errors).toEqual([])
    expect(uv.isValid).toBe(true)
    expect(uv.xml).toContain(`КБК="${NDFL_KBK}"`)
  })

  it(caseName('rep.ndfl6.side.03', 'удержание прошлого квартала входит в нарастающий итог следующих кварталов, но не в их сроки'), async () => {
    for (let q = Q + 1; q <= 4; q++) {
      const d = delta(taxOf(afterFirst[`ndfl6:${Y}:${q}`]), taxOf(before[`ndfl6:${Y}:${q}`]))
      expect(d.withheldTotal, `итог за ${q} квартал`).toBe(13)
      expect(d.incomeTotal).toBeCloseTo(100, 2)
      expect(d.byTerm, `сроки ${q} квартала`).toEqual([0, 0, 0, 0, 0, 0])
    }
    // Годовой отчёт — нарастающий итог всего года, выплата в нём есть всегда.
    expect(delta(taxOf(afterFirst[`ndfl6:${Y}:4`]), taxOf(before[`ndfl6:${Y}:4`])).withheldTotal).toBe(13)
  })

  it(caseName('rep.ndfl6.side.04', 'выплата не попадает в отчёт прошлого года и в отчёт за квартал раньше выплаты'), async () => {
    const prevYear = delta(taxOf(afterFirst[`ndfl6:${Y - 1}:4`]), taxOf(before[`ndfl6:${Y - 1}:4`]))
    expect(prevYear.withheldTotal).toBe(0)
    expect(prevYear.incomeTotal).toBeCloseTo(0, 2)
    if (Q > 1) {
      const prevQ = delta(taxOf(afterFirst[`ndfl6:${Y}:${Q - 1}`]), taxOf(before[`ndfl6:${Y}:${Q - 1}`]))
      expect(prevQ.withheldTotal).toBe(0)
      expect(prevQ.incomeTotal).toBeCloseTo(0, 2)
    }
  })

  it(caseName('rep.ndfl6.side.05', 'налог с малой выплаты округлён в ноль и не проведён — доход всё равно в отчёте'), async () => {
    expect(aid2.tax, 'удержания с 3 ₽ нет').toBe(0)
    expect(aid2.net).toBeCloseTo(3, 2)
    const d = delta(taxOf(afterSecond[`ndfl6:${Y}:${Q}`]), taxOf(afterFirst[`ndfl6:${Y}:${Q}`]))
    expect(d.incomeTotal).toBeCloseTo(3, 2)
    expect(d.withheldTotal).toBe(0)
    expect(d.taxCalculated).toBe(0)
  })

  it(caseName('rep.ndfl6.side.06', 'повторная выплата тому же получателю не прибавляет физлиц, суммы складываются'), async () => {
    const d = delta(taxOf(afterSecond[`ndfl6:${Y}:${Q}`]), taxOf(afterFirst[`ndfl6:${Y}:${Q}`]))
    expect(d.peopleCount, 'физлица считаются уникально').toBe(0)
    const total = delta(taxOf(afterSecond[`ndfl6:${Y}:${Q}`]), taxOf(before[`ndfl6:${Y}:${Q}`]))
    expect(total.incomeTotal).toBeCloseTo(103, 2)
    expect(total.peopleCount).toBeLessThanOrEqual(1)
    expect(taxOf(afterSecond[`ndfl6:${Y}:${Q}`]).peopleCount).toBeGreaterThanOrEqual(1)
  })

  it(caseName('rep.ndfl6.happy.03', 'годовой отчёт: справка получателя с ФИО, датой рождения, статусом, гражданством, документом и доходом по месяцам кодом 2710'), async () => {
    const annual = afterSecond.annual
    const cert = (annual.certificates as any[]).find(c => c.username === recipient)
    expect(cert, 'справка на председателя участка').toBeTruthy()
    expect(cert.lastName).toBeTruthy()
    expect(cert.firstName).toBeTruthy()
    expect(cert.birthDate).toBeTruthy()
    expect(cert.taxpayerStatus).toBe('1')
    expect(cert.citizenshipCode).toBe('643')
    expect(cert.documentTypeCode).toBe('21')
    expect(cert.documentSerialNumber).toMatch(/^\d{4} \d{6}$/)
    const month = mskParts(aid1.paidAt).month
    const line = (cert.monthlyIncome as any[]).find(m => m.month === month && m.incomeCode === '2710')
    expect(line, 'доход месяца выплаты кодом 2710').toBeTruthy()
    expect(line.amount).toBeGreaterThanOrEqual(103 - 0.005)
    expect(cert.taxWithheld).toBeGreaterThanOrEqual(13)

    const report = await generateReport('NDFL6', Y, 4, annual)
    expect(report.xml).toContain('<СправДох')
    expect(report.xml).toContain('КодДоход="2710"')
    expect(report.xml).toContain(`Фамилия="${cert.lastName}"`)
  })

  it(caseName('rep.ndfl6.side.07', 'квартальный отчёт не выводит справки, даже если они посчитаны'), async () => {
    const certificates = afterSecond.annual.certificates as any[]
    expect(certificates.length, 'справки посчитаны').toBeGreaterThan(0)
    const period = Q === 4 ? 3 : Q
    const base = period === Q ? afterSecond[`ndfl6:${Y}:${Q}`] : await initialEdits('NDFL6', Y, period)
    expect(base.certificates, 'квартальная форма справок не собирает').toEqual([])
    const report = await generateReport('NDFL6', Y, period, { ...base, certificates })
    expect(report.xml.length).toBeGreaterThan(0)
    expect(report.xml).not.toContain('СправДох')
  })

  it(caseName('rep.ndfl6.break.02', 'черновик без разделов с суммами: генерация не падает, отчёт нулевой'), async () => {
    const { tax: _tax, certificates: _certs, ...headerOnly } = before[`ndfl6:${Y}:${Q}`]
    const report = await generateReport('NDFL6', Y, Q, headerOnly)
    expect(report.xml.length, report.errors.join('; ')).toBeGreaterThan(0)
    expect(report.xml).toContain('СумНалУд="0"')
    expect(report.xml).not.toContain('СправДох')
  })

  it(caseName('rep.ndfl6.happy.05', 'удержания раскладываются по расчётным периодам месяца: до 22-го — первый, с 23-го — второй'), async () => {
    const paid = mskParts(aid1.paidAt)
    const own = uvPeriodOf(paid.month, paid.day)
    const sibling = paid.day > 22 ? own - 1 : own + 1
    const siblingNow = await initialEdits('UV_NDFL', Y, sibling)
    const ownNow = await initialEdits('UV_NDFL', Y, own)
    // Своя половина месяца получила удержание, соседняя — нет (сравнение с формой до выплат).
    expect(afterFirst[`uv:${Y}:${own}`].payment.amount - before[`uv:${Y}:${own}`].payment.amount).toBe(13)
    const ndflThisPeriod = taxOf(afterSecond[`ndfl6:${Y}:${Q}`]).byTerm[((paid.month - 1) % 3) * 2 + (paid.day <= 22 ? 0 : 1)]
    expect(ownNow.payment.amount, 'уведомление и срок 6-НДФЛ сходятся по построению').toBe(ndflThisPeriod)
    expect(siblingNow.payment.amount).toBe(taxOf(afterSecond[`ndfl6:${Y}:${Q}`]).byTerm[((paid.month - 1) % 3) * 2 + (paid.day <= 22 ? 1 : 0)])
  })

  it(caseName('rep.ndfl6.side.09', 'код периода уведомления: первая половина месяца 01/02/03, вторая 11/12/13, квартал по месяцу'), async () => {
    const quarterCode: Record<number, string> = { 1: '21', 2: '31', 3: '33', 4: '34' }
    for (const period of [1, 2, 5, 6, 23, 24]) {
      const edits = await initialEdits('UV_NDFL', Y, period)
      const report = await generateReport('UV_NDFL', Y, period, edits)
      const month = Math.floor((period - 1) / 2) + 1
      const second = period % 2 === 0
      const code = String((second ? 10 : 0) + ((month - 1) % 3) + 1).padStart(2, '0')
      expect(report.xml, `период ${period}`).toContain(`НомерМесКварт="${code}"`)
      expect(report.xml, `квартал периода ${period}`).toContain(`Период="${quarterCode[Math.ceil(month / 3)]}"`)
    }
  })

  it(caseName('rep.ndfl6.side.10', 'расчётный период без удержаний не требует уведомления, период с удержанием — требует'), async () => {
    const d = await gql<any>(await tokenOf(CHAIRMAN), 'query($y:Int!){ getReportCalendar(year:$y){ reportType periods{ periodCode status } } }', { y: Y })
    const row = (d.getReportCalendar as any[]).find(r => r.reportType === 'UV_NDFL')
    expect(row, 'уведомление по НДФЛ в календаре').toBeTruthy()
    const own = uvPeriodOf(mskParts(aid1.paidAt).month, mskParts(aid1.paidAt).day)
    const ownCell = (row.periods as any[]).find(p => p.periodCode === own)
    expect(ownCell.status, 'период с удержанием').not.toBe('NO_DATA')
    let checkedEmpty = 0
    for (const cell of row.periods as any[]) {
      if (cell.periodCode === own || cell.status === 'SUBMITTED' || cell.status === 'DRAFT' || cell.status === 'NOT_REQUIRED' || cell.status === 'SUBMITTED_EXTERNALLY')
        continue
      const amount = (await initialEdits('UV_NDFL', Y, cell.periodCode)).payment.amount
      expect(cell.status === 'NO_DATA', `период ${cell.periodCode}: удержано ${amount}`).toBe(amount === 0)
      if (amount === 0)
        checkedEmpty += 1
      if (checkedEmpty >= 2)
        break
    }
    expect(checkedEmpty, 'нашёлся период без удержаний').toBeGreaterThan(0)
  })

  it(caseName('rep.ndfl6.break.04', 'номер расчётного периода вне 1..24 или дробный — генерация отказывает понятной ошибкой без XML'), async () => {
    const base = await initialEdits('UV_NDFL', Y, 1)
    for (const bad of [25, 0, 1.5]) {
      const edits = { ...base, header: { ...base.header, period: bad } }
      const report = await generateReport('UV_NDFL', Y, 1, edits)
      expect(report.xml, `период ${bad}`).toBe('')
      expect(report.isValid).toBe(false)
      expect(report.errors.join(' '), `период ${bad}`).toMatch(/24/)
    }
  })
})

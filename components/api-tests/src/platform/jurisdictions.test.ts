/**
 * Страновые справочники (platform.jurisdictions): налоговые параметры берутся
 * на отчётный год, а для года раньше первой записи справочник молчит.
 *
 * Снаружи справочник виден через отчёт 6-НДФЛ председателя: ставка и КБК в
 * XML — те, что действуют в отчётном году; за год, для которого параметров
 * нет, форма не собирается по сегодняшним ставкам, а отказывает с причиной.
 */
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, caseName, gql, tokenOf } from '../core'

const INITIAL = `query($t:ReportType!,$y:Int!,$p:Int){ buildInitialReportEdits(reportType:$t, year:$y, period:$p){ editsJson } }`
const GENERATE = `mutation($t:ReportType!,$y:Int!,$p:Int,$e:String!){
  generateReportFromEdits(reportType:$t, year:$y, period:$p, editsJson:$e){ isValid xml errors year }
}`

/** Форма 6-НДФЛ за год: предзаполненные правки → XML. */
async function ndfl6(year: number, reportYearOverride?: number) {
  const token = await tokenOf(CHAIRMAN)
  const init = await gql<any>(token, INITIAL, { t: 'NDFL6', y: year, p: 1 })
  const edits = JSON.parse(init.buildInitialReportEdits.editsJson)
  if (reportYearOverride !== undefined)
    edits.header = { ...edits.header, reportYear: reportYearOverride }
  const d = await gql<any>(token, GENERATE, { t: 'NDFL6', y: reportYearOverride ?? year, p: 1, e: JSON.stringify(edits) })
  return d.generateReportFromEdits as { isValid: boolean, xml: string, errors: string[] }
}

describe('platform.jurisdictions: налоговые параметры на дату отчёта', () => {
  it(caseName('plt.jur.happy.01', 'НДФЛ отчётного года: ставка 13 % и КБК 18210102010011000110 в обоих разделах 6-НДФЛ'), async () => {
    for (const year of [2025, 2026]) {
      const r = await ndfl6(year)
      expect(r.errors.join('\n'), String(year)).not.toMatch(/Параметры НДФЛ/)
      expect(r.xml, String(year)).toContain('КБК="18210102010011000110"')
      expect(r.xml, String(year)).toMatch(/РасчСумНал[^>]*Ставка="13"/)
    }
  })

  it(caseName('plt.jur.break.02', 'отчёт за год без налоговых параметров отказывает с причиной, файл по сегодняшним ставкам не собирается'), async () => {
    const r = await ndfl6(2025, 2020)
    expect(r.isValid).toBe(false)
    expect(r.xml).toBe('')
    const text = r.errors.join('\n')
    expect(text).toContain('2020')
    expect(text).toContain('с отчётности за 2025 год')
  })
})

/**
 * Содержание процесса на столе бухгалтера снаружи (слово владельца
 * 17.11.2026): председатель раскрывает процесс и видит, о чём он — имущество,
 * стороны, суммы, состояние. Приложение описывает свои процессы; процесс без
 * описания получает общее содержание из сводки процесса. Пайщику без права
 * на реестры стола бухгалтера содержание не выдаётся.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, ROLES, caseName, expectCode, gql, gqlError, tokenOf } from '../core'

const PROCESSES = `query($f:ProcessesFilter!,$p:PaginationInput!){
  reportsProcesses(filter:$f, pagination:$p){ items{ processHash processType } } }`
const CONTENT = `query($h:String!,$c:String!,$t:String!){
  reportsProcessContent(hash:$h, coopname:$c, process_type:$t){
    title subtitle amount amount_label status facts{ label value } links{ label path } } }`

interface ProcessRow { processHash: string; processType: string }

async function processesOf(token: string, processType?: string): Promise<ProcessRow[]> {
  const data = await gql<any>(token, PROCESSES, {
    f: { coopname: COOP, ...(processType ? { processType } : {}) },
    p: { page: 1, limit: 20 },
  })
  return data.reportsProcesses.items
}

async function contentOf(token: string, row: ProcessRow) {
  const data = await gql<any>(token, CONTENT, { h: row.processHash, c: COOP, t: row.processType })
  return data.reportsProcessContent
}

describe('отчёты: содержание процесса', () => {
  let chair: string

  beforeAll(async () => {
    chair = await tokenOf(CHAIRMAN)
  })

  it(caseName('reports.process-content.02', 'каждый процесс реестра получает содержание: описание приложения либо общее из сводки'), async () => {
    const rows = await processesOf(chair)
    expect(rows.length, 'на стенде нет процессов — засев не проходил').toBeGreaterThan(0)
    for (const row of rows) {
      const content = await contentOf(chair, row)
      expect(content, `процесс ${row.processType} ${row.processHash} остался без содержания`).not.toBeNull()
      // Описание приложения называет карточку; общая сводка заголовка не даёт —
      // процесс называет заголовок панели, — но несёт сведения из нитки процесса.
      expect(
        content.title.trim().length > 0 || content.facts.length > 0,
        `процесс ${row.processType} ${row.processHash}: ни заголовка, ни сведений`
      ).toBe(true)
      // Пустые сведения в карточку не попадают.
      for (const fact of content.facts) expect(fact.value.trim().length).toBeGreaterThan(0)
    }
  })

  it(caseName('reports.process-content.01', 'поставка называет имущество, стоимость, стороны и участок'), async () => {
    const [supply] = await processesOf(chair, 'p.mkt.supply')
    expect(supply, 'на стенде нет поставки — засев Стола заказов не проходил').toBeTruthy()
    const content = await contentOf(chair, supply)
    const labels = content.facts.map((f: { label: string }) => f.label)
    expect(labels).toEqual(expect.arrayContaining(['Поставщик', 'Заказчик', 'Участок', 'Цена']))
    expect(content.amount).toMatch(/^\d+\.\d+ \S+$/)
    expect(content.links[0]?.path).toMatch(/^\/market-admin\/orders\//)
  })

  it(caseName('reports.process-content.06', 'пайщик без права на реестры стола бухгалтера получает отказ'), async () => {
    const [row] = await processesOf(chair)
    const member = await tokenOf(ROLES.member())
    // Пайщик вошёл, но права на реестры стола бухгалтера у него нет — отказ по праву, а не отказ входа.
    expectCode(await gqlError(member, CONTENT, { h: row.processHash, c: COOP, t: row.processType }), 'KIT_INSUFFICIENT_RIGHTS')
  })
})

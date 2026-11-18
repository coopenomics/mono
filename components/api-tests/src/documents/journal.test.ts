/**
 * Журнал документов снаружи (решение владельца 18.11.2026): реестр отдаёт
 * пакеты процессов либо каждый подписанный документ отдельно, с названием по
 * типу документа и датой подписи; период и тип сужают выдачу; пайщик видит
 * только свои документы в обоих видах.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, ROLES, caseName, gql, tokenOf } from '../core'

const DOCUMENTS = `query($d: GetDocumentsInput!){ getDocuments(data:$d){ totalCount items {
  title role signed_at registry_hash
  statement { documentAggregate { document { hash meta } } }
} } }`

interface Row { title: string | null; role: string | null; signed_at: string | null; registry_hash: string | null }

async function list(token: string, username: string, extra: Record<string, unknown> = {}): Promise<{ total: number; items: Row[] }> {
  const page = (await gql<any>(token, DOCUMENTS, { d: { username, filter: {}, type: 'newsubmitted', page: 1, limit: 100, ...extra } })).getDocuments
  return { total: page.totalCount, items: page.items }
}

describe('реестр документов: журнал', () => {
  let chair: string

  beforeAll(async () => {
    chair = await tokenOf(CHAIRMAN)
  })

  it(caseName('documents.journal.01', 'пакетный вид — строки заявлений, плоский — каждый документ'), async () => {
    const packages = await list(chair, COOP, { view: 'PACKAGE' })
    const flat = await list(chair, COOP, { view: 'FLAT' })
    expect(packages.total, 'на стенде нет документов — засев не проходил').toBeGreaterThan(0)
    expect(packages.items.every(i => i.role === 'statement')).toBe(true)
    expect(flat.total).toBeGreaterThanOrEqual(packages.total)
  })

  it(caseName('documents.journal.02', 'у каждой строки название по типу документа и дата подписи'), async () => {
    const flat = await list(chair, COOP, { view: 'FLAT' })
    for (const item of flat.items) {
      expect(item.title?.trim().length, `строка без названия: ${item.registry_hash}`).toBeGreaterThan(0)
      expect(item.signed_at, `строка без даты подписи: ${item.registry_hash}`).toBeTruthy()
    }
  })

  it(caseName('documents.journal.03', 'период по дате подписи сужает выдачу'), async () => {
    const future = await list(chair, COOP, { view: 'FLAT', signed_from: '2999-01-01T00:00:00.000Z' })
    expect(future.total).toBe(0)
    const all = await list(chair, COOP, { view: 'FLAT', signed_to: '2999-01-01T00:00:00.000Z' })
    expect(all.total).toBeGreaterThan(0)
  })

  it(caseName('documents.journal.04', 'тип документа сужает выдачу до документов этого типа'), async () => {
    // 100 — заявление на вступление в кооператив: оно есть у каждого засеянного пайщика.
    const joins = await list(chair, COOP, { view: 'FLAT', registry_ids: [100] })
    expect(joins.total).toBeGreaterThan(0)
    expect(joins.items.every(i => i.title === joins.items[0].title)).toBe(true)
  })

  it(caseName('documents.journal.05', 'пайщик в обоих видах видит только свои документы'), async () => {
    const who = ROLES.member()
    const token = await tokenOf(who)
    for (const view of ['PACKAGE', 'FLAT']) {
      const own = await list(token, who.account, { view })
      const council = await list(chair, COOP, { view })
      expect(own.total).toBeLessThanOrEqual(council.total)
      for (const item of own.items) {
        const meta = (item as any).statement?.documentAggregate?.document?.meta
        const subject = typeof meta === 'string' ? JSON.parse(meta)?.username : meta?.username
        expect(subject === undefined || subject === who.account || item.role !== 'statement', `чужая строка: ${item.registry_hash}`).toBe(true)
      }
    }
  })
})

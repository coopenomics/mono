/**
 * Дата создания документа и уникальность его хэша (factory.document-created-at).
 *
 * Мета хранила дату до минуты, и две генерации одного заявления в одну минуту
 * давали один хэш файла при разной мете: сверка подписи находила по хэшу чужой
 * черновик и отбивала повторную подпись как подмену (C28-84, взнос 24.09.2026).
 *
 * Снаружи это видно по ответу генерации: мета несёт момент в ISO, текст
 * документа — дату для человека, две генерации подряд — разные хэши, а
 * перегенерация из той же меты — тот же хэш.
 */
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, caseName, gql, tokenOf } from '../core'

const GENERATE = `mutation($i:GenerateAnyDocumentInput!){ generateDocument(input:$i){ html hash meta } }`

/** Пользовательское соглашение — председатель собирает его на себя, дата в тексте есть. */
const USER_AGREEMENT = 4
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

async function generate(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ html: string, hash: string, meta: any }> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), GENERATE, { i: { data, ...(options ? { options } : {}) } })
  const doc = d.generateDocument
  return { ...doc, meta: typeof doc.meta === 'string' ? JSON.parse(doc.meta) : doc.meta }
}

const agreement = () => generate({ coopname: COOP, username: CHAIRMAN.account, registry_id: USER_AGREEMENT })

describe('дата создания документа и его хэш', () => {
  it(caseName('factory.docdate.happy.01', 'мета хранит момент в ISO, документ показывает дату человеку'), async () => {
    const doc = await agreement()
    expect(doc.meta.created_at).toMatch(ISO)
    expect(doc.html).toMatch(/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/)
    expect(doc.html).not.toContain(doc.meta.created_at)
  })

  it(caseName('factory.docdate.break.01', 'две генерации подряд — разные хэши'), async () => {
    const first = await agreement()
    const second = await agreement()
    expect(second.meta.created_at).not.toBe(first.meta.created_at)
    expect(second.hash).not.toBe(first.hash)
  })

  it(caseName('factory.docdate.side.02', 'перегенерация из той же меты даёт тот же хэш'), async () => {
    const original = await agreement()
    const again = await generate({ ...original.meta }, { skip_save: true })
    expect(again.meta.created_at).toBe(original.meta.created_at)
    expect(again.hash).toBe(original.hash)
  })

  it(caseName('factory.docdate.side.01', 'документ со старой датой собирается с ней как есть'), async () => {
    const original = await agreement()
    const legacy = await generate({ ...original.meta, created_at: '24.09.2026 14:05' }, { skip_save: true })
    expect(legacy.meta.created_at).toBe('24.09.2026 14:05')
    expect(legacy.html).toContain('24.09.2026 14:05')
  })

  it(caseName('factory.docdate.break.02', 'непонятная дата в мете — отказ, дата не выдумывается'), async () => {
    const original = await agreement()
    await expect(generate({ ...original.meta, created_at: 'вчера' }, { skip_save: true })).rejects.toThrow()
  })
})

/**
 * Благорост: сортировка и отбор в списках (test-registry/capital.list-filters-sort.yaml).
 *
 * Поле сортировки приходит от клиента и подставляется в ORDER BY строкой,
 * поэтому сервер пропускает только колонки самой сущности: опечатка или
 * устаревшее имя поля молча меняются на умолчание (новые сверху), список
 * при этом отдаётся. Отбор задач без указания
 * проекта не показывает и не считает задачи чужих проектов.
 *
 * Мир теста: проект в цепи с тремя задачами, заведёнными в порядке B, C, A —
 * так порядок по названию, по созданию и обратный по созданию различимы.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, caseName } from '../core'
import {
  createChainProject,
  createIssue,
  ensureCapitalChainReady,
  issuesAs,
  tag,
} from './cap-access.helpers'

let T = ''
let Q = ''
const titles = { A: '', B: '', C: '' }

async function order(options?: Record<string, unknown>): Promise<string[]> {
  const r = await issuesAs(CHAIRMAN, { project_hash: Q }, { page: 1, limit: 50, ...options })
  expect(r.errors, JSON.stringify(r.errors)).toEqual([])
  expect(r.data.capitalIssues.totalCount).toBe(3)
  return r.data.capitalIssues.items.map((i: any) => i.title)
}

beforeAll(async () => {
  await ensureCapitalChainReady()
  T = tag('sort')
  Q = await createChainProject(`Сортировка ${T}`)
  titles.A = `${T} A`
  titles.B = `${T} B`
  titles.C = `${T} C`
  for (const title of [titles.B, titles.C, titles.A])
    await createIssue(CHAIRMAN, { title, project_hash: Q })
}, 600_000)

describe('Благорост — сортировка списков: закрытый набор колонок', () => {
  it(caseName('cap.lists.happy.01', 'сортировка по колонке сущности применяется'), async () => {
    expect(await order({ sortBy: 'title', sortOrder: 'ASC' })).toEqual([titles.A, titles.B, titles.C])
    expect(await order({ sortBy: 'title', sortOrder: 'DESC' })).toEqual([titles.C, titles.B, titles.A])
  })

  it(caseName('cap.lists.side.01', 'без поля сортировки — умолчание, новые сверху'), async () => {
    expect(await order()).toEqual([titles.A, titles.C, titles.B])
  })

  it(caseName('cap.lists.side.02', 'неизвестное поле сортировки заменяется умолчанием без отказа'), async () => {
    expect(await order({ sortBy: 'estimate_snapshot', sortOrder: 'ASC' })).toEqual([titles.B, titles.C, titles.A])
    expect(await order({ sortBy: 'no_such_column', sortOrder: 'DESC' })).toEqual([titles.A, titles.C, titles.B])
  })
})

describe('Благорост — что попадает в списки', () => {
  it(caseName('cap.lists.side.05', 'задачи чужого проекта не попадают в выборку и не считаются'), async () => {
    const outsider = ROLES.otherMember()
    const general = await issuesAs(outsider, { title: titles.A }, { page: 1, limit: 50 })
    expect(general.errors).toEqual([])
    expect(general.data.capitalIssues.items).toEqual([])
    expect(general.data.capitalIssues.totalCount).toBe(0)

    // Та же задача у председателя — есть: отбор идёт по правам, а не по фильтру.
    const own = await issuesAs(CHAIRMAN, { title: titles.A }, { page: 1, limit: 50 })
    expect(own.data.capitalIssues.totalCount).toBe(1)
  })
})

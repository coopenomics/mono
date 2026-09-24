/**
 * Поле сортировки списков — только колонка сущности (platform.list-sort-order-by).
 *
 * Поле сортировки уходит в ORDER BY строкой. До 23.09.2026 член совета мог
 * дописать туда подзапрос и посимвольно вычитать базу (C28-42). Снаружи это
 * проверяется так: каждый список схемы, где клиент задаёт сортировку,
 * вызывается со злыми значениями, и ответ не должен нести следов SQL — ни
 * ошибки разбора, ни ссылки на несуществующую таблицу `pbsortprobe`, которую
 * знает только подставленный подзапрос. Список ищется по схеме стенда, поэтому
 * новый список с PaginationInput попадает под проверку сам.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COUNCIL, ROLES, caseName, gql, tokenOf } from '../core'
import type { SortableList } from './platform-b.helpers'
import { SQL_LEAK, callList, codeOf, sortableLists } from './platform-b.helpers'

/** Отказ проверки ввода: декоратор (422) или общая проверка пагинации. */
const INPUT_REFUSALS = new Set(['422', 'KIT_SORT_FIELD_INVALID'])

/** Не имя колонки по символам — отсекается на входе. */
const MALFORMED = [
  'id; DROP TABLE users',
  '(select 1)',
  '"password"',
  'created_at, (select count(*) from pbsortprobe)',
  'id\' --',
  'created_at:drop',
]

interface Reachable { list: SortableList, who: Who }

/**
 * Список со своим входом (не общий PaginationInput) может держать собственный
 * перечень полей и отклонять остальное на входе — это тоже «чужая колонка в
 * запрос не попадает».
 */
function ownAllowList(list: SortableList, r: { errors: { code: string | null }[] }): boolean {
  return !list.paginationInput && String(r.errors[0]?.code) === '422'
}

let reachable: Reachable[] = []
let unreachable: string[] = []

function describeResponse(r: { errors: { code: string | null, message: string }[] }): string {
  return r.errors.length ? `[${r.errors[0].code}] ${r.errors[0].message.slice(0, 200)}` : 'ok'
}

const AGREEMENTS = `query($f:AgreementFilter,$o:PaginationInput){
  agreements(filter:$f, options:$o){ items{ _id draft_id _created_at } totalCount }
}`

async function agreementPage(sortBy: string | undefined, sortOrder: 'ASC' | 'DESC', limit = 20): Promise<{ id: string, draft: number }[]> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), AGREEMENTS, {
    f: { coopname: COOP },
    o: { page: 1, limit, sortOrder, ...(sortBy !== undefined && { sortBy }) },
  })
  return (d.agreements.items as any[]).map(a => ({ id: a._id, draft: a.draft_id }))
}

/** Все соглашения кооператива одним списком — состав, без порядка. */
async function agreementSet(sortBy: string | undefined): Promise<string[]> {
  return (await agreementPage(sortBy, 'DESC', 1000)).map(a => a.id).sort()
}

const ACCOUNTS = `query($o:PaginationInput){ getAccounts(options:$o){ items{ provider_account{ created_at } } } }`

/** Метки заведения пайщиков на первой странице реестра. */
async function accountTimes(sortBy: string | undefined, sortOrder: 'ASC' | 'DESC' = 'DESC'): Promise<number[]> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), ACCOUNTS, { o: { page: 1, limit: 20, sortOrder, ...(sortBy !== undefined && { sortBy }) } })
  return (d.getAccounts.items as any[]).map(a => a.provider_account?.created_at).filter(Boolean).map((s: string) => Date.parse(s))
}

const newestFirst = (times: number[]) => times.every((t, i) => i === 0 || times[i - 1] >= t)

describe('platform.list-sort-order-by: поле сортировки списков', () => {
  beforeAll(async () => {
    const lists = await sortableLists(await tokenOf(CHAIRMAN))
    // Кто может прочитать список: сначала председатель, затем роли Стола
    // заказов — у части списков свой круг читателей.
    const callers: Who[] = [CHAIRMAN, COUNCIL, ROLES.member(), ROLES.supplier(), ROLES.branchChairman()]
    for (const list of lists) {
      let found: Who | null = null
      for (const who of callers) {
        const r = await callList(who, list)
        if (!r.errors.length) {
          found = who
          break
        }
      }
      if (found)
        reachable.push({ list, who: found })
      else
        unreachable.push(list.query)
    }
    console.log(`списки с сортировкой: ${lists.length}; читаются: ${reachable.map(r => `${r.list.query}(${r.who.account})`).join(', ')}; без читателя на стенде: ${unreachable.join(', ') || '—'}`)
  })

  it(caseName('platform.sort.happy.01', 'сортировка по колонке сущности применяется в обе стороны'), async () => {
    const asc = (await agreementPage('draft_id', 'ASC')).map(a => a.draft)
    const desc = (await agreementPage('draft_id', 'DESC')).map(a => a.draft)
    expect(asc.length).toBeGreaterThan(1)
    expect(asc).toEqual([...asc].sort((a, b) => a - b))
    expect(desc).toEqual([...desc].sort((a, b) => b - a))
    expect(asc[0]).toBeLessThan(desc[0])

    // Журнал расширений — тот же рубеж в своём репозитории.
    const token = await tokenOf(CHAIRMAN)
    const logs = await gql<any>(token, `query($o:PaginationInput){ getExtensionLogs(options:$o){ items{ id } } }`, {
      o: { page: 1, limit: 20, sortBy: 'id', sortOrder: 'ASC' },
    })
    const ids = (logs.getExtensionLogs.items as any[]).map(i => i.id)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
  })

  it(caseName('platform.sort.break.01', 'подзапрос и посторонние символы в поле сортировки отклоняются на входе любого списка'), async () => {
    expect(reachable.length).toBeGreaterThan(10)
    const report: string[] = []
    const problems: string[] = []
    for (const { list, who } of reachable) {
      for (const sortBy of MALFORMED) {
        const r = await callList(who, list, sortBy)
        const outcome = describeResponse(r)
        report.push(`${list.query} ${JSON.stringify(sortBy)} → ${outcome}`)
        if (r.errors.some(e => SQL_LEAK.test(e.message)))
          problems.push(`${list.query}: ${JSON.stringify(sortBy)} дошло до SQL — ${outcome}`)
        else if (list.paginationInput && !list.where.includes('.pagination.') && !INPUT_REFUSALS.has(codeOf(r) ?? ''))
          problems.push(`${list.query}: ${JSON.stringify(sortBy)} не отклонено на входе — ${outcome}`)
      }
    }
    console.log(report.join('\n'))
    expect(problems).toEqual([])
  })

  it(caseName('platform.sort.break.02', 'допустимое по символам имя не колонки — порядок по умолчанию, чужая колонка в запрос не попадает'), async () => {
    // Состав тот же, что без сортировки: чужое поле не сломало выборку.
    const byForeign = await agreementSet('password')
    expect(byForeign.length).toBeGreaterThan(1)
    expect(byForeign).toEqual(await agreementSet(undefined))
    // Реестр пайщиков: чужое поле — порядок по умолчанию, свежие сверху.
    const accounts = await accountTimes('password:asc', 'ASC')
    expect(accounts.length).toBeGreaterThan(1)
    expect(newestFirst(accounts)).toBe(true)

    const problems: string[] = []
    for (const { list, who } of reachable) {
      for (const sortBy of ['password', 'pbsortprobe', 'private_data']) {
        const r = await callList(who, list, sortBy)
        if (r.errors.length && !ownAllowList(list, r))
          problems.push(`${list.query}: ${sortBy} → ${describeResponse(r)}`)
      }
    }
    expect(problems).toEqual([])
  })

  it(caseName('platform.sort.break.03', 'направление не ASC/DESC: журнал расширений сортирует по убыванию, строка клиента в запрос не попадает'), async () => {
    const token = await tokenOf(CHAIRMAN)
    const LOGS = `query($o:PaginationInput){ getExtensionLogs(options:$o){ items{ id created_at } } }`
    const evil = await gql<any>(token, LOGS, { o: { page: 1, limit: 20, sortOrder: 'ASC, (select count(*) from pbsortprobe)' } })
    const desc = await gql<any>(token, LOGS, { o: { page: 1, limit: 20, sortOrder: 'DESC' } })
    const at = (d: any) => (d.getExtensionLogs.items as any[]).map(i => Date.parse(i.created_at))
    expect(at(evil)).toEqual([...at(evil)].sort((a, b) => b - a))
    expect(at(evil).length).toBe(at(desc).length)

    // Во всех остальных списках направление тоже не доходит до SQL.
    const problems: string[] = []
    const report: string[] = []
    for (const { list, who } of reachable) {
      const r = await callList(who, list, undefined, 'ASC, (select count(*) from pbsortprobe)')
      report.push(`${list.query} sortOrder → ${describeResponse(r)}`)
      if (r.errors.some(e => SQL_LEAK.test(e.message)))
        problems.push(`${list.query}: ${describeResponse(r)}`)
    }
    console.log(report.join('\n'))
    expect(problems).toEqual([])
  })

  it(caseName('platform.sort.side.01', 'реестр пайщиков принимает поле с направлением created_at:desc и created_at:asc'), async () => {
    const desc = await accountTimes('created_at:desc')
    const asc = await accountTimes('created_at:asc')
    expect(desc.length).toBeGreaterThan(1)
    expect(desc).toEqual([...desc].sort((a, b) => b - a))
    expect(asc).toEqual([...asc].sort((a, b) => a - b))
    expect(asc[0]).toBeLessThanOrEqual(desc[0])
  })

  it(caseName('platform.sort.side.02', 'пустое поле сортировки принимается любым списком, порядок по умолчанию'), async () => {
    const problems: string[] = []
    for (const { list, who } of reachable) {
      const r = await callList(who, list, '')
      if (r.errors.length && !ownAllowList(list, r))
        problems.push(`${list.query}: ${describeResponse(r)}`)
    }
    expect(problems).toEqual([])
    expect(await agreementSet('')).toEqual(await agreementSet(undefined))
    expect(newestFirst(await accountTimes('', 'ASC'))).toBe(true)
  })
})

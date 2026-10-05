/**
 * Благорост: циклы разработки (test-registry/capital.cycles.yaml).
 *
 * Цикл — именованный отрезок времени со статусом. Заводит его председатель,
 * читают все пайщики; список фильтруется по названию и статусу.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COUNCIL, ROLES, caseName, expectAuthDenied, expectCode, gql, gqlError, tokenOf } from '../core'
import { tag } from './cap-access.helpers'

const CYCLE = '_id name start_date end_date status present'
const CREATE = `mutation($d:CreateCycleInput!){ capitalCreateCycle(data:$d){ ${CYCLE} } }`
const LIST = `query($f:CapitalCycleFilter,$o:PaginationInput){ capitalCycles(filter:$f, options:$o){ totalCount currentPage totalPages items{ ${CYCLE} } } }`

let chairmanToken = ''
let memberToken = ''
let T = ''

async function cycles(token: string, filter: Record<string, unknown>): Promise<{ totalCount: number, items: any[] }> {
  return (await gql<any>(token, LIST, { f: filter, o: { page: 1, limit: 50 } })).capitalCycles
}

beforeAll(async () => {
  chairmanToken = await tokenOf(CHAIRMAN)
  memberToken = await tokenOf(ROLES.member())
  T = tag('cycle')
})

describe('Благорост — циклы', () => {
  let future: any
  let active: any

  it(caseName('cap.cycle.happy.01', 'председатель заводит цикл — он сохраняется будущим с отправленными датами'), async () => {
    future = (await gql<any>(chairmanToken, CREATE, {
      d: { name: `Спринт ${T}`, start_date: '2026-11-02', end_date: '2026-11-15' },
    })).capitalCreateCycle
    expect(future).toMatchObject({ name: `Спринт ${T}`, status: 'FUTURE' })
    expect(future._id).toBeTruthy()
    expect(String(future.start_date).slice(0, 10)).toBe('2026-11-02')
    expect(String(future.end_date).slice(0, 10)).toBe('2026-11-15')
  })

  it(caseName('cap.cycle.happy.02', 'цикл заводится сразу действующим'), async () => {
    active = (await gql<any>(chairmanToken, CREATE, {
      d: { name: `Идёт ${T}`, start_date: '2026-10-01', end_date: '2026-10-14', status: 'ACTIVE' },
    })).capitalCreateCycle
    expect(active).toMatchObject({ name: `Идёт ${T}`, status: 'ACTIVE' })
  })

  // До 02.10.2026 список циклов отвечал внутренней ошибкой, как только в нём появлялся цикл:
  // дата из базы приходила строкой, поле ждало дату-время (C28-85, находка 63).
  it(caseName('cap.cycle.happy.03', 'пайщик находит цикл в списке по названию; отбор по статусу и признаку «идёт» отдаёт действующий, будущий — нет'), async () => {
    const seen = await cycles(memberToken, { name: `Спринт ${T}` })
    expect(seen.totalCount).toBe(1)
    expect(seen.items[0]).toMatchObject({ _id: future._id, name: `Спринт ${T}`, status: 'FUTURE' })

    const byStatus = await cycles(memberToken, { status: 'ACTIVE' })
    expect(byStatus.items.map(c => c._id)).toContain(active._id)
    expect(byStatus.items.every(c => c.status === 'ACTIVE')).toBe(true)

    const running = await cycles(memberToken, { is_active: true })
    expect(running.items.map(c => c._id)).toContain(active._id)
    expect(running.items.some(c => c.name === `Спринт ${T}`), 'будущий цикл среди идущих не показан').toBe(false)
  })

  it(caseName('cap.cycle.side.01', 'цикл заводит только председатель — члену совета и пайщику отказ, гостю отказ входа; цикл не создаётся'), async () => {
    const input = { d: { name: `Чужой ${T}`, start_date: '2026-11-02', end_date: '2026-11-15' } }
    expectCode(await gqlError(await tokenOf(COUNCIL), CREATE, input), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(memberToken, CREATE, input), 'KIT_INSUFFICIENT_RIGHTS')
    expectAuthDenied(await gqlError(null, CREATE, input))
    expectAuthDenied(await gqlError(null, LIST, { f: {}, o: { page: 1, limit: 5 } }))

    expect((await cycles(chairmanToken, { name: `Чужой ${T}` })).totalCount).toBe(0)
  })
})

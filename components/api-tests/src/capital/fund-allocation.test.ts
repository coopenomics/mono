/**
 * Денежные места ЦПП «Благорост» через API (реестр capital.fund-allocation,
 * уровень backend): председатель направляет свободные средства программы в
 * кооперативный компонент, видит предел возврата, и сервер отсекает то, что
 * до цепи доходить не должно, — персональные проекты, чужую валюту,
 * несуществующий проект.
 *
 * Свободные средства программы готовятся цепью, как сид: свежий пайщик
 * регистрируется участником Благороста и вносит программную инвестицию.
 * Проверяемое — только ответы API: карточка компонента и предел возврата.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, amount, caseName, freshMember, gql, gqlError, tokenOf } from '../core'
import {
  chainFreePool,
  ensureCapitalInitialized,
  fundProgramPool,
  getProject,
  randomHash,
  registerApplicant,
  runTag,
} from './cap-metrics.helpers'
import { createChainProject, createLocalProject } from './cap-access.helpers'

const ALLOCATE = 'mutation($d:CapitalAllocateFundsInput!){ capitalAllocateFunds(data:$d){ __typename } }'
const DEALLOCATE = 'mutation($d:CapitalDeallocateFundsInput!){ capitalDeallocateFunds(data:$d){ __typename } }'
const LIMIT = 'query($d:CapitalDeallocationLimitInput!){ capitalDeallocationLimit(data:$d){ max_amount program_invest_pool unspent outstanding_debt is_allowed_by_status } }'

const PROGRAM_FUNDS = 50_000
const ALLOC_MAIN = 10_000
const ALLOC_UPPER = 1_500

let chairman = ''
let tag = ''
let component = ''
let localProject = ''

describe('Благорост — направление средств программы и предел возврата (API)', () => {
  beforeAll(async () => {
    chairman = await tokenOf(CHAIRMAN)
    tag = runTag()
    await ensureCapitalInitialized()

    const investor = freshMember({ prefix: 'capinv' })
    await fundProgramPool(investor, PROGRAM_FUNDS)

    const project = await createChainProject(`Направление средств ${tag}`, { description: 'Проект внешнего теста денежных мест программы.' })
    component = await createChainProject(`Компонент под средства ${tag}`, { description: 'Компонент, в который направляются средства программы.', parent_hash: project })
    localProject = (await createLocalProject(CHAIRMAN, `Личный проект председателя ${tag}`, { description: 'Персональный проект — не место для денег кооператива.' })).project_hash
  })

  it(caseName('cap.alloc.happy.02', 'направление суммы в валюте кооператива доходит до компонента без изменений'), async () => {
    expect(await chainFreePool(), 'предусловие: у программы есть свободные средства').toBeGreaterThanOrEqual(ALLOC_MAIN)
    const before = await getProject(chairman, component)
    expect(before, 'компонент виден председателю').toBeTruthy()

    await gql(chairman, ALLOCATE, { d: { coopname: COOP, project_hash: component, amount: `${ALLOC_MAIN.toFixed(4)} RUB` } })

    const after = await getProject(chairman, component)
    expect(amount(after.fact.total_received_investments) - amount(before.fact.total_received_investments),
      'компонент обязан получить ровно направленную сумму').toBeCloseTo(ALLOC_MAIN, 4)
    expect(amount(after.fact.program_invest_pool) - amount(before.fact.program_invest_pool),
      'без плана расходов вся сумма — программные средства компонента').toBeCloseTo(ALLOC_MAIN, 4)
  })

  it(caseName('cap.alloc.side.01', 'хеш проекта в верхнем регистре находит проект и уходит в цепь в нижнем'), async () => {
    const before = await getProject(chairman, component)
    const err = await gqlError(chairman, ALLOCATE, { d: { coopname: COOP, project_hash: component.toUpperCase(), amount: `${ALLOC_UPPER.toFixed(4)} RUB` } })
    expect(err, 'существующий проект не должен получить «не найден»').toBeNull()

    const after = await getProject(chairman, component)
    expect(amount(after.fact.total_received_investments) - amount(before.fact.total_received_investments)).toBeCloseTo(ALLOC_UPPER, 4)
  })

  it(caseName('cap.dealloc.happy.02', 'предел возврата по компоненту — максимум и его составляющие в валюте кооператива'), async () => {
    const project = await getProject(chairman, component)
    const r = await gql<any>(chairman, LIMIT, { d: { coopname: COOP, project_hash: component } })
    const limit = r.capitalDeallocationLimit

    for (const field of ['max_amount', 'program_invest_pool', 'unspent', 'outstanding_debt'] as const)
      expect(limit[field], `${field} — сумма в валюте кооператива`).toMatch(/^\d+\.\d{4} RUB$/)

    const allocated = ALLOC_MAIN + ALLOC_UPPER
    expect(limit.is_allowed_by_status, 'компонент в статусе, где возврат разрешён').toBe(true)
    expect(amount(limit.program_invest_pool), 'направлено в компонент').toBeCloseTo(amount(project.fact.program_invest_pool), 4)
    expect(amount(limit.program_invest_pool)).toBeCloseTo(allocated, 4)
    expect(amount(limit.unspent), 'ничего не израсходовано').toBeCloseTo(allocated, 4)
    expect(amount(limit.outstanding_debt), 'ссуд в компоненте нет').toBe(0)
    expect(amount(limit.max_amount), 'вернуть можно всё направленное').toBeCloseTo(allocated, 4)
  })

  it(caseName('cap.alloc.side.02', 'направление средств в персональный проект отклоняется до цепи'), async () => {
    const err = await gqlError(chairman, ALLOCATE, { d: { coopname: COOP, project_hash: localProject, amount: '1000.0000 RUB' } })
    expect(err?.code).toBe('CAPITAL_PERSONAL_PROJECT_NOT_ALLOWED')
  })

  it(caseName('cap.alloc.side.03', 'направление средств в проект, которого нет в базе, отклоняется до цепи'), async () => {
    const err = await gqlError(chairman, ALLOCATE, { d: { coopname: COOP, project_hash: randomHash(), amount: '1000.0000 RUB' } })
    expect(err?.code).toBe('CAPITAL_BLOCKCHAIN_PROJECT_NOT_FOUND')
  })

  it(caseName('cap.alloc.side.04', 'сумма направления в чужой валюте отклоняется'), async () => {
    const before = await getProject(chairman, component)
    const err = await gqlError(chairman, ALLOCATE, { d: { coopname: COOP, project_hash: component, amount: '1000.0000 USD' } })
    expect(err?.code).toBe('KIT_CURRENCY_SYMBOL_INVALID')
    const after = await getProject(chairman, component)
    expect(after.fact.total_received_investments, 'отказ ничего не двигает').toBe(before.fact.total_received_investments)
  })

  it(caseName('cap.dealloc.side.10', 'возврат средств из персонального проекта отклоняется до цепи'), async () => {
    const err = await gqlError(chairman, DEALLOCATE, { d: { coopname: COOP, project_hash: localProject, amount: '1000.0000 RUB' } })
    expect(err?.code).toBe('CAPITAL_PERSONAL_PROJECT_NOT_ALLOWED')
  })

  it(caseName('cap.dealloc.side.11', 'сумма возврата в чужой валюте отклоняется'), async () => {
    const before = await getProject(chairman, component)
    const err = await gqlError(chairman, DEALLOCATE, { d: { coopname: COOP, project_hash: component, amount: '1000.0000 USD' } })
    expect(err?.code).toBe('KIT_CURRENCY_SYMBOL_INVALID')
    const after = await getProject(chairman, component)
    expect(after.fact.program_invest_pool, 'отказ ничего не двигает').toBe(before.fact.program_invest_pool)
  })

  it(caseName('cap.alloc.break.31', 'учётная запись в статусе вступления не видит реестр вложений'), async () => {
    const applicant = await registerApplicant()
    const list = await gqlError(applicant.token, 'query{ capitalInvests{ totalCount } }')
    expect(list?.code).toBe('KIT_MEMBERS_ONLY')
    const one = await gqlError(applicant.token, 'query($d:GetInvestInput!){ capitalInvest(data:$d){ invest_hash } }', { d: { _id: '000000000000000000000000' } })
    expect(one?.code).toBe('KIT_MEMBERS_ONLY')

    // Принятый пайщик реестр видит — правило режет именно статус, а не роль.
    const member = await tokenOf(freshMember({ prefix: 'capmbr' }))
    expect(await gqlError(member, 'query{ capitalInvests{ totalCount } }')).toBeNull()
  })
})

/**
 * Предел возврата средств из компонента при выданных ссудах
 * (test-registry/capital.fund-allocation.yaml, cap.dealloc.side.13).
 *
 * Вернуть в программу можно не больше, чем позволяет самый «дорогой» заёмщик:
 * инвестиционный пул нельзя опустить ниже границы, при которой его доступная
 * сумма упадёт ниже долга. Граница — трудовая себестоимость компонента,
 * умноженная на наибольшую долю долга к трудовой базе участника, а не сумма
 * долгов. В компоненте двое участников с разной трудовой базой и разной долей
 * долга; предел сверяется с расчётом по тем же данным, которые отдаёт API.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COOP_SIGNER, amount, caseName, chainDoc, freshMember, gql, gqlError, randomHash, tokenOf, transact, waitFor } from '../core'
import { fundProgramPool } from './cap-metrics.helpers'
import {
  addAuthorOnChain,
  capitalMember,
  clearance,
  commitHours,
  createProject,
  ensureCapitalProgram,
  refreshSegment,
  setMasterInChain,
  setPlan,
  startProject,
} from './cap-results.helpers'

const ALLOCATE = 'mutation($d:CapitalAllocateFundsInput!){ capitalAllocateFunds(data:$d){ __typename } }'
const DEALLOCATE = 'mutation($d:CapitalDeallocateFundsInput!){ capitalDeallocateFunds(data:$d){ __typename } }'
const LIMIT = 'query($d:CapitalDeallocationLimitInput!){ capitalDeallocationLimit(data:$d){ max_amount program_invest_pool unspent outstanding_debt is_allowed_by_status } }'
const PROJECT = `query($d:GetProjectInput!){ capitalProject(data:$d){ status fact{
  program_invest_pool invest_pool total_received_investments total_used_for_compensation used_expense_pool
  creators_base_pool authors_base_pool coordinators_base_pool } } }`
const SEGMENTS = `query($f:CapitalSegmentFilter,$o:PaginationInput){ capitalSegments(filter:$f, options:$o){ items{
  username creator_base author_base coordinator_base debt_amount provisional_amount } } }`

const ALLOCATED = 10_000

describe('Благорост — предел возврата средств при ссудах участников', () => {
  let chairman = ''
  let component = ''
  let minor: Who
  let major: Who

  async function segments(): Promise<any[]> {
    const d = await gql<any>(chairman, SEGMENTS, { f: { project_hash: component }, o: { page: 1, limit: 50 } })
    return d.capitalSegments.items
  }

  /** Заявление на ссуду: долг участника растёт сразу, под него резервируется доступная сумма. */
  async function borrow(who: Who, sum: number): Promise<void> {
    await transact(COOP_SIGNER, [{
      account: 'capital',
      name: 'createdebt',
      data: {
        coopname: COOP,
        username: who.account,
        project_hash: component,
        debt_hash: randomHash(),
        amount: `${sum.toFixed(4)} RUB`,
        repaid_at: new Date(Date.now() + 30 * 24 * 3600_000).toISOString().slice(0, 19),
        statement: chainDoc([who]),
      },
    }])
  }

  beforeAll(async () => {
    chairman = await tokenOf(CHAIRMAN)
    await ensureCapitalProgram()
    await fundProgramPool(freshMember({ prefix: 'cdinv' }), ALLOCATED * 2)

    minor = await capitalMember('cdmn')
    major = await capitalMember('cdmj')
    const project = await createProject(`Проект ссуд ${Date.now().toString(36)}`)
    component = await createProject(`Компонент ссуд ${Date.now().toString(36)}`, project)
    for (const who of [minor, major]) {
      await clearance(who, project)
      await clearance(who, component)
    }
    await setMasterInChain(project, major)
    await startProject(project)
    await setMasterInChain(component, major)
    await setPlan(component, major)
    await startProject(component)
    await addAuthorOnChain(component, minor)
    // Трудовая база участников разная: 5 и 20 часов.
    await commitHours(component, minor, major, 5)
    await commitHours(component, major, major, 20)

    await gql(chairman, ALLOCATE, { d: { coopname: COOP, project_hash: component, amount: `${ALLOCATED.toFixed(4)} RUB` } })
    for (const who of [minor, major])
      await refreshSegment(who, component)

    // Доля долга к трудовой базе: у первого — четыре пятых доступного, у второго — десятая.
    const before = await segments()
    const available = (who: Who): number => amount(before.find(s => s.username === who.account)?.provisional_amount)
    expect(available(minor), 'участнику с малой базой доступна сумма под ссуду').toBeGreaterThan(0)
    expect(available(major), 'участнику с большой базой доступна сумма под ссуду').toBeGreaterThan(0)
    await borrow(minor, Math.floor(available(minor) * 0.8))
    await borrow(major, Math.floor(available(major) * 0.1))

    await waitFor(async () => {
      const rows = await segments()
      return rows.filter(s => amount(s.debt_amount) > 0).length === 2 ? true : null
    }, { timeoutMs: 90_000, intervalMs: 1_000, label: 'ссуды обоих участников в зеркале узла' })
  }, 900_000)

  it(caseName('cap.dealloc.side.13', 'предел возврата считается по заёмщику с наибольшей долей долга к трудовой базе, а не по сумме долгов'), async () => {
    const fact = (await gql<any>(chairman, PROJECT, { d: { hash: component } })).capitalProject.fact
    const rows = (await segments()).filter(s => amount(s.debt_amount) > 0)
    const base = (s: any): number => amount(s.creator_base) + amount(s.author_base) + amount(s.coordinator_base)
    const workCosts = amount(fact.creators_base_pool) + amount(fact.authors_base_pool) + amount(fact.coordinators_base_pool)
    const investPool = amount(fact.invest_pool)
    const debts = rows.reduce((sum, s) => sum + amount(s.debt_amount), 0)
    const maxRatio = Math.max(...rows.map(s => amount(s.debt_amount) / base(s)))
    const byMaxRatio = investPool - workCosts * maxRatio
    const unspent = amount(fact.total_received_investments) - amount(fact.total_used_for_compensation) - amount(fact.used_expense_pool)

    const limit = (await gql<any>(chairman, LIMIT, { d: { coopname: COOP, project_hash: component } })).capitalDeallocationLimit
    expect(limit.is_allowed_by_status).toBe(true)
    expect(amount(limit.outstanding_debt)).toBeCloseTo(debts, 2)
    expect(amount(limit.unspent)).toBeCloseTo(unspent, 2)

    // Условие случая: связывает именно граница по заёмщику — она ниже и
    // программных средств, и неизрасходованного.
    expect(byMaxRatio).toBeLessThan(Math.min(amount(fact.program_invest_pool), unspent))
    expect(amount(limit.max_amount)).toBeCloseTo(Math.max(0, byMaxRatio), 1)
    // По сумме долгов предел вышел бы выше, и контракт отклонил бы такую сумму.
    expect(amount(limit.max_amount)).toBeLessThan(investPool - debts)

    // Сумма сверх предела отклоняется, а не уходит в компонент частично.
    const over = amount(limit.max_amount) + 100
    const refused = await gqlError(chairman, DEALLOCATE, { d: { coopname: COOP, project_hash: component, amount: `${over.toFixed(4)} RUB` } })
    expect(refused, 'возврат сверх предела отклонён').not.toBeNull()
    const after = (await gql<any>(chairman, PROJECT, { d: { hash: component } })).capitalProject.fact
    expect(amount(after.invest_pool)).toBeCloseTo(investPool, 4)
  })
})

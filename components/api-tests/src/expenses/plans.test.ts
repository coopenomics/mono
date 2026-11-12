/**
 * Реестр плановых расходов (expense_plans): предстоящие траты участка с
 * суммой, сроком и реквизитами. Планы участка ведёт его председатель или
 * доверенное лицо (состав участка берётся из цепи, branch::branches); записи
 * уровня кооператива закрыты, пока шасси их не откроет.
 *
 * Каждый тест заводит свои записи с уникальным назначением и ищет их по id —
 * реестр общий для всего прогона.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, caseName, gql, gqlError, tokenOf } from '../core'

const KRG = 'krg'

const PLAN_FIELDS = 'id braname title amount due_date recurrence next_due_date pay_to creator created_at proposal_hash paid_at'
const CREATE = `mutation($d:CreateExpensePlanInput!){ createExpensePlan(data:$d){ ${PLAN_FIELDS} } }`
const LIST = `query($d:ListExpensePlansInput){ listExpensePlans(data:$d){ ${PLAN_FIELDS} } }`
const DELETE = `mutation($d:DeleteExpensePlanInput!){ deleteExpensePlan(data:$d) }`
const SCHEDULE = `query($d:ExpensePlanScheduleInput!){ expensePlanSchedule(data:$d){ due_dates reserve_months reserve_per_month } }`

function tag(): string {
  return crypto.randomBytes(4).toString('hex')
}

function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function planInput(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    braname: KRG,
    title: `Аренда помещения ПВЗ ${tag()}`,
    amount: 1234.5,
    due_date: inDays(10),
    pay_to: 'ООО «Арендодатель», р/с 40702810900000000001, БИК 044525225',
    ...over,
  }
}

/**
 * Планы, заведённые набором. Неоплаченный план со сроком в ближайшие 30 дней
 * держит резерв расходов участка: оставленные планы (4 × 1234,5 ₽) закрывали
 * распределение средств участка в следующих наборах. Набор стирает их за собой.
 */
const created: number[] = []

async function createTracked(token: string, variables: Record<string, unknown>): Promise<any> {
  const d = await gql<any>(token, CREATE, variables)
  created.push(Number(d.createExpensePlan.id))
  return d
}

async function listed(token: string, id: number, braname?: string): Promise<any | undefined> {
  const d = await gql<any>(token, LIST, { d: braname ? { braname } : null })
  return d.listExpensePlans.find((p: any) => p.id === id)
}

describe('expenses: реестр плановых расходов', () => {
  let branchChair: string
  let foreignChair: string
  let member: string
  let chairman: string

  beforeAll(async () => {
    branchChair = await tokenOf(ROLES.branchChairman())
    foreignChair = await tokenOf(ROLES.foreignBranchChairman())
    member = await tokenOf(ROLES.member())
    chairman = await tokenOf(CHAIRMAN)
  })

  afterAll(async () => {
    // Уже удалённые случаями набора планы отвечают «не найден» — это не ошибка.
    for (const id of created) await gql(branchChair, DELETE, { d: { plan_id: id } }).catch(() => {})
  })

  it(caseName('exp.plan.happy.01', 'председатель участка заводит плановый расход, реестр отдаёт его с суммой, сроком и реквизитами'), async () => {
    const input = planInput()
    const d = await createTracked(branchChair, { d: input })
    const plan = d.createExpensePlan
    expect(plan.id).toBeGreaterThan(0)
    expect(plan.braname).toBe(KRG)
    expect(plan.title).toBe(input.title)
    expect(plan.amount).toBe('1234.5000 RUB')
    expect(Math.abs(new Date(plan.due_date).getTime() - new Date(input.due_date as string).getTime())).toBeLessThan(1000)
    expect(plan.recurrence).toBe('NONE')
    expect(plan.pay_to).toBe(input.pay_to)
    expect(plan.creator).toBe(ROLES.branchChairman().account)
    expect(plan.proposal_hash).toBeNull()
    expect(plan.paid_at).toBeNull()

    // Та же запись читается из реестра участка и из общего реестра кооператива.
    const byBranch = await listed(branchChair, plan.id, KRG)
    expect(byBranch).toMatchObject({ title: input.title, amount: '1234.5000 RUB', pay_to: input.pay_to, creator: plan.creator })
    expect(await listed(chairman, plan.id)).toBeDefined()
  })

  it(caseName('exp.plan.happy.02', 'регулярный расход сохраняет периодичность'), async () => {
    const d = await createTracked(branchChair, { d: planInput({ recurrence: 'MONTHLY', due_date: inDays(20) }) })
    expect(d.createExpensePlan.recurrence).toBe('MONTHLY')
    const row = await listed(branchChair, d.createExpensePlan.id, KRG)
    expect(row?.recurrence).toBe('MONTHLY')
  })

  it(caseName('exp.plan.happy.03', 'председатель участка удаляет плановый расход — из реестра он пропадает'), async () => {
    const d = await createTracked(branchChair, { d: planInput() })
    const id = d.createExpensePlan.id
    expect(await listed(branchChair, id, KRG)).toBeDefined()
    const del = await gql<any>(branchChair, DELETE, { d: { plan_id: id } })
    expect(del.deleteExpensePlan).toBe(true)
    expect(await listed(branchChair, id, KRG)).toBeUndefined()
  })

  it(caseName('exp.plan.schedule.01', 'показ квартального расхода: четыре срока с концом месяца, резерв копится три месяца равными долями'), async () => {
    const d = await gql<any>(branchChair, SCHEDULE, { d: { amount: 1000, due_date: '2027-01-31T00:00:00.000Z', recurrence: 'QUARTERLY' } })
    const view = d.expensePlanSchedule
    expect(view.due_dates.map((x: string) => x.slice(0, 10))).toEqual(['2027-01-31', '2027-04-30', '2027-07-30', '2027-10-30'])
    expect(view.reserve_months).toBe(3)
    expect(view.reserve_per_month).toBe('333.3333 RUB')

    const once = (await gql<any>(branchChair, SCHEDULE, { d: { amount: 1000, due_date: '2027-01-31T00:00:00.000Z' } })).expensePlanSchedule
    expect(once.due_dates).toHaveLength(1)
    expect(once.reserve_months).toBe(1)
    expect(once.reserve_per_month).toBe('1000.0000 RUB')
  })

  it(caseName('exp.plan.schedule.02', 'запись реестра показывает следующий срок серии — тот же, что обещал показ; у разового — пусто'), async () => {
    const dueDate = inDays(10)
    const quarterly = (await createTracked(branchChair, { d: planInput({ recurrence: 'QUARTERLY', due_date: dueDate }) })).createExpensePlan
    const shown = (await gql<any>(branchChair, SCHEDULE, { d: { amount: 1234.5, due_date: dueDate, recurrence: 'QUARTERLY' } })).expensePlanSchedule
    expect(quarterly.next_due_date).toBe(shown.due_dates[1])
    expect((await listed(branchChair, quarterly.id, KRG))?.next_due_date).toBe(shown.due_dates[1])

    const once = (await createTracked(branchChair, { d: planInput() })).createExpensePlan
    expect(once.next_due_date).toBeNull()
  })

  it(caseName('exp.plan.schedule.03', 'гость показ расхода не получает'), async () => {
    const err = await gqlError(null, SCHEDULE, { d: { amount: 1000, due_date: inDays(5), recurrence: 'YEARLY' } })
    expect(String(err?.code)).toBe('401')
  })

  it(caseName('exp.plan.side.01', 'запись уровня кооператива (без участка) закрыта — даже председателю кооператива'), async () => {
    const err = await gqlError(chairman, CREATE, { d: planInput({ braname: null }) })
    expect(err?.code).toBe('EXPENSES_PLAN_COOP_LEVEL_NOT_SUPPORTED')
  })

  it(caseName('exp.plan.side.02', 'обычный пайщик не ведёт планы участка'), async () => {
    const input = planInput()
    const err = await gqlError(member, CREATE, { d: input })
    expect(err?.code).toBe('EXPENSES_PLAN_BRANCH_MANAGE_FORBIDDEN')
    const d = await gql<any>(branchChair, LIST, { d: { braname: KRG } })
    expect(d.listExpensePlans.some((p: any) => p.title === input.title)).toBe(false)
  })

  it(caseName('exp.plan.side.03', 'председатель чужого участка не заводит и не удаляет планы krg'), async () => {
    const input = planInput()
    const err = await gqlError(foreignChair, CREATE, { d: input })
    expect(err?.code).toBe('EXPENSES_PLAN_BRANCH_MANAGE_FORBIDDEN')

    const own = await createTracked(branchChair, { d: planInput() })
    const id = own.createExpensePlan.id
    const delErr = await gqlError(foreignChair, DELETE, { d: { plan_id: id } })
    expect(delErr?.code).toBe('EXPENSES_PLAN_BRANCH_MANAGE_FORBIDDEN')
    expect(await listed(branchChair, id, KRG)).toBeDefined()
  })

  it(caseName('exp.plan.side.04', 'план несуществующего участка — отказ «участок не найден»'), async () => {
    const err = await gqlError(branchChair, CREATE, { d: planInput({ braname: 'nobranch1' }) })
    expect(err?.code).toBe('EXPENSES_BRANCH_NOT_FOUND')
  })

  it(caseName('exp.plan.side.05', 'нулевая и отрицательная сумма отвергаются, запись не создаётся'), async () => {
    for (const amount of [0, -100]) {
      const input = planInput({ amount })
      const err = await gqlError(branchChair, CREATE, { d: input })
      expect(err, `сумма ${amount}`).not.toBeNull()
      expect(String(err?.code)).toBe('422')
      const d = await gql<any>(branchChair, LIST, { d: { braname: KRG } })
      expect(d.listExpensePlans.some((p: any) => p.title === input.title)).toBe(false)
    }
  })

  it(caseName('exp.plan.side.06', 'удаление несуществующей записи — отказ «не найдено»'), async () => {
    const err = await gqlError(branchChair, DELETE, { d: { plan_id: 2_000_000_000 } })
    expect(err?.code).toBe('EXPENSES_PLAN_NOT_FOUND')
  })

  // До 25.09.2026 реестр с реквизитами получателей был открыт любому пайщику
  // (решение владельца 25.09: закрыть, C28-80).
  it(caseName('exp.plan.side.08', 'реестр с реквизитами видят совет и операторы участка — пайщику и чужому участку отказ'), async () => {
    const plan = (await createTracked(branchChair, { d: planInput() })).createExpensePlan

    for (const [who, token] of [['пайщик', member], ['председатель чужого участка', foreignChair]] as const) {
      expect((await gqlError(token, LIST, { d: { braname: KRG } }))?.code, who).toBe('EXPENSES_PLAN_BRANCH_READ_FORBIDDEN')
    }
    expect((await gqlError(member, LIST, { d: null }))?.code).toBe('EXPENSES_PLAN_BRANCH_READ_FORBIDDEN')

    // Без участка оператор получает только свои участки.
    const foreignAll = (await gql<any>(foreignChair, LIST, { d: null })).listExpensePlans
    expect(foreignAll.every((p: any) => p.braname !== KRG)).toBe(true)
    expect(await listed(branchChair, plan.id)).toBeDefined()
    expect(await listed(chairman, plan.id)).toBeDefined()
  })

  it(caseName('exp.plan.side.07', 'гость не читает реестр и не заводит записи'), async () => {
    const list = await gqlError(null, LIST, { d: null })
    expect(list).not.toBeNull()
    expect(String(list?.code)).toBe('401')
    const create = await gqlError(null, CREATE, { d: planInput() })
    expect(String(create?.code)).toBe('401')
  })
})

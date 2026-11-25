/**
 * Реестр контрагентов шасси расходов (задача 99D-35): организации и ИП, которым
 * кооператив платит по реквизитам. Совет ведёт всех; операторы участка видят
 * всех и ведут своих; прочим пайщикам реестр закрыт. Реквизиты проверяются
 * правилами страны кооператива — длины и контрольные суммы.
 *
 * Счёт каждого контрагента набора — случайный, с верным ключом по БИК: повтор
 * распознаётся по ИНН и счёту, и повторный запуск набора на том же стенде не
 * упирается в контрагентов прошлого запуска. Набор стирает за собой своих
 * контрагентов и планы.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, caseName, gql, gqlError, tokenOf } from '../core'

const KRG = 'krg'
const BIK = '044525225'

const CP_FIELDS = 'id braname kind name tax_id requisites { key label value } requisites_text payment_purpose archived can_manage'
const FORM = `query{ expenseCounterpartyForm{ country kinds{ kind fields{ key label required length group tax_id } } } }`
const LIST = `query($d:ListExpenseCounterpartiesInput){ expenseCounterparties(data:$d){ ${CP_FIELDS} } }`
const CREATE = `mutation($d:SaveExpenseCounterpartyInput!){ createExpenseCounterparty(data:$d){ ${CP_FIELDS} } }`
const UPDATE = `mutation($d:UpdateExpenseCounterpartyInput!){ updateExpenseCounterparty(data:$d){ ${CP_FIELDS} } }`
const ARCHIVE = `mutation($d:ArchiveExpenseCounterpartyInput!){ archiveExpenseCounterparty(data:$d){ ${CP_FIELDS} } }`
const DELETE = `mutation($d:ExpenseCounterpartyIdInput!){ deleteExpenseCounterparty(data:$d) }`
const CREATE_PLAN = `mutation($d:CreateExpensePlanInput!){ createExpensePlan(data:$d){ id recipient_type counterparty_id counterparty_name payment_purpose pay_to } }`
const DELETE_PLAN = `mutation($d:DeleteExpensePlanInput!){ deleteExpensePlan(data:$d) }`

/** Расчётный счёт с верным ключом по БИК: ключ — девятая цифра, веса 7-1-3, сумма кратна 10. */
function account(): string {
  const tail = String(crypto.randomInt(0, 1e11)).padStart(11, '0')
  const body = `40702810_${tail}`
  const digits = (BIK.slice(-3) + body.replace('_', '0')).split('').map(Number)
  const weights = [7, 1, 3]
  const sum = digits.reduce((s, d, i) => s + d * weights[i % 3], 0)
  // Ключ стоит на 12-й позиции из 23 (вес 3); 3 × 7 ≡ 1 по модулю 10.
  const key = (((10 - (sum % 10)) % 10) * 7) % 10
  return body.replace('_', String(key))
}

function requisites(over: Record<string, string> = {}): { key: string, value: string }[] {
  const values: Record<string, string> = {
    inn: '7707083893',
    kpp: '773601001',
    account: account(),
    bank_name: 'ПАО Сбербанк',
    bik: BIK,
    corr_account: '30101810400000000225',
    ...over,
  }
  return Object.entries(values).map(([key, value]) => ({ key, value }))
}

function input(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'LEGAL',
    name: `ООО «Энергосбыт» ${crypto.randomBytes(3).toString('hex')}`,
    requisites: requisites(),
    payment_purpose: 'Оплата электроэнергии. Без НДС',
    ...over,
  }
}

const createdCounterparties: number[] = []
const createdPlans: number[] = []

async function createTracked(token: string, d: Record<string, unknown>): Promise<any> {
  const res = await gql<any>(token, CREATE, { d })
  createdCounterparties.push(res.createExpenseCounterparty.id)
  return res.createExpenseCounterparty
}

describe('expenses: реестр контрагентов', () => {
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
    for (const id of createdPlans) await gql(branchChair, DELETE_PLAN, { d: { plan_id: id } }).catch(() => {})
    for (const id of createdCounterparties) await gql(chairman, DELETE, { d: { id } }).catch(() => {})
  })

  it(caseName('exp.cp.happy.01', 'форма контрагента — по стране кооператива: у юрлица ИНН из 10 цифр первым полем, у ИП — из 12'), async () => {
    const { expenseCounterpartyForm: form } = await gql<any>(branchChair, FORM)
    expect(form.country).toBe('Russia')
    const legal = form.kinds.find((k: any) => k.kind === 'LEGAL')
    const ip = form.kinds.find((k: any) => k.kind === 'ENTREPRENEUR')
    expect(legal.fields[0]).toMatchObject({ key: 'inn', length: 10, tax_id: true, required: true })
    expect(ip.fields[0]).toMatchObject({ key: 'inn', length: 12 })
  })

  it(caseName('exp.cp.happy.02', 'совет добавляет контрагента кооператива: реквизиты строкой — как в служебной записке'), async () => {
    const cp = await createTracked(chairman, input())
    expect(cp).toMatchObject({ braname: null, kind: 'LEGAL', tax_id: '7707083893', archived: false, can_manage: true })
    expect(cp.requisites_text).toContain('ИНН 7707083893, КПП 773601001')
    expect(cp.requisites_text).toContain(`БИК ${BIK}`)
    // Участок видит контрагента кооператива, но не правит его.
    const seen = (await gql<any>(branchChair, LIST, { d: { search: cp.name } })).expenseCounterparties
    expect(seen.find((c: any) => c.id === cp.id)).toMatchObject({ can_manage: false })
    expect((await gqlError(branchChair, UPDATE, { d: { ...input(), id: cp.id } }))?.code).toBe('EXPENSES_COUNTERPARTY_MANAGE_FORBIDDEN')
  })

  it(caseName('exp.cp.happy.03', 'председатель участка добавляет контрагента своего участка; другой участок видит его и не правит'), async () => {
    const cp = await createTracked(branchChair, input({ braname: KRG }))
    expect(cp).toMatchObject({ braname: KRG, can_manage: true })
    const foreign = (await gql<any>(foreignChair, LIST, { d: { search: cp.name } })).expenseCounterparties
    expect(foreign.find((c: any) => c.id === cp.id)).toMatchObject({ braname: KRG, can_manage: false })
    for (const [query, d] of [[UPDATE, { ...input(), id: cp.id }], [ARCHIVE, { id: cp.id, archived: true }], [DELETE, { id: cp.id }]] as const) {
      expect((await gqlError(foreignChair, query, { d }))?.code).toBe('EXPENSES_COUNTERPARTY_MANAGE_FORBIDDEN')
    }
    const renamed = (await gql<any>(chairman, UPDATE, { d: { ...input({ name: `${cp.name} (правка совета)` }), id: cp.id } })).updateExpenseCounterparty
    expect(renamed).toMatchObject({ braname: KRG })
  })

  it(caseName('exp.cp.side.01', 'опечатка в ИНН или счёте — отказ с названием полей, контрагент не создаётся'), async () => {
    const bad = input({ requisites: requisites({ inn: '7707083894' }) })
    const err = await gqlError(chairman, CREATE, { d: bad })
    expect(err?.code).toBe('EXPENSES_COUNTERPARTY_REQUISITES_INVALID')
    const list = (await gql<any>(chairman, LIST, { d: { search: bad.name as string } })).expenseCounterparties
    expect(list).toHaveLength(0)
  })

  it(caseName('exp.cp.side.02', 'тот же ИНН и тот же счёт — повтор'), async () => {
    const first = input()
    await createTracked(chairman, first)
    expect((await gqlError(chairman, CREATE, { d: { ...first, name: 'Двойник' } }))?.code).toBe('EXPENSES_COUNTERPARTY_DUPLICATE')
  })

  it(caseName('exp.cp.side.03', 'пайщику без участка реестр закрыт, гостю — 401; оператор участка не добавляет контрагента кооператива'), async () => {
    expect((await gqlError(member, LIST, { d: null }))?.code).toBe('EXPENSES_COUNTERPARTY_READ_FORBIDDEN')
    expect(String((await gqlError(null, LIST, { d: null }))?.code)).toBe('401')
    expect((await gqlError(branchChair, CREATE, { d: input() }))?.code).toBe('EXPENSES_COUNTERPARTY_MANAGE_FORBIDDEN')
  })

  it(caseName('exp.cp.happy.04', 'плановый расход по реквизитам контрагента: из неоплаченной записи контрагента не удалить, только в архив; архивный не выбрать'), async () => {
    const cp = await createTracked(branchChair, input({ braname: KRG }))
    const plan = (await gql<any>(branchChair, CREATE_PLAN, {
      d: { braname: KRG, title: 'Электроэнергия ПВЗ', amount: 1500, due_date: new Date(Date.now() + 20 * 864e5).toISOString(), recipient_type: 'ORG', counterparty_id: cp.id },
    })).createExpensePlan
    createdPlans.push(plan.id)
    expect(plan).toMatchObject({ recipient_type: 'ORG', counterparty_id: cp.id, counterparty_name: cp.name, payment_purpose: 'Оплата электроэнергии. Без НДС', pay_to: null })

    expect((await gqlError(branchChair, DELETE, { d: { id: cp.id } }))?.code).toBe('EXPENSES_COUNTERPARTY_IN_USE')
    const archived = (await gql<any>(branchChair, ARCHIVE, { d: { id: cp.id, archived: true } })).archiveExpenseCounterparty
    expect(archived.archived).toBe(true)
    const visible = (await gql<any>(branchChair, LIST, { d: { search: cp.name } })).expenseCounterparties
    expect(visible.find((c: any) => c.id === cp.id)).toBeUndefined()
    const err = await gqlError(branchChair, CREATE_PLAN, {
      d: { braname: KRG, title: 'Электроэнергия', amount: 100, due_date: new Date().toISOString(), recipient_type: 'ORG', counterparty_id: cp.id },
    })
    expect(err?.code).toBe('EXPENSES_COUNTERPARTY_ARCHIVED')
  })
})

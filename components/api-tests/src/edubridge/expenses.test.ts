/**
 * Фонд и расходы программы «Образование» снаружи
 * (test-registry/edubridge.economy.yaml).
 *
 * Свободные средства фонда появляются, когда очередь расширения освобождает
 * удержанные взносы: гарантийный срок вышел, резерв выплат преподавателям по
 * курсу наполнен, остальное свободно. Очередь работает раз в десять минут —
 * набор ждёт её. Расход подаётся служебной запиской через общее шасси расходов.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COUNCIL, amount, caseName, expectCode, freshMember, gql, gqlError, login, tokenOf, waitFor } from '../core'
import type { Draft } from '../expenses/expenses.helpers'
import { hash64, signedStatement } from '../expenses/expenses.helpers'
import { NO_RIGHTS, addLearner, createSection, educationOff, educationOn, fundShare, publishCourse, signOffer, subscribe } from './edubridge.helpers'

const FUND = `query{ edubridgeProgramFund{ fund_balance members_balance wallets{ id name available }
  movements{ id at title amount username display_name direction } } }`
const CREATE_EXPENSE = 'mutation($d:EduCreateExpenseInput!){ edubridgeCreateExpense(data:$d) }'
const EXPENSES = `query($o:PaginationInput){ edubridgeExpenses(options:$o){ totalCount items{
  expense_hash creator creator_name status total_planned total_actual
  items{ item_hash mechanics recipient_type recipient recipient_name description planned_amount actual_amount status }
} } }`

const FUND_WALLET = 'w.edu.fund'
const ORG_REQUISITES = 'ООО «Учебные пособия», ИНН 7700000000, р/с 40702810900000000002, БИК 044525225'
const ORG_PURPOSE = 'Оплата по счёту № 5 за учебные пособия'

describe('Образование: фонд программы и расходы из него', () => {
  let chairman = ''
  let learner: Who
  let fee = 0
  let spent = ''

  const fund = async () => (await gql<any>(chairman, FUND)).edubridgeProgramFund
  const expenses = async (): Promise<any[]> => (await gql<any>(chairman, EXPENSES, { o: { page: 1, limit: 100, sortOrder: 'DESC' } })).edubridgeExpenses.items

  /** Расход одной позицией — оплата организации по реквизитам. */
  async function expenseInput(sum: string): Promise<{ d: Record<string, unknown>, hash: string }> {
    const draft: Draft = {
      author: CHAIRMAN,
      proposal_hash: hash64(),
      source_wallet: FUND_WALLET,
      description: 'Учебные пособия для курса',
      items: [{
        item_hash: hash64(),
        mechanics: 'DIRECT',
        recipient_type: 'ORG',
        recipient: '',
        recipient_name: 'ООО «Учебные пособия»',
        description: 'Учебные пособия',
        planned_amount: sum,
        requisites: ORG_REQUISITES,
        payment_purpose: ORG_PURPOSE,
      }],
    }
    const statement = await signedStatement(draft)
    const items = draft.items.map(({ recipient_name: _name, ...item }) => item)
    return { hash: draft.proposal_hash, d: { expense_hash: draft.proposal_hash, items, statement } }
  }

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    const section = await createSection(chairman)
    // Курс идёт третий день, гарантийного срока нет: взнос удержан только на сумму возможного возврата.
    const course = await publishCourse(chairman, section, -3, { guarantee_days: 0 })
    fee = amount(course.fee_month)

    learner = freshMember({ prefix: 'eduy', firstName: 'Фёдор', lastName: 'Фондов', middleName: 'Ильич' })
    const token = await login(learner)
    await signOffer(learner, token, 'PARENT')
    await fundShare(learner, token, fee * 4)
    const before = amount((await fund()).fund_balance)
    for (const name of ['Фёдор сам', 'Первый ребёнок', 'Второй ребёнок'])
      await subscribe(learner, token, (await addLearner(token, name, name === 'Фёдор сам')).id, course.id)

    // Очередь освобождает удержанное сверх возвратной суммы; резерв преподавателям
    // закрывает первый взнос, остальное освобождённое — свободные средства фонда.
    await waitFor(async () => (amount((await fund()).fund_balance) >= before + 2000 ? true : null),
      { timeoutMs: 13 * 60_000, intervalMs: 20_000, label: 'очередь освободила взносы в свободные средства фонда' })
  }, 1_200_000)

  afterAll(async () => {
    await educationOff()
  })

  it(caseName('edu.econ.happy.05', 'раздел «Экономика» показывает фонд программы, взносы на кошельках учеников и ленту движения'), async () => {
    const f = await fund()
    expect(amount(f.fund_balance)).toBeGreaterThan(0)
    expect((f.wallets as any[]).find(w => w.id === FUND_WALLET).available, 'остаток фонда — из кошелька фонда').toBe(f.fund_balance)
    expect(amount(f.members_balance)).toBeGreaterThanOrEqual(0)

    const movements = f.movements as any[]
    expect(movements.length).toBeGreaterThan(0)
    for (const m of movements) {
      expect(m.title, 'движение подписано словами').toBeTruthy()
      expect(m.title).not.toMatch(/^o\.edu\.|undefined/)
      expect(m.amount).toMatch(/^\d+\.\d{4} RUB$/)
      expect(m.direction).toBeTruthy()
      expect(Number.isNaN(Date.parse(m.at))).toBe(false)
    }
    const own = movements.filter(m => m.username === learner.account)
    expect(own.length, 'взносы ученика в ленте').toBeGreaterThan(0)
    expect(own[0].display_name).toBe('Фондов Фёдор Ильич')
    expect(own.some(m => amount(m.amount) === fee)).toBe(true)
  })

  it(caseName('edu.econ.break.03', 'расход больше свободных средств фонда не подаётся'), async () => {
    const before = await expenses()
    const freeBefore = (await fund()).fund_balance
    const { d, hash } = await expenseInput('90000000.0000 RUB')
    expect(await gqlError(chairman, CREATE_EXPENSE, { d }), 'цепь отказала: в фонде не хватает средств').not.toBeNull()
    expect((await expenses()).map(e => e.expense_hash)).not.toContain(hash)
    expect((await expenses()).length).toBe(before.length)
    expect((await fund()).fund_balance).toBe(freeBefore)
  })

  it(caseName('edu.econ.happy.07', 'председатель подаёт расход программы: средства фонда выделены под расход'), async () => {
    const freeBefore = amount((await fund()).fund_balance)
    const { d, hash } = await expenseInput('1000.0000 RUB')
    // Подаёт тот, кто управляет экономикой программы; ученику операция закрыта.
    expectCode(await gqlError(await login(learner), CREATE_EXPENSE, { d }), NO_RIGHTS)

    expect((await gql<any>(chairman, CREATE_EXPENSE, { d })).edubridgeCreateExpense).toBe(hash)
    spent = hash
    expect(amount((await fund()).fund_balance), 'сумма расхода ушла из свободных средств').toBeCloseTo(freeBefore - 1000, 4)
    // Тот же расход второй раз не подаётся.
    expect(await gqlError(chairman, CREATE_EXPENSE, { d })).not.toBeNull()
  })

  it(caseName('edu.econ.happy.08', 'список расходов программы: состояние, автор по имени, позиции с получателем'), async () => {
    const expense = await waitFor(async () => (await expenses()).find(e => String(e.expense_hash).toLowerCase() === spent.toLowerCase()) ?? null,
      { timeoutMs: 60_000, intervalMs: 1_500, label: 'поданный расход в списке расходов программы' })
    expect(expense).toMatchObject({ creator: CHAIRMAN.account, status: 'CREATED' })
    expect(expense.creator_name, 'автор назван по имени').toBeTruthy()
    expect(expense.creator_name).not.toBe(CHAIRMAN.account)
    expect(amount(expense.total_planned)).toBe(1000)
    expect(amount(expense.total_actual), 'факт нулевой до отчёта').toBe(0)
    expect(expense.items).toHaveLength(1)
    expect(expense.items[0]).toMatchObject({ mechanics: 'DIRECT', recipient_type: 'ORG', description: 'Учебные пособия' })
    expect(amount(expense.items[0].planned_amount)).toBe(1000)
    expect(amount(expense.items[0].actual_amount)).toBe(0)
    // Совет список читает, ученик — нет.
    expect(await gqlError(await tokenOf(COUNCIL), EXPENSES, { o: { page: 1, limit: 10, sortOrder: 'DESC' } })).toBeNull()
    expectCode(await gqlError(await login(learner), EXPENSES, { o: { page: 1, limit: 10, sortOrder: 'DESC' } }), NO_RIGHTS)
  })
})

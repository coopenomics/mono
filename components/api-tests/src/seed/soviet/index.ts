/* eslint-disable node/prefer-global/process */
/**
 * Засев стенда для документации стола совета (docs-harness, сюита
 * run-soviet-all). На свежем стенде повестка и реестры почти пусты: приём
 * пайщика и решения Стола заказов проводит робот совета, а других вопросов нет.
 * Фазы дают столу работу, которую совет делает руками.
 *
 *   01-agenda   — пайщик подаёт заявление на выход: вопрос «Выход пайщика»
 *                 стоит в повестке (робот его не ведёт на этом стенде).
 *   02-votes    — члены совета Пётр и Анна голосуют «за» по этому вопросу:
 *                 председатель голосует и утверждает решение в интерфейсе.
 *   03-payment  — пайщик заявил паевой взнос: входящий платёж ждёт кассира.
 *   04-expense  — член совета подал служебную записку на расход программы:
 *                 записка в реестре расходов и вопрос в повестке.
 *
 *   esno src/seed/soviet/index.ts 01-agenda
 */
import { tokenOf } from '../../core/auth'
import { gql } from '../../core/client'
import { CHAIRMAN, COUNCIL, COUNCIL_2, fixture } from '../../core/roles'
import { voteOnDecision } from '../../core/council'
import { freshMember } from '../../core/participants'
import { requestExit } from '../../core/membership-exit'
import { waitFor } from '../../core/wait'
import { agendaAll } from '../../documents/docs-reports.helpers'
import { createDeposit, listPayments } from '../../payments/payments.helpers'
import { ensureCapitalInitialized, fundProgramPool } from '../../capital/cap-metrics.helpers'
import { CREATE_PROPOSAL, PROGRAM_EXPENSE_POOL, createInput, hash64, signedStatement } from '../../expenses/expenses.helpers'
import type { Draft } from '../../expenses/expenses.helpers'

const log = (...a: unknown[]) => console.error('[seed-soviet]', ...a)

/** Пайщик с входящим платежом — фикстура docs-harness. */
const PAYER = 'ivanpetrov'
const EXIT_TYPE = 'leavecoop'
const BY_COOP = `query($c:String!,$o:PaginationInput){ expenseProposalsByCooperative(coopname:$c, options:$o){ items{ proposal_hash status } } }`

async function exitQuestion(): Promise<{ id: number } | undefined> {
  const chairman = await tokenOf(CHAIRMAN)
  return (await agendaAll(chairman)).find(a => a.type === EXIT_TYPE)
}

/** 01 — заявление на выход стоит в повестке совета. */
async function phase01(): Promise<void> {
  if (await exitQuestion()) {
    log('вопрос о выходе пайщика уже в повестке')
    return
  }
  const member = freshMember({ prefix: 'sov', firstName: 'Глеб', lastName: 'Тихонов', middleName: 'Сергеевич' })
  await requestExit(member, false)
  await waitFor(() => exitQuestion(), { timeoutMs: 90_000, intervalMs: 2_000, label: 'вопрос о выходе пайщика в повестке' })
  log('Тихонов Глеб подал заявление на выход, вопрос в повестке')
}

/** 02 — Пётр и Анна голосуют «за»: с голосом председателя набирается большинство. */
async function phase02(): Promise<void> {
  const q = await waitFor(() => exitQuestion(), { timeoutMs: 60_000, intervalMs: 2_000, label: 'вопрос о выходе пайщика в повестке' })
  await voteOnDecision(q.id, 'for', [COUNCIL.account, COUNCIL_2.account])
  log(`Пётр и Анна проголосовали «за» по вопросу № ${q.id}`)
}

/** 03 — пайщик заявил паевой взнос, входящий платёж ждёт кассира. */
async function phase03(): Promise<void> {
  const who = fixture(PAYER)
  const token = await tokenOf(who)
  const pending = (await listPayments(token, { username: who.account })).find(p => String(p.status) === 'PENDING')
  if (pending) {
    log(`у ${PAYER} уже есть платёж в ожидании`)
    return
  }
  await createDeposit(token, who.account, 5000)
  log(`${PAYER} заявил паевой взнос 5000 RUB`)
}

/** 04 — член совета подал служебную записку на расход программы. */
async function phase04(): Promise<void> {
  const chairman = await tokenOf(CHAIRMAN)
  const items = (await gql<any>(chairman, BY_COOP, { c: 'voskhod', o: { page: 1, limit: 20, sortOrder: 'DESC' } })).expenseProposalsByCooperative.items as any[]
  if (items.length) {
    log(`служебная записка уже есть: ${items[0].proposal_hash.slice(0, 8)} ${items[0].status}`)
    return
  }
  await ensureCapitalInitialized()
  const investor = freshMember({ prefix: 'sovi', firstName: 'Олег', lastName: 'Кравцов', middleName: 'Петрович' })
  await fundProgramPool(investor, 20_000)
  const draft: Draft = {
    author: COUNCIL,
    proposal_hash: hash64(),
    source_wallet: PROGRAM_EXPENSE_POOL,
    description: 'Хозяйственные расходы кооператива на октябрь',
    items: [{
      item_hash: hash64(),
      mechanics: 'DIRECT',
      recipient_type: 'ORG',
      recipient: '',
      recipient_name: 'ООО «Канцтовары»',
      description: 'Бумага и картриджи для офиса кооператива',
      planned_amount: '3500.0000 RUB',
      requisites: 'ООО «Канцтовары», ИНН 7700000001, р/с 40702810900000000003, БИК 044525225',
      payment_purpose: 'Оплата по счёту № 17 от 14.10.2026 за канцелярские товары',
    }],
  }
  const statement = await signedStatement(draft)
  await gql(await tokenOf(COUNCIL), CREATE_PROPOSAL, { d: createInput(draft, statement) })
  log('член совета Пётр подал служебную записку на 3500 RUB')
}

const PHASES: Record<string, () => Promise<void>> = {
  '01-agenda': phase01,
  '02-votes': phase02,
  '03-payment': phase03,
  '04-expense': phase04,
}

async function main(): Promise<void> {
  const names = process.argv.slice(2)
  if (!names.length) {
    console.error(`Usage: seed-soviet <фаза>\nФазы: ${Object.keys(PHASES).join(', ')}`)
    process.exit(2)
  }
  for (const name of names) {
    const fn = PHASES[name]
    if (!fn) {
      console.error(`неизвестная фаза ${name}; есть: ${Object.keys(PHASES).join(', ')}`)
      process.exit(2)
    }
    console.error(`\n=== seed-soviet: ${name} ===`)
    await fn()
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })

/**
 * Засев стенда для документации стола совета (docs-harness, сюита
 * run-soviet-all). На свежем стенде повестка и реестры почти пусты: приём
 * пайщика и решения Стола заказов проводит робот совета, а других вопросов нет.
 * Фазы дают столу работу, которую совет делает руками.
 *
 *   01-template — у формы заявления на возврат взноса (900) вышла новая
 *                 редакция: в шаблонах документов её можно вынести на совет.
 *   02-propose  — новая редакция вынесена на совет: вопрос стоит в повестке.
 *   02-votes    — члены совета Пётр и Анна голосуют «за» по этому вопросу:
 *                 председатель голосует и утверждает решение в интерфейсе.
 *   03-payment  — пайщик заявил паевой взнос: входящий платёж ждёт кассира.
 *   04-expense  — член совета подал служебную записку на расход программы:
 *                 записка в реестре расходов и вопрос в повестке.
 *
 *   esno src/seed/soviet/index.ts 01-template
 */
import process from 'node:process'
import { tokenOf } from '../../core/auth'
import { gql } from '../../core/client'
import { COOP } from '../../core/env'
import { CHAIRMAN, COUNCIL, COUNCIL_2, fixture } from '../../core/roles'
import { voteOnDecision } from '../../core/council'
import { freshMember } from '../../core/participants'
import { waitFor } from '../../core/wait'
import { agendaAll, ensureProposable, propose, templateOf } from '../../documents/docs-reports.helpers'
import { createDeposit, listPayments } from '../../payments/payments.helpers'
import { ensureCapitalInitialized, fundProgramPool } from '../../capital/cap-metrics.helpers'
import { CREATE_PROPOSAL, PROGRAM_EXPENSE_POOL, createInput, hash64, signedStatement } from '../../expenses/expenses.helpers'
import type { Draft } from '../../expenses/expenses.helpers'

const log = (...a: unknown[]) => console.error('[seed-soviet]', ...a)

/** Пайщик с входящим платежом — фикстура docs-harness. */
const PAYER = 'ivanpetrov'
/** Форма заявления на возврат паевого взноса деньгами: её новая редакция идёт на совет. */
const TEMPLATE = 900
const FREE_TYPE = 'freedecision'
const BY_COOP = `query($c:String!,$o:PaginationInput){ expenseProposalsByCooperative(coopname:$c, options:$o){ items{ proposal_hash status } } }`

async function templateQuestion(): Promise<{ id: number } | undefined> {
  const chairman = await tokenOf(CHAIRMAN)
  const t = await templateOf(chairman, TEMPLATE)
  if (!t.pending_hash)
    return undefined
  return (await agendaAll(chairman)).find(a => a.type === FREE_TYPE && a.hash.toLowerCase() === String(t.pending_hash).toLowerCase())
}

/** 01 — у формы заявления на возврат взноса вышла новая редакция: её можно вынести на совет. */
async function phase01(): Promise<void> {
  const chairman = await tokenOf(CHAIRMAN)
  const t = await templateOf(chairman, TEMPLATE)
  if (t.state === 'Pending' || t.state === 'Outdated') {
    log(`шаблон ${TEMPLATE} уже в состоянии ${t.state}`)
    return
  }
  await ensureProposable(chairman, [TEMPLATE])
  log(`у шаблона ${TEMPLATE} новая редакция, её можно вынести на совет`)
}

/** 02 — новая редакция вынесена на совет (обычно её выносит председатель в интерфейсе). */
async function phase02(): Promise<void> {
  if (await templateQuestion()) {
    log('вопрос о новой редакции уже в повестке')
    return
  }
  await phase01()
  await propose([TEMPLATE])
  await waitFor(() => templateQuestion(), { timeoutMs: 90_000, intervalMs: 2_000, label: 'вопрос о новой редакции в повестке' })
  log(`новая редакция шаблона ${TEMPLATE} вынесена на совет`)
}

/** 02-votes — Пётр и Анна голосуют «за»: с голосом председателя набирается большинство. */
async function phaseVotes(): Promise<void> {
  const q = await waitFor(() => templateQuestion(), { timeoutMs: 60_000, intervalMs: 2_000, label: 'вопрос о новой редакции в повестке' })
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
  const items = (await gql<any>(chairman, BY_COOP, { c: COOP, o: { page: 1, limit: 20, sortOrder: 'DESC' } })).expenseProposalsByCooperative.items as any[]
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
  '01-template': phase01,
  '02-propose': phase02,
  '02-votes': phaseVotes,
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

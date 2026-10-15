/**
 * Засев стенда для документации приложения «Расходы» (docs-harness, сюита
 * run-expenses-all). Записка проходит путь до кассы: подача, решение совета,
 * выплаты. Кассу, отчёт по авансу и закрытие сюита снимает в интерфейсе.
 *
 *   01-proposal — член совета Пётр подал служебную записку на расход программы:
 *                 оплата счёта организации и аванс под отчёт пайщику Ивану Петрову.
 *   02-council  — совет проголосовал «за», председатель утвердил решение:
 *                 по строкам записки заведены платежи, они ждут кассира.
 *
 *   esno src/seed/expenses/index.ts 01-proposal
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { tokenOf } from '../../core/auth'
import { gql } from '../../core/client'
import { REPO_ROOT } from '../../core/env'
import { CHAIRMAN, COUNCIL, fixture } from '../../core/roles'
import { freshMember } from '../../core/participants'
import { ensureCapitalInitialized, fundProgramPool } from '../../capital/cap-metrics.helpers'
import { CREATE_PROPOSAL, PROGRAM_EXPENSE_POOL, addSbpMethod, approveByCouncil, createInput, decisionOf, hash64, signedStatement } from '../../expenses/expenses.helpers'
import type { Draft } from '../../expenses/expenses.helpers'

const log = (...a: unknown[]) => console.error('[seed-expenses]', ...a)

/** Получатель аванса — фикстура docs-harness. */
const HOLDER = 'ivanpetrov'
const STATE = path.join(REPO_ROOT, 'components/docs-harness/state/seed-expenses.json')
const GET = `query($h:String!){ expenseProposal(proposal_hash:$h){ proposal_hash status } }`

function remembered(): string | undefined {
  return fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')).proposal_hash : undefined
}

/** 01 — служебная записка с двумя строками подана в совет. */
async function phase01(): Promise<void> {
  const known = remembered()
  if (known) {
    log(`записка уже подана: ${known.slice(0, 8)}`)
    return
  }
  await ensureCapitalInitialized()
  const investor = freshMember({ prefix: 'expi', firstName: 'Олег', lastName: 'Кравцов', middleName: 'Петрович' })
  await fundProgramPool(investor, 30_000)
  const holder = fixture(HOLDER)
  const methodId = await addSbpMethod(holder, '+79161234567')
  const draft: Draft = {
    author: COUNCIL,
    proposal_hash: hash64(),
    source_wallet: PROGRAM_EXPENSE_POOL,
    description: 'Подготовка помещения к общему собранию пайщиков',
    items: [
      {
        item_hash: hash64(),
        mechanics: 'DIRECT',
        recipient_type: 'ORG',
        recipient: '',
        recipient_name: 'ООО «Зал на Садовой»',
        description: 'Аренда зала на 20 октября 2026 года',
        planned_amount: '6000.0000 RUB',
        requisites: 'ООО «Зал на Садовой», ИНН 7700000005, р/с 40702810900000000005, БИК 044525225',
        payment_purpose: 'Оплата по счёту № 41 от 14.10.2026 за аренду зала',
      },
      {
        item_hash: hash64(),
        mechanics: 'ADVANCE',
        recipient_type: 'MEMBER',
        recipient: holder.account,
        recipient_name: 'Петров Иван Сергеевич',
        description: 'Закупка воды и бумаги к собранию',
        planned_amount: '1500.0000 RUB',
        payment_method_id: methodId,
      },
    ],
  }
  const statement = await signedStatement(draft)
  await gql(await tokenOf(COUNCIL), CREATE_PROPOSAL, { d: createInput(draft, statement) })
  fs.mkdirSync(path.dirname(STATE), { recursive: true })
  fs.writeFileSync(STATE, JSON.stringify({ proposal_hash: draft.proposal_hash }, null, 2))
  log(`Пётр подал записку ${draft.proposal_hash.slice(0, 8)}: счёт организации 6000 RUB и аванс Петрову 1500 RUB`)
}

/** 02 — совет утвердил записку, платежи по строкам ждут кассира. */
async function phase02(): Promise<void> {
  const hash = remembered()
  if (!hash)
    throw new Error('записки нет: сначала фаза 01-proposal')
  const p = (await gql<any>(await tokenOf(CHAIRMAN), GET, { h: hash })).expenseProposal
  if (p?.status !== 'CREATED') {
    log(`записка уже в состоянии ${p?.status}`)
    return
  }
  if (!(await decisionOf(hash)))
    throw new Error(`нет вопроса совета по записке ${hash}`)
  const id = await approveByCouncil(hash)
  log(`совет утвердил записку решением № ${id}`)
}

const PHASES: Record<string, () => Promise<void>> = {
  '01-proposal': phase01,
  '02-council': phase02,
}

async function main(): Promise<void> {
  for (const name of process.argv.slice(2)) {
    const fn = PHASES[name]
    if (!fn) {
      console.error(`неизвестная фаза ${name}; есть: ${Object.keys(PHASES).join(', ')}`)
      process.exit(2)
    }
    console.error(`\n=== seed-expenses: ${name} ===`)
    await fn()
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })

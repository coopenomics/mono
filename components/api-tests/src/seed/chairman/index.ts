/**
 * Засев стенда для документации стола председателя (docs-harness, сюита
 * run-chairman-all).
 *
 *   01-approval — пайщик зарегистрировался в Благоросте: договор участия в
 *                 хозяйственной деятельности ждёт подписи председателя в
 *                 запросах одобрений (так заводит одобрение контракт capital).
 *
 *   esno src/seed/chairman/index.ts 01-approval
 */
import process from 'node:process'
import { tokenOf } from '../../core/auth'
import { gql } from '../../core/client'
import { COOP } from '../../core/env'
import { CHAIRMAN } from '../../core/roles'
import { signDocument } from '../../core/documents'
import { freshMember } from '../../core/participants'
import { waitFor } from '../../core/wait'
import { ensureCapitalInitialized } from '../../capital/cap-metrics.helpers'

const log = (...a: unknown[]) => console.error('[seed-chairman]', ...a)

const DOC = 'full_title html hash meta binary'
const GEN_REG = `mutation($d:GenerateCapitalRegistrationDocumentsInputDTO!){ capitalGenerateRegistrationDocuments(data:$d){
  generation_contract{ ${DOC} } storage_agreement{ ${DOC} } blagorost_agreement{ ${DOC} } generator_offer{ ${DOC} } } }`
const COMPLETE_REG = 'mutation($d:CompleteCapitalRegistrationInputDTO!){ capitalCompleteRegistration(data:$d){ __typename } }'
const LIST = `query($f:ApprovalFilter,$o:PaginationInput){ chairmanApprovals(filter:$f, options:$o){ items{ approval_hash status } } }`

async function pending(): Promise<any[]> {
  const chairman = await tokenOf(CHAIRMAN)
  const d = (await gql<any>(chairman, LIST, { f: { coopname: COOP, statuses: ['PENDING'] }, o: { page: 1, limit: 20, sortOrder: 'DESC' } })).chairmanApprovals
  return d.items as any[]
}

/** 01 — договор пайщика ждёт подписи председателя. */
async function phase01(): Promise<void> {
  if ((await pending()).length) {
    log('в запросах одобрений уже есть документ на подпись')
    return
  }
  await ensureCapitalInitialized()
  const who = freshMember({ prefix: 'chap', firstName: 'Роман', lastName: 'Белоусов', middleName: 'Игоревич' })
  const token = await tokenOf(who)
  const docs = (await gql<any>(token, GEN_REG, { d: { coopname: COOP, username: who.account } })).capitalGenerateRegistrationDocuments
  const sign = async (d: any) => d ? signDocument(who.wif, d, who.account, 1) : undefined
  await gql(token, COMPLETE_REG, {
    d: {
      coopname: COOP,
      username: who.account,
      generation_contract: await sign(docs.generation_contract),
      storage_agreement: await sign(docs.storage_agreement),
      blagorost_agreement: await sign(docs.blagorost_agreement),
      generator_offer: await sign(docs.generator_offer),
    },
  })
  await waitFor(async () => ((await pending()).length ? true : null), { timeoutMs: 60_000, intervalMs: 2_000, label: 'договор пайщика в запросах одобрений' })
  log('Белоусов Роман зарегистрировался в Благоросте, договор ждёт подписи председателя')
}

const PHASES: Record<string, () => Promise<void>> = {
  '01-approval': phase01,
}

async function main(): Promise<void> {
  const names = process.argv.slice(2)
  for (const name of names) {
    const fn = PHASES[name]
    if (!fn) {
      console.error(`неизвестная фаза ${name}; есть: ${Object.keys(PHASES).join(', ')}`)
      process.exit(2)
    }
    console.error(`\n=== seed-chairman: ${name} ===`)
    await fn()
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })

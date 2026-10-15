/* eslint-disable node/prefer-global/process */
/**
 * Засев стенда для документации приложения «Кооперативный участок»
 * (docs-harness, сюита run-ku-all). Фазы идемпотентны и зовутся из сценариев
 * в meta.prepare либо прямо из сценария — там, где шаг делает другой пайщик,
 * а его экран в документацию не входит.
 *
 * Главный путь — учреждение участка собранием: учредитель (sokolov) объявляет
 * собрание в интерфейсе, popova присоединяется в интерфейсе, egorov — фазой 02;
 * учредитель открывает голосование и голосует в интерфейсе, остальные — фазой 03;
 * после протокола и заявления учредителя совет решает фазой 04.
 *
 *   esno src/seed/ku/index.ts 01-install
 */
import type { Who } from '../../core/auth'
import { tokenOf } from '../../core/auth'
import { gql } from '../../core/client'
import { CHAIRMAN, fixture } from '../../core/roles'
import { COOP } from '../../core/env'
import { authorizeDecisionOnChain, awaitDecision, voteOnDecision } from '../../core/council'
import { signDocument, toChainDoc } from '../../core/documents'
import { waitFor } from '../../core/wait'

const log = (...a: unknown[]) => console.error('[seed-ku]', ...a)

export const FOUNDER = 'sokolov'
export const JOINER_UI = 'popova'
export const JOINER_SEED = 'egorov'

const EXTENSION = 'trustee'
const CATALOG = 'query($d:GetExtensionsInput){ getExtensions(data:$d){ name is_installed enabled config } }'
const INSTALL = 'mutation($d:ExtensionInput!){ installExtension(data:$d){ name is_installed } }'
const UPDATE = 'mutation($d:ExtensionInput!){ updateExtension(data:$d){ name enabled } }'

const DOC = 'full_title html hash meta binary'
const TX = '{ __typename }'
const JOIN = `mutation($d:JoinKuDecisionInput!){ kuJoinDecision(data:$d)${TX} }`
const VOTE = `mutation($d:VoteOnKuDecisionInput!){ kuVoteOnDecision(data:$d)${TX} }`
const GEN_BALLOT = `mutation($d:BranchMeetingBallotGenerateDocumentInput!){ kuGenerateMeetingBallot(data:$d){ ${DOC} } }`
const GEN_COUNCIL_DECISION = `mutation($d:BranchEstablishmentDecisionGenerateDocumentInput!){ kuGenerateEstablishmentDecision(data:$d){ ${DOC} } }`
const DECISIONS = `query($f:KuDecisionFilterInput,$o:PaginationInput){ kuDecisions(filter:$f, options:$o){ items{ hash status initiator participants } } }`
const VOTING = `query($h:String!){ kuDecision(hash:$h){ hash type status chairman participants signed_ballots braname address branch_name
  questions{ id number title decision context voters_for voters_against voters_abstained } } }`
const BRANCH = 'query($d:GetBranchesInput!){ getBranches(data:$d){ braname trustee{ username } } }'

/** Последнее собрание учредителя в заданных состояниях. */
async function founderMeeting(token: string, statuses: string[]): Promise<any | undefined> {
  const items = (await gql<any>(token, DECISIONS, { f: { initiator: fixture(FOUNDER).account }, o: { page: 1, limit: 20, sortOrder: 'DESC' } })).kuDecisions.items as any[]
  return items.find(i => statuses.includes(String(i.status)))
}

async function meeting(token: string, hash: string): Promise<any> {
  return (await gql<any>(token, VOTING, { h: hash })).kuDecision
}

/** 01 — приложение установлено и включено (обычно его включает сценарий admin/install в интерфейсе). */
async function phase01(): Promise<void> {
  const chairman = await tokenOf(CHAIRMAN)
  const ext = ((await gql<any>(chairman, CATALOG, { d: {} })).getExtensions as any[]).find(e => e.name === EXTENSION)
  if (!ext)
    throw new Error('расширения trustee нет в каталоге приложений стенда')
  if (!ext.is_installed) {
    await gql(chairman, INSTALL, { d: { name: EXTENSION, enabled: true, config: {} } })
    log('приложение «Кооперативный участок» установлено')
  }
  else if (!ext.enabled) {
    await gql(chairman, UPDATE, { d: { name: EXTENSION, enabled: true, config: ext.config ?? {} } })
    log('приложение «Кооперативный участок» включено')
  }
  else {
    log('приложение «Кооперативный участок» уже работает')
  }
}

/** 02 — третий участник (egorov) присоединяется к собранию учредителя, которое собирает участников. */
async function phase02(): Promise<void> {
  const who = fixture(JOINER_SEED)
  const token = await tokenOf(who)
  const m = await waitFor(() => founderMeeting(token, ['OPENED']), { timeoutMs: 60_000, intervalMs: 2_000, label: `собрание ${FOUNDER} в сборе участников` })
  if ((m.participants ?? []).includes(who.account)) {
    log(`${JOINER_SEED} уже участник собрания ${m.hash.slice(0, 8)}`)
    return
  }
  await gql(token, JOIN, { d: { coopname: COOP, hash: m.hash, username: who.account } })
  log(`${JOINER_SEED} присоединился к собранию ${m.hash.slice(0, 8)}`)
}

/** Бюллетень участника «за» по всем вопросам повестки. */
async function voteFor(who: Who, hash: string): Promise<void> {
  const token = await tokenOf(who)
  const m = await meeting(token, hash)
  const questions = [...m.questions].sort((a: any, b: any) => a.number - b.number)
  const voted = questions.some((q: any) => [...(q.voters_for ?? []), ...(q.voters_against ?? []), ...(q.voters_abstained ?? [])].includes(who.account))
  if (voted) {
    log(`${who.account}: бюллетень уже подан`)
    return
  }
  const generated = (await gql<any>(token, GEN_BALLOT, {
    d: {
      coopname: COOP,
      username: who.account,
      hash,
      questions: questions.map((q: any) => ({ id: String(q.id), number: String(q.number), title: q.title, decision: q.decision, context: q.context ?? '' })),
      answers: questions.map((q: any) => ({ id: String(q.id), number: String(q.number), vote: 'for' })),
    },
  })).kuGenerateMeetingBallot
  await gql(token, VOTE, {
    d: {
      coopname: COOP,
      hash,
      username: who.account,
      ballot: await signDocument(who.wif, generated, who.account, 1),
      votes: questions.map((q: any) => ({ question_id: q.id, vote: 'for' })),
    },
  })
  log(`${who.account}: бюллетень «за» подан`)
}

/** 03 — участники popova и egorov голосуют «за» в собрании учредителя. */
async function phase03(): Promise<void> {
  const token = await tokenOf(fixture(FOUNDER))
  const m = await waitFor(() => founderMeeting(token, ['VOTING']), { timeoutMs: 60_000, intervalMs: 2_000, label: `собрание ${FOUNDER} в голосовании` })
  for (const name of [JOINER_UI, JOINER_SEED])
    await voteFor(fixture(name), m.hash)
}

/**
 * 04 — совет учреждает участок: голоса «за», председатель кооператива подписывает
 * протокол решения об учреждении, утверждает и исполняет решение. Узел заводит
 * карточку участка с избранным председателем.
 */
async function phase04(): Promise<void> {
  const founder = fixture(FOUNDER)
  const token = await tokenOf(founder)
  const done = await founderMeeting(token, ['COMPLETED'])
  if (done) {
    log(`собрание ${done.hash.slice(0, 8)} завершено, участок учреждён`)
    return
  }
  const m = await waitFor(() => founderMeeting(token, ['ONAPPROVAL']), { timeoutMs: 60_000, intervalMs: 2_000, label: `заявление ${FOUNDER} в совете` })
  const full = await meeting(token, m.hash)
  const item = await awaitDecision(m.hash, 'вопрос совета об учреждении участка')
  await voteOnDecision(Number(item.id), 'for')
  const chairman = await tokenOf(CHAIRMAN)
  const generated = (await waitFor(() => gql<any>(chairman, GEN_COUNCIL_DECISION, {
    d: { coopname: COOP, username: CHAIRMAN.account, decision_id: Number(item.id), branch_name: full.branch_name, address: full.address, chairman: founder.account },
  }), { timeoutMs: 60_000, intervalMs: 2_000, label: 'протокол решения совета об учреждении' })).kuGenerateEstablishmentDecision
  const signed = await signDocument(CHAIRMAN.wif, generated, CHAIRMAN.account, 1)
  await authorizeDecisionOnChain(Number(item.id), toChainDoc(signed))
  await waitFor(async () => {
    const list = (await gql<any>(token, BRANCH, { d: { coopname: COOP, braname: full.braname } })).getBranches as any[]
    return list[0]?.trustee?.username === founder.account ? true : null
  }, { timeoutMs: 120_000, intervalMs: 2_000, label: `участок ${full.braname} с председателем ${FOUNDER}` })
  log(`совет учредил участок «${full.branch_name}» (${full.braname}), председатель ${FOUNDER}`)
}

const PHASES: Record<string, () => Promise<void>> = {
  '01-install': phase01,
  '02-join': phase02,
  '03-ballots': phase03,
  '04-council': phase04,
}

async function main(): Promise<void> {
  const names = process.argv.slice(2)
  if (!names.length) {
    console.error(`Usage: seed-ku <фаза> [<фаза> …]\nФазы: ${Object.keys(PHASES).join(', ')}`)
    process.exit(2)
  }
  for (const name of names) {
    const fn = PHASES[name]
    if (!fn) {
      console.error(`неизвестная фаза ${name}; есть: ${Object.keys(PHASES).join(', ')}`)
      process.exit(2)
    }
    console.error(`\n=== seed-ku: ${name} ===`)
    await fn()
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })

/**
 * Благорост («Капитал») для внешних тестов: подготовка стенда и шаги процесса
 * результата интеллектуальной деятельности (РИД) — от участника программы до
 * голосования, решения совета и актов.
 *
 * Подготовка идёт через цепь от имени кооператива — так же, как её делают
 * контрактные наборы boot (components/boot/src/tests/capital*) и засев
 * seed-capital. Проверяемое тесты читают через API контроллера. Ассертов здесь
 * нет: помощник, который сам себя проверяет, ничего не доказывает.
 *
 * Документы, которые контракт сверяет только по подписи (договор УХД,
 * приложения, одобрения председателя), подписываются ключом пайщика прямо
 * здесь (`chainDoc`). Документы, которые сверяет контроллер (заявление,
 * решение, акт), берутся из генератора API и подписываются классом SDK.
 */
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import ecc from 'eosjs-ecc'
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { tableRows, transact } from '../core/chain'
import type { GqlError } from '../core/client'
import { ApiError, gql, gqlRaw } from '../core/client'
import { CHAIN_URL, COOP, DEFAULT_WIF, REPO_ROOT } from '../core/env'
import { freshMember } from '../core/participants'
import { CHAIRMAN } from '../core/roles'
import { signDocument } from '../core/documents'
import { waitFor } from '../core/wait'
import { COOP_SIGNER, amount, rub } from '../core/wallet'

export const GENERATED = 'full_title html hash meta binary'

export const CAPITAL = 'capital'
export const ZERO_HASH = '0'.repeat(64)
/** Ставка часа участника: у создателя без ставки коммит отклоняется. */
export const RATE_PER_HOUR = '1000.0000 RUB'
/** Программа «Благорост» в карте программ контракта (lib/core/programs.hpp). */
export const CAPITAL_PROGRAM_ID = 4
export const CAPITAL_DRAFT_ID = 1000

export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

export function randomHash(): string {
  return crypto.randomBytes(32).toString('hex')
}

export { amount, rub }

// ── Документы ──────────────────────────────────────────────────────────────

function signatures(hash: string, signers: Who[]) {
  const signedAt = new Date().toISOString().slice(0, 19)
  return signers.map((s, i) => ({
    id: i + 1,
    signed_hash: hash,
    signer: s.account,
    public_key: ecc.privateToPublic(s.wif),
    signature: ecc.signHash(hash, s.wif),
    signed_at: signedAt,
    meta: '{}',
  }))
}

/**
 * Документ в формате цепи, подписанный ключами участников. Контракт сверяет
 * подпись с ключом аккаунта подписанта — чужим ключом его не подписать.
 */
export function chainDoc(signers: Who[], hash = randomHash()) {
  return { version: '1.0.0', hash, doc_hash: hash, meta_hash: hash, meta: '{}', signatures: signatures(hash, signers) }
}

/** Тот же документ в формате входа GraphQL (мета — объект). */
export function apiDoc(signers: Who[], hash = randomHash()) {
  return { version: '1.0.0', hash, doc_hash: hash, meta_hash: hash, meta: {}, signatures: signatures(hash, signers) }
}

/** Подписанный SDK документ — в цепь (мета строкой). */
export function toChainDoc(signed: any) {
  return { ...signed, meta: typeof signed.meta === 'string' ? signed.meta : JSON.stringify(signed.meta ?? {}) }
}

// ── Частота генерации документов ───────────────────────────────────────────

/**
 * Генерации документов ограничены тремя в минуту на пайщика
 * (`@Throttle`, GqlThrottlerGuard). Тест, которому нужно больше, ждёт окно,
 * а не падает на 429: частота — не то, что он проверяет.
 */
export async function gqlRawPaced<T = any>(token: string | null, query: string, variables?: unknown) {
  for (let attempt = 0; ; attempt++) {
    const r = await gqlRaw<T>(token, query, variables)
    if (r.errors[0]?.code !== 'GRAPHQL_RATE_LIMITED' || attempt >= 6)
      return r
    // timing: throttle — окно «три генерации в минуту» на пайщика
    await new Promise(res => setTimeout(res, 15_000))
  }
}

export async function gqlPaced<T = any>(token: string | null, query: string, variables?: unknown): Promise<T> {
  const r = await gqlRawPaced<T>(token, query, variables)
  if (r.errors.length)
    throw new ApiError(r.errors, r.status)
  return r.data as T
}

export async function gqlErrorPaced(token: string | null, query: string, variables?: unknown): Promise<GqlError | null> {
  const r = await gqlRawPaced(token, query, variables)
  return r.errors[0] ?? null
}

// ── Стенд ──────────────────────────────────────────────────────────────────

/**
 * Программа «Благорост» и конфигурация контракта. Быстрый полигон не гоняет
 * контрактные наборы boot, которые их заводят, поэтому подготовка — тем же
 * засевом, что у docs-harness (seed-capital 01-programs, идемпотентен).
 */
export async function ensureCapitalProgram(): Promise<void> {
  const state = await tableRows<any>(CAPITAL, CAPITAL, 'state')
  const programs = await tableRows<any>('soviet', COOP, 'programs')
  if (state.some(r => r.coopname === COOP) && programs.some(p => Number(p.id) === CAPITAL_PROGRAM_ID))
    return
  const r = spawnSync(
    'pnpm',
    ['--filter', '@coopenomics/boot', 'exec', 'esno', 'src/scripts/seed-capital/index.ts', '01-programs'],
    { cwd: REPO_ROOT, env: { ...process.env, CHAIN_URL }, encoding: 'utf8' },
  )
  if (r.status !== 0)
    throw new Error(`seed-capital 01-programs упал:\n${(r.stderr || r.stdout).slice(-2000)}`)
}

async function coop(name: string, data: Record<string, unknown>, account = CAPITAL): Promise<any> {
  return transact(COOP_SIGNER, [{ account, name, data: { coopname: COOP, ...data } }])
}

/**
 * Одобрение председателем (soviet::confirmapprv) — договор УХД, приложение,
 * результат. Документ одобрения заменяет в цепи исходный: для заявления о
 * результате это то же заявление со второй подписью (`approveStatement`).
 */
export async function chairmanApprove(approvalHash: string, approvedDocument: unknown = chainDoc([CHAIRMAN])): Promise<void> {
  await coop('confirmapprv', { username: CHAIRMAN.account, approval_hash: approvalHash, approved_document: approvedDocument }, 'soviet')
}

/**
 * Председатель одобряет заявление о результате так, как это делает рабочий
 * стол: ставит вторую подпись на тот же документ, поверх подписи пайщика.
 */
export async function approveStatement(resultHash: string, generated: any, signedByMember: any): Promise<void> {
  const approved = await signDocument(DEFAULT_WIF, generated, CHAIRMAN.account, 2, [signedByMember])
  await chairmanApprove(resultHash, toChainDoc(approved))
}

// ── Участник программы ─────────────────────────────────────────────────────

export const CONTRIBUTOR_FIELDS = 'username status contributor_hash contributed_as_investor block_num'

export async function contributorOf(token: string, username: string): Promise<any | null> {
  const d = await gql<any>(token, `query($d:GetContributorInput!){ capitalContributor(data:$d){ ${CONTRIBUTOR_FIELDS} } }`, { d: { username } })
  return d.capitalContributor
}

/** Пайщик подписал соглашение программы «Благорост» (wallet::signagree). */
export async function signCapitalAgreement(who: Who): Promise<void> {
  await coop('signagree', { username: who.account, program_id: CAPITAL_PROGRAM_ID, document: chainDoc([who]), draft_id: CAPITAL_DRAFT_ID }, 'wallet')
}

const REG_DOCS = ['generation_contract', 'storage_agreement', 'blagorost_agreement', 'generator_offer'] as const

/**
 * Свежий участник Благороста — тем же путём, что рабочий стол
 * (CapitalRegistrationPage): пакет документов регистрации из генератора,
 * подпись ключом пайщика, отправка договора УХД через API и одобрение
 * председателем. Возвращается, когда контроллер видит договор действующим.
 *
 * Договор, отправленный в цепь мимо контроллера, в зеркало не попадает:
 * строку участника без имени синхронизатор не записывает (display_name
 * обязателен), а имя знает только контроллер.
 */
export async function capitalMember(prefix = 'cap'): Promise<Who> {
  const who = freshMember({ prefix })
  await signCapitalAgreement(who)
  const token = await tokenOf(who)
  const gen = await gqlPaced<any>(token, `mutation($d:GenerateCapitalRegistrationDocumentsInputDTO!){
    capitalGenerateRegistrationDocuments(data:$d){
      ${REG_DOCS.map(k => `${k}{ ${GENERATED} }`).join(' ')}
    }
  }`, { d: { coopname: COOP, username: who.account, lang: 'ru' } })
  const bundle = gen.capitalGenerateRegistrationDocuments
  const signed: Record<string, unknown> = {}
  for (const key of REG_DOCS) {
    if (bundle[key])
      signed[key] = await signDocument(who.wif, bundle[key], who.account)
  }
  await gqlPaced(token, `mutation($d:CompleteCapitalRegistrationInputDTO!){ capitalCompleteRegistration(data:$d){ transaction } }`, {
    d: { coopname: COOP, username: who.account, ...signed, about: 'Участник внешнего слоя тестов', rate_per_hour: '1000', hours_per_day: 8 },
  })
  const chairToken = await tokenOf(CHAIRMAN)
  const pending = await contributorOf(chairToken, who.account)
  if (!pending?.contributor_hash)
    throw new Error(`после регистрации у ${who.account} нет договора УХД в зеркале`)
  await chairmanApprove(pending.contributor_hash)
  await waitFor(async () => ((await contributorOf(chairToken, who.account))?.status === 'ACTIVE' ? true : null),
    { timeoutMs: 120_000, intervalMs: 1_000, label: `договор УХД ${who.account} действует в зеркале` })
  return who
}

// ── Проект ─────────────────────────────────────────────────────────────────

export async function chainProject(hash: string): Promise<any> {
  const rows = await tableRows<any>(CAPITAL, COOP, 'projects', { index: 3, keyType: 'sha256', lower: hash, upper: hash })
  return rows.find(r => r.project_hash === hash)
}

export async function chainSegment(project: string, username: string): Promise<any> {
  const rows = await tableRows<any>(CAPITAL, COOP, 'segments', { index: 2, keyType: 'sha256', lower: project, upper: project })
  return rows.find(r => r.project_hash === project && r.username === username)
}

export async function chainResult(resultHash: string): Promise<any> {
  const rows = await tableRows<any>(CAPITAL, COOP, 'results')
  return rows.find(r => r.result_hash === resultHash)
}

/** Проект (parent пуст) или компонент (parent — хэш проекта); ждёт зеркала. */
export async function createProject(title: string, parent = ZERO_HASH): Promise<string> {
  const hash = randomHash()
  await coop('createproj', { project_hash: hash, parent_hash: parent, title, description: '', invite: '', meta: '', data: '' })
  const token = await tokenOf(CHAIRMAN)
  await waitFor(async () => {
    const d = await gql<any>(token, 'query($d:GetProjectInput!){ capitalProject(data:$d){ project_hash } }', { d: { hash } })
    return d.capitalProject ? true : null
  }, { timeoutMs: 120_000, intervalMs: 1_000, label: `проект ${hash.slice(0, 8)} в зеркале` })
  return hash
}

/** Допуск к проекту: приложение к договору УХД и его одобрение. */
export async function clearance(who: Who, project: string): Promise<void> {
  const appendixHash = randomHash()
  await coop('getclearance', { username: who.account, project_hash: project, appendix_hash: appendixHash, document: chainDoc([who]) })
  await chairmanApprove(appendixHash)
}

export async function setMaster(project: string, master: Who): Promise<void> {
  await coop('setmaster', { project_hash: project, master: master.account })
}

export async function setPlan(project: string, master: Who, hours = 100, expenses = 10_000): Promise<void> {
  await coop('setplan', {
    master: master.account,
    project_hash: project,
    plan_creators_hours: hours,
    plan_expenses: rub(expenses),
    plan_hour_cost: RATE_PER_HOUR,
  })
}

export async function startProject(project: string): Promise<void> {
  await coop('startproject', { project_hash: project })
}

export async function addAuthorOnChain(project: string, author: Who): Promise<void> {
  await coop('addauthor', { project_hash: project, author: author.account })
}

/** Часы создателя: коммит и его приём мастером. */
export async function commitHours(project: string, creator: Who, master: Who, hours: number): Promise<void> {
  const commitHash = randomHash()
  await coop('createcmmt', {
    username: creator.account,
    project_hash: project,
    commit_hash: commitHash,
    creator_hours: hours,
    description: `Работа ${creator.account}`,
    meta: '',
  })
  await coop('approvecmmt', { master: master.account, commit_hash: commitHash })
}

/**
 * Голосование по проекту целиком: старт, голоса каждого участника за
 * остальных поровну, завершение и подсчёт по каждому. После него проект
 * «завершён» (result), доли ждут обновления.
 */
export async function runVoting(project: string, voters: Who[]): Promise<void> {
  await coop('startvoting', { project_hash: project })
  for (const voter of voters) {
    const row = await chainProject(project)
    const [total, symbol] = String(row.voting.amounts.active_voting_amount).split(' ')
    const others = voters.filter(v => v.account !== voter.account)
    const totalMinor = Math.round(Number.parseFloat(total) * 10_000)
    const each = Math.floor(totalMinor / others.length)
    const votes = others.map((o, i) => {
      const minor = i === others.length - 1 ? totalMinor - each * (others.length - 1) : each
      return { recipient: o.account, amount: `${(minor / 10_000).toFixed(4)} ${symbol}` }
    })
    await coop('submitvote', { voter: voter.account, project_hash: project, votes })
  }
  await coop('cmpltvoting', { project_hash: project })
  for (const voter of voters)
    await coop('calcvotes', { username: voter.account, project_hash: project })
}

// ── Совет ──────────────────────────────────────────────────────────────────

export async function decisionFor(hash: string): Promise<any | undefined> {
  const rows = await tableRows<any>('soviet', COOP, 'decisions')
  return rows.find(d => String(d.hash).toLowerCase() === hash.toLowerCase())
}

async function votingBoardMembers(): Promise<string[]> {
  const boards = await tableRows<any>('soviet', COOP, 'boards')
  const board = boards.find(b => b.type === 'soviet') ?? boards[0]
  const members = (board?.members ?? []).filter((m: any) => Boolean(Number(m.is_voting) || m.is_voting === true)).map((m: any) => m.username as string)
  return members.length ? members : [CHAIRMAN.account]
}

/** Голоса «за» всех голосующих членов совета, ещё не голосовавших (у совета стенда общий ключ boot). */
export async function voteForDecision(decisionId: number): Promise<void> {
  const { Classes } = await import('@coopenomics/sdk')
  const decision = (await tableRows<any>('soviet', COOP, 'decisions')).find(d => Number(d.id) === decisionId)
  const voted = new Set<string>([...(decision?.votes_for ?? []), ...(decision?.votes_against ?? [])])
  const actions: any[] = []
  for (const member of await votingBoardMembers()) {
    if (voted.has(member))
      continue
    const vote = await new (Classes as any).Vote(DEFAULT_WIF).voteFor(COOP, member, decisionId, 'active')
    actions.push({ account: 'soviet', name: 'votefor', authorization: [{ actor: member, permission: 'active' }], data: vote })
  }
  if (actions.length)
    await transact(COOP_SIGNER, actions)
}

/** Утверждение решения председателем с приложенным протоколом и исполнение. */
export async function authorizeDecision(decisionId: number, protocol: any): Promise<void> {
  await transact(COOP_SIGNER, [
    {
      account: 'soviet',
      name: 'authorize',
      data: { coopname: COOP, chairman: CHAIRMAN.account, decision_id: decisionId, document: toChainDoc(protocol), permission: 'active' },
    },
    { account: 'soviet', name: 'exec', data: { executer: CHAIRMAN.account, coopname: COOP, decision_id: decisionId } },
  ])
}

/**
 * Решение совета о приёме РИД из генератора. Генератор собирает протокол по
 * голосам совета, а голоса отданы в цепь мимо контроллера — до того, как их
 * увидит индекс действий, генерация отвечает отказом генератора.
 */
export async function generateResultDecision(token: string, decisionId: number, resultHash: string): Promise<any> {
  return waitFor(async () => {
    const r = await gqlRawPaced<any>(token, GEN_DECISION, { d: { decision_id: decisionId, result_hash: resultHash, username: CHAIRMAN.account } })
    if (!r.errors.length)
      return r.data.capitalGenerateResultContributionDecision
    if (r.errors[0].code === 'GENERATOR_DOCUMENT_GENERATION_FAILED')
      return null
    throw new ApiError(r.errors, r.status)
  }, { timeoutMs: 180_000, intervalMs: 3_000, label: `протокол решения ${decisionId} по голосам совета` })
}

/**
 * Протокол, не собранный генератором: тот же формат и подпись председателя,
 * но без полей решения о приёме РИД. Нужен, чтобы проверить, что контроллер
 * не выпускает акт по решению, расходящемуся с заявлением.
 */
export async function foreignProtocol(decisionId: number): Promise<any> {
  const { Classes } = await import('@coopenomics/sdk')
  const generated = {
    full_title: 'Протокол решения совета',
    html: '<p>Протокол</p>',
    hash: randomHash(),
    meta: {
      title: 'Протокол решения совета',
      registry_id: 600,
      lang: 'ru',
      generator: 'api-tests',
      version: '1.0.0',
      coopname: COOP,
      username: CHAIRMAN.account,
      created_at: new Date().toISOString(),
      block_num: 0,
      timezone: 'UTC',
      links: [],
      decision_id: decisionId,
    },
    binary: '',
  }
  return new (Classes as any).Document(DEFAULT_WIF).signDocument(generated, CHAIRMAN.account, 1)
}

// ── Чтение через API ───────────────────────────────────────────────────────

export const SEGMENT_FIELDS = 'username project_hash status is_author is_creator is_completed intellectual_cost debt_amount available_for_program total_segment_cost share_percent has_voted project_title parent_title parent_hash project_status'

export async function segmentsOf(token: string, filter: Record<string, unknown>): Promise<any[]> {
  const d = await gql<any>(token, `query($f:CapitalSegmentFilter,$o:PaginationInput){
    capitalSegments(filter:$f, options:$o){ totalCount items{ ${SEGMENT_FIELDS} } }
  }`, { f: filter, o: { page: 1, limit: 100 } })
  return d.capitalSegments.items
}

export async function segmentOf(token: string, project: string, username: string): Promise<any | null> {
  const d = await gql<any>(token, `query($f:CapitalSegmentFilter){ capitalSegment(filter:$f){ ${SEGMENT_FIELDS} } }`, { f: { project_hash: project, username } })
  return d.capitalSegment
}

export const RESULT_FIELDS = `result_hash status username project_hash total_amount debt_amount
  statement{ hash }
  authorization{ hash }
  act{ hash rawDocument{ full_title html hash meta binary } document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } } }`

export async function resultOf(token: string, project: string, username: string): Promise<any | null> {
  const d = await gql<any>(token, `query($f:ResultFilter){ capitalResults(filter:$f){ items{ ${RESULT_FIELDS} } } }`, { f: { projectHash: project, username } })
  return (d.capitalResults.items as any[]).find(r => r.project_hash === project && r.username === username) ?? null
}

/** Обновление доли пайщиком через API — здесь же контроллер собирает документ результата. */
export async function refreshSegment(who: Who, project: string): Promise<any> {
  const d = await gql<any>(await tokenOf(who), `mutation($d:RefreshSegmentInput!){ capitalRefreshSegment(data:$d){ ${SEGMENT_FIELDS} } }`,
    { d: { coopname: COOP, project_hash: project, username: who.account } })
  return d.capitalRefreshSegment
}

export const GEN_STATEMENT = `mutation($d:ResultContributionStatementGenerateInput!){ capitalGenerateResultContributionStatement(data:$d){ ${GENERATED} } }`
export const GEN_DECISION = `mutation($d:ResultContributionDecisionGenerateInput!){ capitalGenerateResultContributionDecision(data:$d){ ${GENERATED} } }`
export const GEN_ACT = `mutation($d:ResultContributionActGenerateInput!){ capitalGenerateResultContributionAct(data:$d){ ${GENERATED} } }`
export const PUSH_RESULT = `mutation($d:PushResultInput!){ capitalPushResult(data:$d){ ${SEGMENT_FIELDS} } }`
export const SIGN_ACT_CONTRIBUTOR = `mutation($d:SignActAsContributorInput!){ capitalSignActAsContributor(data:$d){ ${SEGMENT_FIELDS} } }`
export const SIGN_ACT_CHAIRMAN = `mutation($d:SignActAsChairmanInput!){ capitalSignActAsChairman(data:$d){ ${SEGMENT_FIELDS} } }`
export const CONVERT_SEGMENT = `mutation($d:ConvertSegmentInput!){ capitalConvertSegment(data:$d){ ${SEGMENT_FIELDS} } }`

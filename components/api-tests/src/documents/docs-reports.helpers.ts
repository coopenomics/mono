/**
 * Помощники доменов documents и reports: реестр шаблонов кооператива,
 * решения совета (голоса членов совета и утверждение председателем), правка
 * шаблонов в сети от имени оператора платформы.
 *
 * Голоса члены совета подписывают своим ключом и отправляют в цепь сами — так
 * ходит рабочий стол (VoteForDecision). Утверждение и исполнение решения
 * проводит контроллер (authorizeDecision) по протоколу, подписанному
 * председателем. Правка шаблона в сети (draft::upversion / editdraft в
 * области `draft`) — работа оператора платформы: для теста это подготовка
 * состояния, проверяемое читается через API.
 */
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { tableRows, transact } from '../core/chain'
import { gql } from '../core/client'
import { signDocument } from '../core/documents'
import { COOP, DEFAULT_WIF } from '../core/env'
import { CHAIRMAN } from '../core/roles'
import { waitFor } from '../core/wait'

export const TEMPLATE_FIELDS = 'registry_id extension_name kind approval bundle title order current_version approved_version approved_decision_id approved_at effective_version state pending_hash'

export interface TemplateRow {
  registry_id: number
  extension_name: string
  kind: string
  approval: 'None' | 'Required'
  bundle: string | null
  title: string
  order: number
  current_version: number | null
  approved_version: number | null
  approved_decision_id: number | null
  approved_at: string | null
  effective_version: number | null
  state: 'Approved' | 'NotApproved' | 'NotRequired' | 'Outdated' | 'Pending'
  pending_hash: string | null
}

export async function templates(token: string): Promise<TemplateRow[]> {
  const d = await gql<any>(token, `query($c:String!){ documentTemplates(coopname:$c){ ${TEMPLATE_FIELDS} } }`, { c: COOP })
  return d.documentTemplates as TemplateRow[]
}

export async function templateOf(token: string, registryId: number): Promise<TemplateRow> {
  const row = (await templates(token)).find(t => t.registry_id === registryId)
  if (!row)
    throw new Error(`документа ${registryId} нет в реестре шаблонов кооператива`)
  return row
}

/** Дождаться, пока строка реестра шаблонов не удовлетворит условию. */
export async function waitTemplate(token: string, registryId: number, ok: (t: TemplateRow) => boolean, label: string, timeoutMs = 120_000): Promise<TemplateRow> {
  return waitFor(async () => {
    const t = await templateOf(token, registryId)
    return ok(t) ? t : null
  }, { timeoutMs, intervalMs: 1_500, label })
}

export const PROPOSE = `mutation($d:ProposeDocumentApprovalInput!){ proposeDocumentApproval(data:$d){ ${TEMPLATE_FIELDS} } }`

export async function propose(registryIds: number[], title?: string): Promise<TemplateRow[]> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), PROPOSE, { d: { coopname: COOP, registry_ids: registryIds, ...(title ? { title } : {}) } })
  return d.proposeDocumentApproval as TemplateRow[]
}

export async function blank(token: string, registryId: number, edition: 'Approved' | 'Current'): Promise<{ registry_id: number, title: string, html: string, text_hash: string }> {
  const d = await gql<any>(token, `query($c:String!,$r:Int!,$e:DocumentTemplateEdition!){
    documentTemplateBlank(coopname:$c, registry_id:$r, edition:$e){ registry_id title html text_hash }
  }`, { c: COOP, r: registryId, e: edition })
  return d.documentTemplateBlank
}

// ── Шаблон в сети (оператор платформы) ─────────────────────────────────────

/** Оператор платформы: области `draft` правит системный аккаунт. */
const PLATFORM: Who = { account: 'eosio', email: '', wif: DEFAULT_WIF }

export interface DraftRow { registry_id: number, version: number, title: string, description: string, context: string, model: string }

export async function draftRow(registryId: number): Promise<DraftRow> {
  const [row] = await tableRows<any>('draft', 'draft', 'drafts', { lower: String(registryId), upper: String(registryId) })
  if (!row)
    throw new Error(`шаблона ${registryId} нет в draft::drafts`)
  return { ...row, registry_id: Number(row.registry_id), version: Number(row.version) }
}

export async function upversion(registryId: number): Promise<void> {
  await transact(PLATFORM, [{ account: 'draft', name: 'upversion', data: { scope: 'draft', username: 'eosio', registry_id: registryId } }])
}

export async function editDraftContext(registryId: number, context: string): Promise<void> {
  const row = await draftRow(registryId)
  await transact(PLATFORM, [{
    account: 'draft',
    name: 'editdraft',
    data: { scope: 'draft', username: 'eosio', registry_id: registryId, title: row.title, description: row.description, context, model: row.model },
  }])
}

/**
 * Документ можно вынести на совет: он не утверждён, устарел или уже в
 * повестке. Утверждённый документ оператор поднимает на редакцию — так он
 * становится устаревшим, а действующая для пайщиков редакция не меняется.
 */
export async function ensureProposable(token: string, registryIds: number[]): Promise<void> {
  for (const id of registryIds) {
    const t = await templateOf(token, id)
    if (t.state !== 'Approved')
      continue
    await upversion(id)
    await waitTemplate(token, id, x => x.state === 'Outdated', `документ ${id} устарел после новой редакции в сети`)
  }
}

// ── Решения совета ─────────────────────────────────────────────────────────

/** Голосующие члены совета стенда (boot:extra): председатель и двое членов. */
export const VOTERS = ['ant', 'petr', 'anna'] as const

export interface AgendaRow {
  id: number
  hash: string
  type: string
  meta: string
  votes_for: string[]
  votes_against: string[]
  statementMeta: Record<string, any>
  html: string | null
}

export async function agendaByHash(token: string, hash: string): Promise<AgendaRow | null> {
  const d = await gql<any>(token, `query{ getAgenda{
    table{ id hash type meta votes_for votes_against statement{ meta } }
    documents{ statement{ documentAggregate{ rawDocument{ html } } } }
  } }`)
  const row = (d.getAgenda as any[]).find(a => String(a.table.hash ?? '').toLowerCase() === hash.toLowerCase())
  if (!row)
    return null
  let statementMeta: Record<string, any> = {}
  try {
    statementMeta = JSON.parse(row.table.statement?.meta || '{}')
  }
  catch {}
  return {
    id: Number(row.table.id),
    hash: row.table.hash,
    type: row.table.type,
    meta: row.table.meta,
    votes_for: row.table.votes_for ?? [],
    votes_against: row.table.votes_against ?? [],
    statementMeta,
    html: row.documents?.statement?.documentAggregate?.rawDocument?.html ?? null,
  }
}

/** Все вопросы повестки — для проверок «новый проект не создан». */
export async function agendaAll(token: string): Promise<{ id: number, hash: string, meta: string }[]> {
  const d = await gql<any>(token, 'query{ getAgenda{ table{ id hash meta } } }')
  return (d.getAgenda as any[]).map(a => ({ id: Number(a.table.id), hash: String(a.table.hash ?? ''), meta: String(a.table.meta ?? '') }))
}

/** Голоса членов совета ключом стенда — так, как голосует рабочий стол. */
export async function vote(decision: AgendaRow, side: 'for' | 'against'): Promise<void> {
  const { Classes } = await import('@coopenomics/sdk')
  const signer: any = new Classes.Vote(DEFAULT_WIF)
  for (const voter of VOTERS) {
    if (decision.votes_for.includes(voter) || decision.votes_against.includes(voter))
      continue
    const data = side === 'for'
      ? await signer.voteFor(COOP, voter, decision.id)
      : await signer.voteAgainst(COOP, voter, decision.id)
    await transact({ account: voter, email: '', wif: DEFAULT_WIF }, [{
      account: 'soviet',
      name: side === 'for' ? 'votefor' : 'voteagainst',
      data,
    }])
  }
}

/**
 * Председатель утверждает принятое свободное решение: протокол решения из
 * фабрики, подпись председателя, утверждение и исполнение — контроллером.
 */
export async function authorizeFreeDecision(decision: AgendaRow): Promise<void> {
  const token = await tokenOf(CHAIRMAN)
  let projectId = decision.statementMeta.project_id as string | undefined
  if (!projectId) {
    try {
      projectId = JSON.parse(decision.meta || '{}').project_id
    }
    catch {}
  }
  if (!projectId)
    throw new Error(`у решения ${decision.id} нет project_id ни в заявлении, ни в meta`)
  const gen = await gql<any>(token, `mutation($d:FreeDecisionGenerateDocumentInput!,$o:GenerateDocumentOptionsInput){
    generateFreeDecision(data:$d, options:$o){ full_title html hash meta binary }
  }`, { d: { coopname: COOP, username: CHAIRMAN.account, decision_id: decision.id, project_id: projectId }, o: { lang: 'ru' } })
  const signed = await signDocument(CHAIRMAN.wif, gen.generateFreeDecision, CHAIRMAN.account, 1)
  await gql(token, 'mutation($d:AuthorizeDecisionInput!){ authorizeDecision(data:$d){ __typename } }', {
    d: { coopname: COOP, chairman: CHAIRMAN.account, decision_id: decision.id, document: signed },
  })
}

export async function declineDecision(decisionId: number): Promise<void> {
  await gql(await tokenOf(CHAIRMAN), 'mutation($d:DeclineDecisionInput!){ declineDecision(data:$d){ __typename } }', {
    d: { coopname: COOP, decision_id: decisionId },
  })
}

// ── Инбокс председателя ────────────────────────────────────────────────────

export interface InboxItem { id: string, workflowId: string, title: string, body: string, payload: any, createdAt: string }

export async function inbox(token: string, limit = 100): Promise<InboxItem[]> {
  const d = await gql<any>(token, `query($c:String!,$p:PaginationInput!){
    getInboxNotifications(coopname:$c, pagination:$p){ items{ id workflowId title body payload createdAt } }
  }`, { c: COOP, p: { page: 1, limit, sortOrder: 'DESC' } })
  return d.getInboxNotifications.items as InboxItem[]
}

/** Разметка документа в тексте: сущности HTML раскрыты, пробелы схлопнуты. */
export function plain(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, '\'')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

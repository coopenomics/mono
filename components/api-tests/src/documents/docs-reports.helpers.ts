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
import crypto from 'node:crypto'
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { tableRows, transact } from '../core/chain'
import { gql } from '../core/client'
import { docMeta, signDocument } from '../core/documents'
import { COOP, DEFAULT_WIF } from '../core/env'
import { CHAIRMAN, ROLES } from '../core/roles'
import { waitFor } from '../core/wait'
import { COOP_SIGNER, amount, availableShare, rub } from '../core/wallet'
import { getOrder, pickOffer, placeOrder } from '../marketplace/flow'

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
  username: string
  meta: string
  votes_for: string[]
  votes_against: string[]
  statementMeta: Record<string, any>
  html: string | null
}

export async function agendaByHash(token: string, hash: string): Promise<AgendaRow | null> {
  const d = await gql<any>(token, `query{ getAgenda{
    table{ id hash type meta username votes_for votes_against statement{ meta } }
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
    username: row.table.username,
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
  // Протокол собирается по голосам из журнала действий узла, а голоса ушли в
  // цепь мимо контроллера — ждём, пока узел их разберёт.
  const gen = await waitFor(() => gql<any>(token, `mutation($d:FreeDecisionGenerateDocumentInput!,$o:GenerateDocumentOptionsInput){
    generateFreeDecision(data:$d, options:$o){ full_title html hash meta binary }
  }`, { d: { coopname: COOP, username: CHAIRMAN.account, decision_id: decision.id, project_id: projectId }, o: { lang: 'ru' } }),
  { timeoutMs: 90_000, intervalMs: 2_000, label: `протокол решения ${decision.id} по голосам совета` })
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

// ── Материальная помощь доверенному участка (p.brn.aid) ────────────────────
//
// Единственный источник удержанного НДФЛ: выплата матпомощи проводит
// o.brn.aidtax (удержание в w.sov.ndfl) и o.brn.aid (выплата на руки). Путь
// тот же, что у стола: деньги в общем кошельке участка → распределение
// председателем участка на персональный кошелёк → заявление → решение совета
// → кассир подтверждает перевод.
//
// Общий кошелёк участка на стенде пополняется из пула членских взносов
// Стола заказов (branch::accrue от имени кооператива, как при закрытии
// выдачи); пул наполняет обычный заказ пайщика. Это подготовка состояния.

export const KRG = 'krg'

/** Остаток кошелька кооператива ledger2 (w.mkt.fee, w.sov.ndfl…). */
export async function coopWallet(id: string): Promise<number> {
  const rows = await tableRows<any>('ledger2', COOP, 'wallets')
  return amount(rows.find(r => r.id === id)?.available)
}

async function branchEconomy(token: string): Promise<any> {
  const d = await gql<any>(token, `query($b:String!){ marketplaceGetBranchEconomy(braname:$b){
    common_balance reserve_amount available_to_distribute total_weight weights{ username weight personal_balance }
  } }`, { b: KRG })
  return d.marketplaceGetBranchEconomy
}

/**
 * Паевой взнос деньгами: заявка на приход (wallet::createdpst) и его
 * исполнение шлюзом (gateway::incomplete) — как платёжный провайдер.
 * Помощник ядра deposit() зовёт прежние имена действий (createdeposit /
 * completeincome), которых в контрактах больше нет.
 */
async function depositShare(username: string, sum: number): Promise<void> {
  const hash = crypto.randomBytes(32).toString('hex')
  await transact(COOP_SIGNER, [{ account: 'wallet', name: 'createdpst', data: { coopname: COOP, username, deposit_hash: hash, quantity: rub(sum) } }])
  await transact(COOP_SIGNER, [{ account: 'gateway', name: 'incomplete', data: { coopname: COOP, income_hash: hash } }])
}

/** Паевой остаток пайщика не меньше нужного, и зеркало контроллера это видит. */
async function ensureShare(who: Who, minimumRub: number): Promise<void> {
  const have = await availableShare(who.account)
  if (have < minimumRub)
    await depositShare(who.account, Math.ceil(minimumRub - have) + 10_000)
  const token = await tokenOf(who)
  await waitFor(async () => {
    const d = await gql<any>(token, 'query{ marketplaceMemberWallet{ wallets{ name available } } }')
    const row = d.marketplaceMemberWallet.wallets.find((w: any) => w.name === 'w.wal.share')
    return row && amount(row.available) >= minimumRub ? true : null
  }, { timeoutMs: 120_000, intervalMs: 2_000, label: `зеркало кошелька ${who.account} ≥ ${minimumRub} RUB` })
}

/** Пул членских взносов не меньше нужного: при нехватке — заказ пайщика. */
async function ensureFeePool(need: number): Promise<void> {
  let rate = 0.1
  for (let round = 0; round < 4; round++) {
    const pool = await coopWallet('w.mkt.fee')
    if (pool >= need)
      return
    const member = ROLES.member()
    const token = await tokenOf(member)
    // Каталог целиком видит председатель кооператива, пайщику — только витрина.
    const offer = await pickOffer(await tokenOf(CHAIRMAN), ROLES.supplier().account, KRG, 'Мёд цветочный')
    const price = amount(offer.price_per_unit)
    const qty = Math.max(1, Math.ceil((need - pool) / (price * rate)) + 1)
    await ensureShare(member, price * qty * 2 + 1_000)
    const { orderId } = await placeOrder({ who: member, offerId: offer.id, quantity: qty })
    const order = await getOrder(token, orderId)
    const fee = amount(order.membership_fee)
    const cost = amount(order.total_cost)
    if (fee > 0 && cost > 0)
      rate = fee / cost
  }
  throw new Error(`пул членских взносов w.mkt.fee не набрал ${need} RUB`)
}

/** Персональный кошелёк председателя участка krg не меньше нужного. */
async function ensurePersonalFunds(need: number): Promise<void> {
  const chair = ROLES.branchChairman()
  const token = await tokenOf(chair)
  for (let round = 0; round < 3; round++) {
    const eco = await branchEconomy(token)
    const mine = (eco.weights as any[]).find(w => w.username === chair.account)
    const have = amount(mine?.personal_balance)
    if (have >= need)
      return
    if (!mine) {
      await gql(token, 'mutation($d:MarketplaceSetTrusteeWeightInput!){ marketplaceSetTrusteeWeight(data:$d) }', {
        d: { braname: KRG, username: chair.account, weight: 1 },
      })
      continue
    }
    const total = Number(eco.total_weight) || Number(mine.weight)
    const toDistribute = Math.ceil((need - have) * total / Number(mine.weight)) + 1
    const reserve = amount(eco.reserve_amount)
    const common = amount(eco.common_balance)
    const shortage = toDistribute + reserve - common
    if (shortage > 0) {
      const topUp = Math.ceil(shortage) + 1
      await ensureFeePool(topUp)
      await transact(COOP_SIGNER, [{
        account: 'branch',
        name: 'accrue',
        data: {
          coopname: COOP,
          braname: KRG,
          source_contract: 'marketplace',
          amount: rub(topUp),
          process_type: 'p.brn.fees',
          process_hash: crypto.randomBytes(32).toString('hex'),
          memo: 'Внешний слой: членские взносы участка под материальную помощь',
        },
      }])
    }
    await gql(token, 'mutation($d:MarketplaceDistributeBranchFundsInput!){ marketplaceDistributeBranchFunds(data:$d) }', {
      d: { braname: KRG, amount: toDistribute },
    })
  }
  throw new Error(`персональный кошелёк председателя участка не набрал ${need} RUB`)
}

let paymentMethodId = ''

async function chairPaymentMethod(): Promise<string> {
  if (paymentMethodId)
    return paymentMethodId
  const chair = ROLES.branchChairman()
  const token = await tokenOf(chair)
  const list = await gql<any>(token, 'query($d:GetPaymentMethodsInput){ getPaymentMethods(data:$d){ items{ method_id } } }', {
    d: { username: chair.account, page: 1, limit: 10, sortOrder: 'ASC' },
  })
  paymentMethodId = list.getPaymentMethods.items[0]?.method_id ?? ''
  if (!paymentMethodId) {
    const m = await gql<any>(token, 'mutation($d:AddPaymentMethodInput!){ addPaymentMethod(data:$d){ method_id } }', {
      d: {
        username: chair.account,
        is_default: true,
        bank_transfer_data: {
          account_number: '40817810099910004312',
          bank_name: 'ПАО Сбербанк',
          currency: 'RUB',
          details: { bik: '044525225', corr: '30101810400000000225' },
        },
      },
    })
    paymentMethodId = m.addPaymentMethod.method_id
  }
  return paymentMethodId
}

export interface GatewayPaymentRow { id: string, hash: string, status: string, quantity: number, type: string, username: string, message: string | null }

export async function paymentByHash(hash: string, type?: string): Promise<GatewayPaymentRow | null> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), `query($d:PaymentFiltersInput,$o:PaginationInput){
    getPayments(data:$d, options:$o){ items{ id hash quantity status type username message } }
  }`, { d: { hash, ...(type ? { type } : {}) }, o: { page: 1, limit: 10, sortOrder: 'DESC' } })
  return (d.getPayments.items as any[]).find(p => String(p.hash).toLowerCase() === hash.toLowerCase()) ?? null
}

/** Кассир (председатель стенда) подтверждает фактический перевод. */
export async function cashierPaid(paymentId: string): Promise<void> {
  await gql(await tokenOf(CHAIRMAN), 'mutation($d:SetPaymentStatusInput!){ setPaymentStatus(data:$d){ id status } }', {
    d: { id: paymentId, status: 'PAID' },
  })
}

export interface LedgerOp { operationCode: string | null, quantity: string | null, username: string | null, processHash: string | null, createdAt: string, walletFrom: string | null, walletTo: string | null }

export async function applyOps(processHash: string): Promise<LedgerOp[]> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), `query($i:GetLedger2HistoryInput!){
    getLedger2History(input:$i){ items{ operationCode quantity username processHash createdAt walletFrom walletTo } }
  }`, { i: { coopname: COOP, processHash: processHash.toLowerCase(), actionNames: ['apply'], limit: 50, page: 1 } })
  return d.getLedger2History.items as LedgerOp[]
}

export interface AidPayout {
  aidHash: string
  username: string
  gross: number
  tax: number
  net: number
  /** Время проводки выплаты (блок цепи, UTC). */
  paidAt: string
  decisionId: number
}

/**
 * Материальная помощь председателю участка krg на сумму заявления `gross`
 * от подачи до подтверждения перевода кассиром. Возвращает проводки выплаты.
 */
export async function payAid(gross: number): Promise<AidPayout> {
  const chair = ROLES.branchChairman()
  const token = await tokenOf(chair)
  await ensurePersonalFunds(gross)
  const methodId = await chairPaymentMethod()

  const pl = await gql<any>(token, `query($d:MarketplaceAidStatementSignablePayloadInput!){
    marketplaceAidStatementSignablePayload(data:$d){ full_title html hash meta binary }
  }`, { d: { braname: KRG, amount: gross } })
  const doc = pl.marketplaceAidStatementSignablePayload
  const aidHash = String(docMeta(doc.meta).aid_hash).toLowerCase()
  const signed = await signDocument(chair.wif, doc, chair.account, 1)
  await gql(token, 'mutation($d:MarketplaceCreateAidInput!){ marketplaceCreateAid(data:$d) }', {
    d: { braname: KRG, amount: gross, aid_hash: aidHash, statement: signed, payment_method_id: methodId },
  })

  const chairman = await tokenOf(CHAIRMAN)
  const decision = await waitFor(() => agendaByHash(chairman, aidHash), { timeoutMs: 60_000, label: `решение о матпомощи ${aidHash}` })
  await vote(decision, 'for')
  // Протокол собирается по голосам из журнала действий узла — ждём их разбора.
  const protocol = await waitFor(() => gql<any>(chairman, 'mutation($i:GenerateAnyDocumentInput!){ generateDocument(input:$i){ full_title html hash meta binary } }', {
    i: {
      data: {
        registry_id: 1112,
        coopname: COOP,
        // Генерация документа доступна только от своего имени — протокол
        // собирает председатель, получатель указан отдельным полем.
        username: CHAIRMAN.account,
        lang: 'ru',
        decision_id: decision.id,
        aid_hash: decision.statementMeta.aid_hash ?? aidHash,
        receiver: decision.statementMeta.username ?? chair.account,
        braname: decision.statementMeta.braname ?? KRG,
        amount: decision.statementMeta.amount,
      },
      options: { lang: 'ru' },
    },
  }), { timeoutMs: 90_000, intervalMs: 2_000, label: `протокол решения о матпомощи ${decision.id}` })
  const signedProtocol = await signDocument(CHAIRMAN.wif, protocol.generateDocument, CHAIRMAN.account, 1)
  await gql(chairman, 'mutation($d:AuthorizeDecisionInput!){ authorizeDecision(data:$d){ __typename } }', {
    d: { coopname: COOP, chairman: CHAIRMAN.account, decision_id: decision.id, document: signedProtocol },
  })

  // Платёж кассиру переходит в ожидание перевода по решению совета из ленты цепи.
  const payment = await waitFor(async () => {
    const p = await paymentByHash(aidHash, 'AID')
    return p && p.status === 'PENDING' ? p : null
  }, { timeoutMs: 90_000, intervalMs: 1_500, label: `выплата матпомощи ${aidHash} у кассира` })
  await cashierPaid(payment.id)

  const ops = await waitFor(async () => {
    const rows = await applyOps(aidHash)
    return rows.some(r => r.operationCode === 'o.brn.aid') ? rows : null
  }, { timeoutMs: 90_000, intervalMs: 1_500, label: `проводки выплаты матпомощи ${aidHash}` })
  const aid = ops.find(r => r.operationCode === 'o.brn.aid')!
  const taxOp = ops.find(r => r.operationCode === 'o.brn.aidtax')
  const net = amount(aid.quantity)
  const tax = amount(taxOp?.quantity)
  return { aidHash, username: aid.username ?? chair.account, gross: net + tax, tax, net, paidAt: aid.createdAt, decisionId: decision.id }
}

/** Дата по налоговому поясу (Москва, UTC+3): год, месяц, день. */
export function mskParts(iso: string): { year: number, month: number, day: number } {
  const d = new Date(new Date(iso).getTime() + 3 * 3_600_000)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** Сквозной номер расчётного периода уведомления по НДФЛ: 1..24. */
export function uvPeriodOf(month: number, day: number): number {
  return (month - 1) * 2 + (day > 22 ? 2 : 1)
}

// ── Отчёты ─────────────────────────────────────────────────────────────────

export async function initialEdits(reportType: string, year: number, period: number | null): Promise<any> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), `query($t:ReportType!,$y:Int!,$p:Int){
    buildInitialReportEdits(reportType:$t, year:$y, period:$p){ editsJson editedFields hasDraft }
  }`, { t: reportType, y: year, p: period })
  return JSON.parse(d.buildInitialReportEdits.editsJson)
}

export interface GeneratedReport { id: string | null, xml: string, isValid: boolean, errors: string[], fileName: string }

export async function generateReport(reportType: string, year: number, period: number | null, edits: unknown): Promise<GeneratedReport> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), `mutation($t:ReportType!,$y:Int!,$p:Int,$e:String!){
    generateReportFromEdits(reportType:$t, year:$y, period:$p, editsJson:$e){ id xml isValid errors fileName }
  }`, { t: reportType, y: year, p: period, e: JSON.stringify(edits) })
  return d.generateReportFromEdits
}

// ── Удержанный НДФЛ к перечислению ────────────────────────────────────────

export async function withheldState(): Promise<{ withheld: number, in_payment: number, available: number }> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), 'query{ getWithheldTaxState{ withheld in_payment available } }')
  const s = d.getWithheldTaxState
  return { withheld: amount(s.withheld), in_payment: amount(s.in_payment), available: amount(s.available) }
}

export const TAX_PAYMENT_FIELDS = 'hash amount symbol status message memo created_at completed_at report_period report_period_label report_year recipient_name requisite_rows{ label value }'

export async function withheldPayments(page = 1, limit = 50): Promise<any[]> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), `query($p:Int,$l:Int){ getWithheldTaxPayments(page:$p, limit:$l){ items{ ${TAX_PAYMENT_FIELDS} } } }`, { p: page, l: limit })
  return d.getWithheldTaxPayments.items
}

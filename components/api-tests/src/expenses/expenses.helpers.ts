/**
 * Шаги шасси расходов для внешних тестов: служебная записка (документ 2010,
 * подпись автора), подача в цепь, решение совета по ней (голоса в цепи,
 * протокол 2011 и утверждение через API). Проверок здесь нет — только путь
 * рабочего стола совета.
 */
import crypto from 'node:crypto'
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { tableRows, transact } from '../core/chain'
import { gql } from '../core/client'
import { signDocument } from '../core/documents'
import { COOP, DEFAULT_WIF } from '../core/env'
import { CHAIRMAN } from '../core/roles'
import { waitFor } from '../core/wait'
import { randomHash as hash64 } from '../core/chain'
import { addSbpMethod as addPaymentSbp } from '../payments/payments.helpers'

/** Пул программных расходов «Благороста» — кошелёк-источник шасси (EXPENSE_OPERATION_SETS). */
export const PROGRAM_EXPENSE_POOL = 'w.cap.pgexp'


export interface DraftItem {
  item_hash: string
  mechanics: 'ADVANCE' | 'DIRECT'
  recipient_type: 'SELF' | 'MEMBER' | 'ORG'
  /** Аккаунт получателя-пайщика; для организации — пусто. */
  recipient: string
  /** Имя получателя в документе. */
  recipient_name: string
  description: string
  /** «1500.0000 RUB». */
  planned_amount: string
  payment_method_id?: string
  requisites?: string
  payment_purpose?: string
}

export interface Draft {
  author: Who
  proposal_hash: string
  source_wallet: string
  description: string
  items: DraftItem[]
}

/** Сумма позиций asset-строкой. */
export function totalOf(items: DraftItem[]): string {
  const sum = items.reduce((s, it) => s + Number.parseFloat(it.planned_amount), 0)
  return `${sum.toFixed(4)} RUB`
}

/** Записка 2010 в фабрике и подпись автора (id=1) — как ExpenseProposalCreateDialog. */
export async function signedStatement(draft: Draft): Promise<any> {
  const token = await tokenOf(draft.author)
  const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const dd = String(deadline.getUTCDate()).padStart(2, '0')
  const mm = String(deadline.getUTCMonth() + 1).padStart(2, '0')
  const d = await gql<any>(token, `mutation($d:ExpenseProposalStatementGenerateDocumentInput!){
    generateExpenseProposalStatementDocument(data:$d){ full_title html hash meta binary }
  }`, {
    d: {
      coopname: COOP,
      username: draft.author.account,
      proposal_hash: draft.proposal_hash,
      proposal: {
        description: draft.description,
        total_amount: totalOf(draft.items),
        items_count: draft.items.length,
        source_wallet: draft.source_wallet,
        deadline: `${dd}.${mm}.${deadline.getUTCFullYear()}`,
      },
      items: draft.items.map((it, i) => ({
        number: String(i + 1),
        description: it.description,
        amount: it.planned_amount,
        recipient_type: it.recipient_type,
        mechanics: it.mechanics,
        recipient_name: it.recipient_name,
        recipient_username: it.recipient || undefined,
        requisites: it.requisites ?? '',
        payment_method_id: it.payment_method_id,
        payment_purpose: it.payment_purpose,
      })),
    },
  })
  return signDocument(draft.author.wif, d.generateExpenseProposalStatementDocument, draft.author.account, 1)
}

export const CREATE_PROPOSAL = `mutation($d:CreateExpenseProposalInput!){ createExpenseProposal(data:$d){ __typename } }`

/** Вход createExpenseProposal по черновику и подписанной записке. */
export function createInput(draft: Draft, statement: any, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    coopname: COOP,
    username: draft.author.account,
    proposal_hash: draft.proposal_hash,
    source_wallet: draft.source_wallet,
    items: draft.items.map(it => ({
      item_hash: it.item_hash,
      mechanics: it.mechanics,
      recipient_type: it.recipient_type,
      recipient: it.recipient,
      description: it.description,
      planned_amount: it.planned_amount,
      payment_method_id: it.payment_method_id,
      requisites: it.requisites,
      payment_purpose: it.payment_purpose,
    })),
    statement,
    ...over,
  }
}

/** Реквизиты СБП пайщика: он заводит их сам (самообход RolesGuard по username). */
export async function addSbpMethod(who: Who, phone: string): Promise<string> {
  return (await addPaymentSbp(await tokenOf(who), who.account, phone)).method_id
}

/** Вопрос повестки совета по записке — строка soviet::decisions с hash = proposal_hash. */
export async function decisionOf(proposalHash: string): Promise<any | undefined> {
  const rows = await tableRows<any>('soviet', COOP, 'decisions')
  return rows.find(r => String(r.hash).toLowerCase() === proposalHash.toLowerCase())
}

/** Совет стенда (boot:extra): пятеро с общим ключом, трое — большинство. */
const VOTERS = ['ant', 'petr', 'anna']

/**
 * Решение совета «утвердить»: голоса за — в цепь (так голосует рабочий стол
 * члена совета), протокол 2011 — фабрикой, утверждение и исполнение —
 * мутацией authorizeDecision от председателя.
 */
export async function approveByCouncil(proposalHash: string): Promise<number> {
  const decision = await decisionOf(proposalHash)
  if (!decision)
    throw new Error(`нет вопроса совета по записке ${proposalHash}`)
  const id = Number(decision.id)
  const voted = new Set<string>(decision.votes_for ?? [])
  const { Classes } = await import('@coopenomics/sdk')
  const signer: any = new Classes.Vote(DEFAULT_WIF)
  const actions = []
  for (const voter of VOTERS.filter(v => !voted.has(v))) {
    actions.push({
      account: 'soviet',
      name: 'votefor',
      authorization: [{ actor: voter, permission: 'active' }],
      data: await signer.voteFor(COOP, voter, id),
    })
  }
  if (actions.length)
    await transact({ account: VOTERS[0], email: '', wif: DEFAULT_WIF }, actions)

  const statementMeta = typeof decision.statement?.meta === 'string' ? JSON.parse(decision.statement.meta) : decision.statement?.meta
  const token = await tokenOf(CHAIRMAN)
  // Протокол собирается по голосам из журнала действий узла, а голоса ушли в
  // цепь мимо контроллера — ждём, пока узел их разберёт. Интервал 21 с: у
  // генерации протокола предел — три вызова в минуту.
  const gen = await waitFor(() => gql<any>(token, `mutation($d:ExpenseProposalDecisionGenerateDocumentInput!){
    generateExpenseProposalDecisionDocument(data:$d){ full_title html hash meta binary }
  }`, {
    d: {
      coopname: COOP,
      username: CHAIRMAN.account,
      proposal_hash: proposalHash,
      decision_id: id,
      proposal: statementMeta.proposal,
      items: statementMeta.items,
      resolution: { kind: 'approve' },
    },
  }), { timeoutMs: 150_000, intervalMs: 21_000, label: `протокол решения ${id} по голосам совета` })
  const signed = await signDocument(CHAIRMAN.wif, gen.generateExpenseProposalDecisionDocument, CHAIRMAN.account, 1)
  await gql<any>(token, `mutation($d:AuthorizeDecisionInput!){ authorizeDecision(data:$d){ __typename } }`, {
    d: { coopname: COOP, chairman: CHAIRMAN.account, decision_id: id, document: signed },
  })
  return id
}

/** Небольшой PDF/PNG-файл с уникальным содержимым — дубль по контрольной сумме отвергается. */
export function uniqueFile(mime: 'application/pdf' | 'image/png'): { base64: string, size: number, sha256: string } {
  const head = mime === 'application/pdf' ? Buffer.from('%PDF-1.4\n%api-tests\n') : Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  const body = Buffer.concat([head, crypto.randomBytes(64)])
  return {
    base64: body.toString('base64'),
    size: body.byteLength,
    sha256: crypto.createHash('sha256').update(body).digest('hex'),
  }
}

export { hash64 }

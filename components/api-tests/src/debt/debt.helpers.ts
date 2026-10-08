/**
 * Беспроцентные займы для внешних тестов: приложение «Беспроцентные займы»
 * (расширение debt), документы займа и шаги пути — заявление пайщика, решение
 * совета, подпись договора председателем, касса.
 *
 * Подготовка (участник «Благороста», паевой взнос в программу) идёт помощниками
 * Благороста. Проверяемое тесты читают через API. Ассертов здесь нет.
 */
import type { Who } from '../core'
import { CHAIRMAN, COOP, DEFAULT_WIF, awaitDecision, gql, gqlRaw, randomHash, signDocument, toChainDoc, tokenOf, voteOnDecision, waitFor } from '../core'
import { chairmanApprove } from '../capital/cap-results.helpers'

export const GENERATED = 'full_title html hash meta binary'
export const LOAN_FIELDS = `debt_hash contract_number status coopname username collateral source amount remaining pledged
  created_at issued_at due_at requested_due_at overdue_at last_pay_error
  statement{ hash } contract{ hash } signed_contract{ hash } decision{ hash } extension_statement{ hash }`

export const GET_LOAN = `query($h:String!){ debtLoan(debt_hash:$h){ ${LOAN_FIELDS} } }`
export const LOANS = `query($f:DebtLoanFilterInput!,$o:PaginationInput){ debtLoans(filter:$f, options:$o){ totalCount items{ debt_hash status username remaining } } }`
export const COLLATERAL = 'query($c:String!){ debtCollateralOptions(coopname:$c){ key human_name source_wallet pledge_wallet available basis_type basis_signed owner_contract } }'
export const REPAY_AVAILABLE = 'query($c:String!){ debtRepayAvailable(coopname:$c) }'
export const CREATE_LOAN = 'mutation($d:DebtCreateLoanInput!){ createDebtLoan(data:$d){ __typename } }'
export const CANCEL_LOAN = 'mutation($d:DebtCancelLoanInput!){ cancelDebtLoan(data:$d){ __typename } }'
export const RETRY_PAY = 'mutation($d:DebtLoanRefInput!){ retryDebtLoanPayment(data:$d){ __typename } }'
export const REPAY_LOAN = 'mutation($d:DebtRepayLoanInput!){ repayDebtLoan(data:$d){ __typename } }'
export const EXTEND_LOAN = 'mutation($d:DebtExtendLoanInput!){ extendDebtLoan(data:$d){ __typename } }'

const INSTALL = 'mutation($d:ExtensionInput!){ installExtension(data:$d){ name is_installed } }'

export function rubAsset(sum: number): string {
  return `${sum.toFixed(4)} RUB`
}

/** Срок возврата через столько дней — время цепи без зоны, конец дня. */
export function dueIn(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  return `${date.toISOString().slice(0, 10)}T23:59:59`
}

/**
 * Приложение «Беспроцентные займы» установлено и запущено: каталог ставит его
 * председатель, запуск не дожидается ответа установки — ждём, пока запрос
 * приложения начнёт отвечать.
 */
export async function ensureDebtInstalled(): Promise<void> {
  const token = await tokenOf(CHAIRMAN)
  await gqlRaw<any>(token, INSTALL, { d: { name: 'debt', enabled: true, config: {} } })
  await waitFor(async () => {
    const r = await gqlRaw<any>(token, COLLATERAL, { c: COOP })
    return r.errors.length === 0 ? true : null
  }, { timeoutMs: 120_000, intervalMs: 2_000, label: 'приложение «Беспроцентные займы» запущено' })
}

export async function loanOf(token: string, debtHash: string): Promise<any | null> {
  const r = await gqlRaw<any>(token, GET_LOAN, { h: debtHash })
  return r.errors.length ? null : r.data?.debtLoan ?? null
}

/** Ждёт, пока зеркало покажет заём в нужном состоянии. */
export async function awaitLoanStatus(token: string, debtHash: string, status: string): Promise<any> {
  return waitFor(async () => {
    const loan = await loanOf(token, debtHash)
    return loan?.status === status ? loan : null
  }, { timeoutMs: 120_000, intervalMs: 1_000, label: `заём ${debtHash.slice(0, 8)} в состоянии ${status}` })
}

export interface LoanDraft {
  member: Who
  debt_hash: string
  amount: number
  due_at: string
  method_id: string
  collateral?: string
}

export interface SubmittedLoan {
  debt_hash: string
  /** Договор из генератора — его же подписывает председатель второй подписью. */
  contractGenerated: any
  contractSigned: any
}

/** Заявление и договор из генератора с подписью пайщика — как диалог заявления на столе. */
export async function signedLoanDocuments(draft: LoanDraft): Promise<{ input: Record<string, unknown>, contractGenerated: any, contractSigned: any }> {
  const token = await tokenOf(draft.member)
  const base = {
    coopname: COOP,
    username: draft.member.account,
    debt_hash: draft.debt_hash,
    amount: rubAsset(draft.amount),
    due_at: draft.due_at,
    collateral: draft.collateral ?? 'blago',
  }
  const st = await gql<any>(token, `mutation($d:DebtGenerateLoanStatementInput!){ generateDebtLoanStatementDocument(data:$d){ ${GENERATED} } }`, { d: { ...base, method_id: draft.method_id } })
  const ct = await gql<any>(token, `mutation($d:DebtGenerateLoanContractInput!){ generateDebtLoanContractDocument(data:$d){ ${GENERATED} } }`, { d: base })
  const statement = await signDocument(draft.member.wif, st.generateDebtLoanStatementDocument, draft.member.account, 1)
  const contractGenerated = ct.generateDebtLoanContractDocument
  const contractSigned = await signDocument(draft.member.wif, contractGenerated, draft.member.account, 1)
  return { input: { ...base, statement, contract: contractSigned }, contractGenerated, contractSigned }
}

/** Пайщик подаёт заявление на заём. */
export async function submitLoan(draft: LoanDraft): Promise<SubmittedLoan> {
  const docs = await signedLoanDocuments(draft)
  await gql<any>(await tokenOf(draft.member), CREATE_LOAN, { d: docs.input })
  return { debt_hash: draft.debt_hash, contractGenerated: docs.contractGenerated, contractSigned: docs.contractSigned }
}

/**
 * Решение совета «предоставить заём»: голоса за — в цепь, протокол 1051 —
 * генератором приложения по данным заявления, утверждение — мутацией
 * authorizeDecision от председателя.
 */
export async function approveLoanByCouncil(draft: LoanDraft): Promise<number> {
  const decision = await awaitDecision(draft.debt_hash)
  const id = Number(decision.id)
  await voteOnDecision(id, 'for')
  const token = await tokenOf(CHAIRMAN)
  // Протокол собирается по голосам из журнала действий узла, а голоса ушли в
  // цепь мимо контроллера. Интервал 21 с: у генерации предел — пять вызовов в минуту.
  const gen = await waitFor(() => gql<any>(token, `mutation($d:DebtGenerateLoanDecisionInput!){ generateDebtLoanDecisionDocument(data:$d){ ${GENERATED} } }`, {
    d: {
      coopname: COOP,
      // Протокол формируется на имя заёмщика — как его запрашивает стол совета.
      username: draft.member.account,
      debt_hash: draft.debt_hash,
      amount: rubAsset(draft.amount),
      due_at: draft.due_at,
      collateral: draft.collateral ?? 'blago',
      decision_id: id,
    },
  }), { timeoutMs: 150_000, intervalMs: 21_000, label: `протокол решения ${id} о займе` })
  const signed = await signDocument(CHAIRMAN.wif, gen.generateDebtLoanDecisionDocument, CHAIRMAN.account, 1)
  await gql<any>(token, 'mutation($d:AuthorizeDecisionInput!){ authorizeDecision(data:$d){ __typename } }', {
    d: { coopname: COOP, chairman: CHAIRMAN.account, decision_id: id, document: signed },
  })
  return id
}

/** Председатель ставит вторую подпись на договор пайщика — запрос одобрения с хэшем займа. */
export async function signContractAsChairman(loan: SubmittedLoan): Promise<void> {
  const approved = await signDocument(DEFAULT_WIF, loan.contractGenerated, CHAIRMAN.account, 2, [loan.contractSigned])
  await chairmanApprove(loan.debt_hash, toChainDoc(approved))
}

/** Заявление о возврате с подписью пайщика и вход мутации возврата. */
export async function repayInput(member: Who, debtHash: string, sum: number): Promise<Record<string, unknown>> {
  const token = await tokenOf(member)
  const base = { coopname: COOP, username: member.account, debt_hash: debtHash, amount: rubAsset(sum) }
  const gen = await gql<any>(token, `mutation($d:DebtGenerateRepaymentStatementInput!){ generateDebtRepaymentStatementDocument(data:$d){ ${GENERATED} } }`, { d: base })
  const statement = await signDocument(member.wif, gen.generateDebtRepaymentStatementDocument, member.account, 1)
  return { ...base, statement }
}

/** Заявление о продлении с подписью пайщика: вход мутации и документ для подписи председателя. */
export async function extendInput(member: Who, debtHash: string, newDueAt: string): Promise<{ input: Record<string, unknown>, generated: any, signed: any }> {
  const token = await tokenOf(member)
  const base = { coopname: COOP, username: member.account, debt_hash: debtHash, new_due_at: newDueAt }
  const gen = await gql<any>(token, `mutation($d:DebtGenerateExtensionStatementInput!){ generateDebtExtensionStatementDocument(data:$d){ ${GENERATED} } }`, { d: base })
  const generated = gen.generateDebtExtensionStatementDocument
  const signed = await signDocument(member.wif, generated, member.account, 1)
  return { input: { ...base, statement: signed }, generated, signed }
}

export { randomHash }

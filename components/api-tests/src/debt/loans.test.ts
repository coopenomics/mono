/**
 * Беспроцентный заём под обеспечение паевым взносом — весь путь через API,
 * как его проходят рабочие столы: пайщик подаёт заявление с договором, совет
 * принимает решение, председатель подписывает договор, касса отклоняет и
 * затем проводит платёж, пайщик возвращает заём частями и продлевает срок.
 *
 * Один пайщик и один заём на файл: шаги идут по порядку и опираются друг на
 * друга. Второй заём того же пайщика проверяет отмену до решения совета.
 * Сроки просрочки и обращение обеспечения снаружи недостижимы — время цепи
 * тест не двигает; их закрывают контрактные и юнит-тесты.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, DEFAULT_WIF, caseName, deposit, expectCode, freshMember, gql, gqlError, signDocument, toChainDoc, tokenOf, waitFor } from '../core'
import { capitalMember, capitalWallets, chairmanApprove, ensureCapitalProgram, programInvest } from '../capital/cap-results.helpers'
import { SET_STATUS, addSbpMethod, paymentByHash } from '../payments/payments.helpers'
import type { LoanDraft, SubmittedLoan } from './debt.helpers'
import {
  CANCEL_LOAN,
  COLLATERAL,
  CREATE_LOAN,
  EXTEND_LOAN,
  GET_LOAN,
  LOANS,
  REPAY_AVAILABLE,
  REPAY_LOAN,
  RETRY_PAY,
  approveLoanByCouncil,
  awaitLoanStatus,
  dueIn,
  ensureDebtInstalled,
  extendInput,
  loanOf,
  randomHash,
  repayInput,
  signContractAsChairman,
  signedLoanDocuments,
  submitLoan,
} from './debt.helpers'

const SHARE = 3000
const INVESTED = 2000
const LOAN = 1000
const FIRST_REPAY = 400

let member: Who
let token = ''
let chairToken = ''
let methodId = ''
let draft: LoanDraft
let loan: SubmittedLoan

describe('Беспроцентные займы: заём под паевой взнос в «Благоросте»', () => {
  beforeAll(async () => {
    await ensureCapitalProgram()
    await ensureDebtInstalled()
    chairToken = await tokenOf(CHAIRMAN)
    member = await capitalMember('loan')
    token = await tokenOf(member)
    await deposit(member.account, SHARE)
    await waitFor(async () => ((await capitalWallets(token, member.account)).share >= SHARE ? true : null),
      { timeoutMs: 120_000, intervalMs: 1_000, label: 'паевой взнос деньгами в зеркале' })
    await programInvest(member, token, INVESTED)
    methodId = (await addSbpMethod(token, member.account)).method_id
    draft = { member, debt_hash: randomHash(), amount: LOAN, due_at: dueIn(180), method_id: methodId }
  })

  it(caseName('dbt.loan.backend.collateral.01', 'пайщику с договором об участии и взносом в программе доступно обеспечение «Благороста»'), async () => {
    const d = await gql<any>(token, COLLATERAL, { c: COOP })
    const blago = (d.debtCollateralOptions as any[]).find(o => o.key === 'blago')
    expect(blago).toBeTruthy()
    expect(blago.basis_signed).toBe(true)
    expect(blago.source_wallet).toBe('w.cap.blago')
    expect(blago.pledge_wallet).toBe('w.cap.pledge')
    expect(Number.parseFloat(blago.available)).toBeGreaterThanOrEqual(INVESTED)
  })

  it(caseName('dbt.loan.backend.create.02', 'ключ обеспечения вне реестра отклоняется до цепи'), async () => {
    const err = await gqlError(token, `mutation($d:DebtGenerateLoanContractInput!){ generateDebtLoanContractDocument(data:$d){ hash } }`, {
      d: { coopname: COOP, username: member.account, debt_hash: randomHash(), amount: '100.0000 RUB', due_at: dueIn(30), collateral: 'nosuch' },
    })
    expectCode(err, 'DEBT_COLLATERAL_UNKNOWN')
  })

  it(caseName('dbt.loan.backend.create.01', 'заявление с договором принято: заём на рассмотрении совета, обеспечение ушло из программы'), async () => {
    const before = await capitalWallets(token, member.account)
    loan = await submitLoan(draft)

    const mirror = await awaitLoanStatus(token, loan.debt_hash, 'CREATED')
    expect(mirror.username).toBe(member.account)
    expect(mirror.collateral).toBe('blago')
    expect(mirror.source).toBe('debt')
    expect(Number.parseFloat(mirror.amount)).toBeCloseTo(LOAN, 4)
    expect(Number.parseFloat(mirror.pledged)).toBeCloseTo(LOAN, 4)
    expect(mirror.statement?.hash).toBeTruthy()
    expect(mirror.contract?.hash).toBeTruthy()

    const after = await capitalWallets(token, member.account)
    expect(after.blago).toBeCloseTo(before.blago - LOAN, 4)
    expect(after.share).toBeCloseTo(before.share, 4)
  })

  it(caseName('dbt.loan.backend.rights.01', 'чужой заём пайщику не виден, свой список — только свои займы, совет видит реестр'), async () => {
    const stranger = freshMember({ prefix: 'lnx' })
    const strangerToken = await tokenOf(stranger)
    expectCode(await gqlError(strangerToken, GET_LOAN, { h: loan.debt_hash }), 'KIT_RIGHT_SCOPE_OWN')

    // Чужое имя в отборе пайщику не помогает: сервер подставляет вошедшего.
    const foreign = await gql<any>(strangerToken, LOANS, { f: { coopname: COOP, username: member.account }, o: { page: 1, limit: 50 } })
    expect(foreign.debtLoans.items.some((l: any) => l.debt_hash === loan.debt_hash)).toBe(false)

    const own = await gql<any>(token, LOANS, { f: { coopname: COOP }, o: { page: 1, limit: 50 } })
    expect(own.debtLoans.items.every((l: any) => l.username === member.account)).toBe(true)
    expect(own.debtLoans.items.some((l: any) => l.debt_hash === loan.debt_hash)).toBe(true)

    const registry = await gql<any>(chairToken, LOANS, { f: { coopname: COOP, username: member.account }, o: { page: 1, limit: 50 } })
    expect(registry.debtLoans.items.some((l: any) => l.debt_hash === loan.debt_hash)).toBe(true)
  })

  it(caseName('dbt.loan.backend.rights.02', 'за другого пайщика заявление не подаётся'), async () => {
    const stranger = freshMember({ prefix: 'lny' })
    const docs = await signedLoanDocuments({ ...draft, debt_hash: randomHash() })
    expectCode(await gqlError(await tokenOf(stranger), CREATE_LOAN, { d: docs.input }), 'KIT_RIGHT_SCOPE_OWN')
  })

  it(caseName('dbt.loan.backend.pay.02', 'до подписи председателя платёж кассиру не заводится'), async () => {
    await approveLoanByCouncil(draft)
    const mirror = await awaitLoanStatus(token, loan.debt_hash, 'AUTHORIZED')
    expect(mirror.decision?.hash).toBeTruthy()
    expect(await paymentByHash(chairToken, loan.debt_hash, { username: member.account })).toBeNull()
  })

  it(caseName('dbt.loan.backend.pay.01', 'председатель подписал договор — заём передан на выплату, кассиру заведён исходящий платёж'), async () => {
    await signContractAsChairman(loan)
    const mirror = await awaitLoanStatus(token, loan.debt_hash, 'PAYING')
    expect(mirror.signed_contract?.hash).toBe(mirror.contract?.hash)

    const payment = await waitFor(async () => (await paymentByHash(chairToken, loan.debt_hash, { username: member.account })) ?? null,
      { timeoutMs: 60_000, intervalMs: 1_000, label: 'платёж по займу у кассира' })
    expect(payment.type).toBe('LOAN')
    expect(payment.direction).toBe('OUTGOING')
    expect(payment.status).toBe('PENDING')
    expect(Number(payment.quantity)).toBeCloseTo(LOAN, 4)
  })

  it(caseName('dbt.loan.backend.decline.01', 'кассир отклонил платёж — заём ждёт повтора, причина сохранена, решение совета в силе'), async () => {
    const payment = await paymentByHash(chairToken, loan.debt_hash, { username: member.account })
    await gql<any>(chairToken, SET_STATUS, { d: { id: payment.id, status: 'CANCELLED', message: 'Неверный номер телефона' } })

    const mirror = await awaitLoanStatus(token, loan.debt_hash, 'SIGNED')
    expect(mirror.last_pay_error).toContain('Неверный номер телефона')
    expect(mirror.decision?.hash).toBeTruthy()
    // Обеспечение остаётся на кошельке обеспечения: заём не отменён.
    expect(Number.parseFloat(mirror.pledged)).toBeCloseTo(LOAN, 4)
  })

  it(caseName('dbt.loan.backend.pay.03', 'повтор платежа возвращает прежний платёж в ожидание, второй не заводится'), async () => {
    expectCode(await gqlError(token, RETRY_PAY, { d: { coopname: COOP, debt_hash: loan.debt_hash } }), 'KIT_INSUFFICIENT_RIGHTS')

    const declined = await paymentByHash(chairToken, loan.debt_hash, { username: member.account })
    await gql<any>(chairToken, RETRY_PAY, { d: { coopname: COOP, debt_hash: loan.debt_hash } })
    await awaitLoanStatus(token, loan.debt_hash, 'PAYING')

    const payment = await waitFor(async () => {
      const p = await paymentByHash(chairToken, loan.debt_hash, { username: member.account })
      return p?.status === 'PENDING' ? p : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'платёж по займу снова в ожидании' })
    expect(payment.id).toBe(declined.id)
  })

  it(caseName('dbt.loan.backend.issue.01', 'кассир провёл платёж — заём выдан, остаток равен сумме займа'), async () => {
    const payment = await paymentByHash(chairToken, loan.debt_hash, { username: member.account })
    await gql<any>(chairToken, SET_STATUS, { d: { id: payment.id, status: 'PAID' } })

    const mirror = await awaitLoanStatus(token, loan.debt_hash, 'ISSUED')
    expect(Number.parseFloat(mirror.remaining)).toBeCloseTo(LOAN, 4)
    expect(mirror.issued_at).toBeTruthy()
    expect((await paymentByHash(chairToken, loan.debt_hash, { username: member.account })).status).toBe('COMPLETED')

    // Выданный заём отмене не подлежит.
    const err = await gqlError(token, CANCEL_LOAN, { d: { coopname: COOP, debt_hash: loan.debt_hash } })
    expect(err).not.toBeNull()

    const outstanding = await gql<any>(token, LOANS, { f: { coopname: COOP, outstanding: true }, o: { page: 1, limit: 50 } })
    expect(outstanding.debtLoans.items.some((l: any) => l.debt_hash === loan.debt_hash)).toBe(true)
  })

  it(caseName('dbt.loan.backend.repay.01', 'частичный возврат с главного кошелька уменьшает остаток и возвращает обеспечение на ту же сумму'), async () => {
    const before = await capitalWallets(token, member.account)
    const available = await gql<any>(token, REPAY_AVAILABLE, { c: COOP })
    expect(Number.parseFloat(available.debtRepayAvailable)).toBeCloseTo(before.share, 4)

    await gql<any>(token, REPAY_LOAN, { d: await repayInput(member, loan.debt_hash, FIRST_REPAY) })

    const mirror = await waitFor(async () => {
      const l = await loanOf(token, loan.debt_hash)
      return l && Math.abs(Number.parseFloat(l.remaining) - (LOAN - FIRST_REPAY)) < 0.0001 ? l : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: 'остаток займа после частичного возврата' })
    expect(mirror.status).toBe('ISSUED')
    expect(Number.parseFloat(mirror.pledged)).toBeCloseTo(LOAN - FIRST_REPAY, 4)

    const after = await capitalWallets(token, member.account)
    expect(after.share).toBeCloseTo(before.share - FIRST_REPAY, 4)
    expect(after.blago).toBeCloseTo(before.blago + FIRST_REPAY, 4)
  })

  it(caseName('dbt.loan.backend.repay.02', 'возврат больше остатка и возврат чужого займа отклоняются'), async () => {
    const tooMuch = await gqlError(token, REPAY_LOAN, { d: await repayInput(member, loan.debt_hash, LOAN) })
    expect(tooMuch).not.toBeNull()

    const stranger = freshMember({ prefix: 'lnz' })
    const input = await repayInput(member, loan.debt_hash, 100)
    expectCode(await gqlError(await tokenOf(stranger), REPAY_LOAN, { d: input }), 'KIT_RIGHT_SCOPE_OWN')

    expect(Number.parseFloat((await loanOf(token, loan.debt_hash)).remaining)).toBeCloseTo(LOAN - FIRST_REPAY, 4)
  })

  it(caseName('dbt.loan.backend.extend.01', 'заявление о продлении ждёт председателя; после его подписи действует новый срок'), async () => {
    const newDue = dueIn(360)
    const ext = await extendInput(member, loan.debt_hash, newDue)
    await gql<any>(token, EXTEND_LOAN, { d: ext.input })

    const pending = await waitFor(async () => {
      const l = await loanOf(token, loan.debt_hash)
      return l?.requested_due_at?.startsWith(newDue.slice(0, 10)) ? l : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: 'заявление о продлении в зеркале' })
    // До решения председателя действует прежний срок.
    expect(pending.due_at.startsWith(draft.due_at.slice(0, 10))).toBe(true)

    const approved = await signDocument(DEFAULT_WIF, ext.generated, CHAIRMAN.account, 2, [ext.signed])
    await chairmanApprove(loan.debt_hash, toChainDoc(approved))

    const extended = await waitFor(async () => {
      const l = await loanOf(token, loan.debt_hash)
      return l?.due_at?.startsWith(newDue.slice(0, 10)) ? l : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: 'новый срок возврата в зеркале' })
    expect(extended.status).toBe('ISSUED')
    expect(extended.extension_statement?.hash).toBeTruthy()
  })

  it(caseName('dbt.loan.backend.status.01', 'возврат остатка закрывает заём, обеспечение целиком в программе'), async () => {
    const before = await capitalWallets(token, member.account)
    const rest = LOAN - FIRST_REPAY
    await gql<any>(token, REPAY_LOAN, { d: await repayInput(member, loan.debt_hash, rest) })

    const closed = await awaitLoanStatus(token, loan.debt_hash, 'CLOSED')
    // Зеркало хранит историю закрытого займа: документы на месте.
    expect(closed.statement?.hash).toBeTruthy()
    expect(closed.signed_contract?.hash).toBeTruthy()

    const after = await capitalWallets(token, member.account)
    expect(after.share).toBeCloseTo(before.share - rest, 4)
    expect(after.blago).toBeCloseTo(before.blago + rest, 4)

    const outstanding = await gql<any>(token, LOANS, { f: { coopname: COOP, outstanding: true }, o: { page: 1, limit: 50 } })
    expect(outstanding.debtLoans.items.some((l: any) => l.debt_hash === loan.debt_hash)).toBe(false)
  })

  it(caseName('dbt.loan.backend.cancel.01', 'пайщик отменяет заявление до решения совета — заём отклонён, обеспечение вернулось'), async () => {
    const before = await capitalWallets(token, member.account)
    const second = await submitLoan({ ...draft, debt_hash: randomHash(), amount: 300 })
    await awaitLoanStatus(token, second.debt_hash, 'CREATED')
    expect((await capitalWallets(token, member.account)).blago).toBeCloseTo(before.blago - 300, 4)

    // Посторонний пайщик чужое заявление не отменяет.
    const stranger = freshMember({ prefix: 'lnc' })
    expectCode(await gqlError(await tokenOf(stranger), CANCEL_LOAN, { d: { coopname: COOP, debt_hash: second.debt_hash } }), 'KIT_RIGHT_SCOPE_OWN')

    await gql<any>(token, CANCEL_LOAN, { d: { coopname: COOP, debt_hash: second.debt_hash, reason: 'Передумал' } })
    await awaitLoanStatus(token, second.debt_hash, 'DECLINED')
    expect((await capitalWallets(token, member.account)).blago).toBeCloseTo(before.blago, 4)
    expect(await paymentByHash(chairToken, second.debt_hash, { username: member.account })).toBeNull()
  })

  it(caseName('dbt.loan.backend.create.03', 'сумма займа больше остатка в программе отклоняется, обеспечение не тронуто'), async () => {
    const before = await capitalWallets(token, member.account)
    const docs = await signedLoanDocuments({ ...draft, debt_hash: randomHash(), amount: before.blago + 1000 })
    const err = await gqlError(token, CREATE_LOAN, { d: docs.input })
    expect(err).not.toBeNull()
    expect((await capitalWallets(token, member.account)).blago).toBeCloseTo(before.blago, 4)
  })
})

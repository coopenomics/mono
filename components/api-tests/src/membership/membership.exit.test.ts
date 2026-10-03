/**
 * Выход пайщика из кооператива: подача заявления (черновик в
 * membership_exit_requests до подтверждения по ссылке из письма), чтение
 * статуса, отмена, превью возврата паевого взноса.
 *
 * Выходит только свежий пайщик (freshMember). В первом наборе заявления
 * отменяются до подтверждения, пайщик остаётся в кооперативе. Во втором
 * пайщик подтверждает выход по ссылке из письма (почту стенда перехватывает
 * Mailpit), заявление уходит в цепь и доводится до конца решением совета.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COUNCIL, ROLES, amount, authorizeDecisionOnChain, awaitDecision, caseName, deposit, docMeta, freshMember, gql, gqlError, latestMail, login, payOutExit, signDocument, tokenOf, voteOnDecision, waitFor } from '../core'
import { addSbpMethod } from '../payments/payments.helpers'

const GENERATE_APPLICATION = `mutation($d:MembershipExitApplicationGenerateDocumentInput!){
  generateMembershipExitApplication(data:$d){ full_title html hash meta binary }
}`
const CREATE_EXIT = 'mutation($d:CreateMembershipExitInput!){ createMembershipExit(data:$d){ exit_hash status } }'
const CANCEL_EXIT = 'mutation($c:String!,$u:String!){ cancelMembershipExit(coopname:$c, username:$u) }'
const CONFIRM_EXIT = 'mutation($t:String!){ confirmMembershipExit(token:$t){ exit_hash status } }'
const EXIT_STATUS = 'query($c:String!,$u:String!){ membershipExit(coopname:$c, username:$u){ exit_hash status quantity payment_status created_at } }'
const RETURN_PREVIEW = 'query($c:String!,$u:String!){ membershipExitReturnPreview(coopname:$c, username:$u){ total share_contribution minimum_contribution } }'
const USER_WALLETS = 'query($u:String!){ getUserWallets(username:$u){ wallet_name available } }'

/** Поля мета заявления, которые принимает вход подачи (MembershipExitApplicationSignedMetaDocumentInput). */
const STATEMENT_META_KEYS = ['block_num', 'coopname', 'created_at', 'generator', 'lang', 'links', 'registry_id', 'skip_save', 'timezone', 'title', 'username', 'version']
const EXIT_REFUND_WALLETS = ['w.reg.minshr', 'w.wal.share', 'w.cap.blago']

function exitHash(): string {
  return crypto.randomBytes(32).toString('hex')
}

async function exitStatus(token: string, username: string): Promise<any | null> {
  const d = await gql<any>(token, EXIT_STATUS, { c: COOP, u: username })
  return d.membershipExit
}

async function refundWallets(token: string, username: string): Promise<Record<string, number>> {
  const d = await gql<any>(token, USER_WALLETS, { u: username })
  const out: Record<string, number> = {}
  for (const name of EXIT_REFUND_WALLETS)
    out[name] = amount((d.getUserWallets as any[]).find(w => w.wallet_name === name)?.available)
  return out
}

describe('выход пайщика из кооператива', () => {
  let leaver: Who
  let leaverToken: string
  let otherToken: string
  let chairToken: string
  let statement: any

  beforeAll(async () => {
    leaver = freshMember({ prefix: 'exit' })
    leaverToken = await login(leaver)
    otherToken = await tokenOf(ROLES.otherMember())
    chairToken = await tokenOf(CHAIRMAN)

    const g = await gql<any>(leaverToken, GENERATE_APPLICATION, { d: { coopname: COOP, username: leaver.account, skip_save: false } })
    const signed = await signDocument(leaver.wif, g.generateMembershipExitApplication, leaver.account, 1)
    const meta = docMeta(signed.meta)
    statement = { ...signed, meta: Object.fromEntries(STATEMENT_META_KEYS.filter(k => k in meta).map(k => [k, meta[k]])) }
  })

  const create = (token: string | null, username: string, hash = exitHash()) =>
    gqlError(token, CREATE_EXIT, { d: { coopname: COOP, username, exit_hash: hash, statement } })

  it(caseName('mem.exit.side.01', 'без реквизитов для возврата заявление на выход не принимается'), async () => {
    const err = await create(leaverToken, leaver.account)
    expect(err?.code).toBe('MEMBERSHIP_EXIT_PAYMENT_METHOD_REQUIRED')
    expect(await exitStatus(leaverToken, leaver.account)).toBeNull()
  })

  const firstHash = exitHash()

  it(caseName('mem.exit.happy.01', 'пайщик подаёт заявление на выход — оно ждёт подтверждения по письму'), async () => {
    await addSbpMethod(leaverToken, leaver.account)
    const d = await gql<any>(leaverToken, CREATE_EXIT, { d: { coopname: COOP, username: leaver.account, exit_hash: firstHash, statement } })
    expect(d.createMembershipExit).toEqual({ exit_hash: firstHash, status: 'AWAITING_CONFIRMATION' })

    const seen = await exitStatus(leaverToken, leaver.account)
    expect(seen.exit_hash).toBe(firstHash)
    expect(seen.status).toBe('AWAITING_CONFIRMATION')
    expect(seen.payment_status).toBeNull()
    expect(seen.created_at).toBeTruthy()
    // Совет видит заявление пайщика.
    expect((await exitStatus(await tokenOf(COUNCIL), leaver.account))?.exit_hash).toBe(firstHash)
  })

  it(caseName('mem.exit.side.02', 'второе заявление при ожидающем подтверждения отклоняется'), async () => {
    const err = await create(leaverToken, leaver.account)
    expect(err?.code).toBe('MEMBERSHIP_EXIT_PENDING_CONFIRMATION')
    expect((await exitStatus(leaverToken, leaver.account))?.exit_hash).toBe(firstHash)
  })

  it(caseName('mem.exit.side.03', 'чужой пайщик не подаёт, не читает и не отменяет выход пайщика; гость не подаёт'), async () => {
    expect((await create(otherToken, leaver.account))?.code).toBe('MEMBERSHIP_EXIT_SELF_ONLY')
    expect((await gqlError(otherToken, EXIT_STATUS, { c: COOP, u: leaver.account }))?.code).toBe('MEMBERSHIP_EXIT_STATUS_SELF_ONLY')
    expect((await gqlError(otherToken, CANCEL_EXIT, { c: COOP, u: leaver.account }))?.code).toBe('MEMBERSHIP_EXIT_CANCEL_SELF_ONLY')
    expect(String((await create(null, leaver.account))?.code)).toBe('401')
    expect((await exitStatus(leaverToken, leaver.account))?.exit_hash).toBe(firstHash)
  })

  it(caseName('mem.exit.side.04', 'подтверждение выхода негодной ссылкой отклоняется'), async () => {
    const err = await gqlError(null, CONFIRM_EXIT, { t: `bogus.${crypto.randomBytes(8).toString('hex')}.token` })
    expect(String(err?.code)).toBe('401')
    expect((await exitStatus(leaverToken, leaver.account))?.status).toBe('AWAITING_CONFIRMATION')
  })

  it(caseName('mem.exit.happy.02', 'пайщик отменяет заявление до подтверждения — выхода нет'), async () => {
    const d = await gql<any>(leaverToken, CANCEL_EXIT, { c: COOP, u: leaver.account })
    expect(d.cancelMembershipExit).toBe(true)
    expect(await exitStatus(leaverToken, leaver.account)).toBeNull()
  })

  it(caseName('mem.exit.side.05', 'повторная отмена без заявления — нечего отменять'), async () => {
    const err = await gqlError(leaverToken, CANCEL_EXIT, { c: COOP, u: leaver.account })
    expect(err?.code).toBe('MEMBERSHIP_EXIT_NO_PENDING_REQUEST')
  })

  it(caseName('mem.exit.happy.03', 'председатель подаёт заявление за пайщика и отменяет его'), async () => {
    const hash = exitHash()
    const d = await gql<any>(chairToken, CREATE_EXIT, { d: { coopname: COOP, username: leaver.account, exit_hash: hash, statement } })
    expect(d.createMembershipExit).toEqual({ exit_hash: hash, status: 'AWAITING_CONFIRMATION' })
    expect((await exitStatus(leaverToken, leaver.account))?.exit_hash).toBe(hash)

    const c = await gql<any>(chairToken, CANCEL_EXIT, { c: COOP, u: leaver.account })
    expect(c.cancelMembershipExit).toBe(true)
    expect(await exitStatus(leaverToken, leaver.account)).toBeNull()
  })

  // ── Превью возврата ──────────────────────────────────────────────────────

  it(caseName('mem.exit.happy.04', 'превью возврата — сумма паевых кошельков пайщика и растёт с пополнением'), async () => {
    const preview = async () => (await gql<any>(leaverToken, RETURN_PREVIEW, { c: COOP, u: leaver.account })).membershipExitReturnPreview
    const before = await refundWallets(leaverToken, leaver.account)
    const p1 = await preview()
    expect(amount(p1.total)).toBeCloseTo(before['w.reg.minshr'] + before['w.wal.share'] + before['w.cap.blago'], 4)
    expect(amount(p1.share_contribution)).toBeCloseTo(before['w.wal.share'], 4)
    expect(amount(p1.minimum_contribution)).toBeCloseTo(before['w.reg.minshr'], 4)
    expect(p1.total).toMatch(/^\d+\.\d+ [A-Z]+$/)

    await deposit(leaver.account, 250)
    await waitFor(async () => {
      const w = await refundWallets(leaverToken, leaver.account)
      return w['w.wal.share'] >= before['w.wal.share'] + 250 ? w : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: `зеркало кошелька ${leaver.account} после пополнения` })
    const p2 = await preview()
    expect(amount(p2.share_contribution)).toBeCloseTo(amount(p1.share_contribution) + 250, 4)
    expect(amount(p2.total)).toBeCloseTo(amount(p1.total) + 250, 4)
  })

  it(caseName('mem.exit.side.06', 'чужой пайщик не видит превью возврата пайщика, совет видит'), async () => {
    const err = await gqlError(otherToken, RETURN_PREVIEW, { c: COOP, u: leaver.account })
    expect(err?.code).toBe('MEMBERSHIP_EXIT_CALCULATION_SELF_ONLY')
    const d = await gql<any>(await tokenOf(COUNCIL), RETURN_PREVIEW, { c: COOP, u: leaver.account })
    const own = await gql<any>(leaverToken, RETURN_PREVIEW, { c: COOP, u: leaver.account })
    expect(d.membershipExitReturnPreview).toEqual(own.membershipExitReturnPreview)
  })
})

describe('выход пайщика: подтверждение по письму и повторные заявления', () => {
  let leaver: Who
  let leaverToken = ''
  let statement: any
  let hash = ''

  const create = (exit_hash: string) =>
    gqlError(leaverToken, CREATE_EXIT, { d: { coopname: COOP, username: leaver.account, exit_hash, statement } })

  beforeAll(async () => {
    leaver = freshMember({ prefix: 'exitc' })
    leaverToken = await login(leaver)
    await addSbpMethod(leaverToken, leaver.account)
    const g = await gql<any>(leaverToken, GENERATE_APPLICATION, { d: { coopname: COOP, username: leaver.account, skip_save: false } })
    const signed = await signDocument(leaver.wif, g.generateMembershipExitApplication, leaver.account, 1)
    const meta = docMeta(signed.meta)
    statement = { ...signed, meta: Object.fromEntries(STATEMENT_META_KEYS.filter(k => k in meta).map(k => [k, meta[k]])) }
  }, 300_000)

  it(caseName('mem.exit.happy.05', 'пайщик подтверждает выход по ссылке из письма — заявление уходит в цепь, ссылка второй раз не работает'), async () => {
    hash = exitHash()
    const d = await gql<any>(leaverToken, CREATE_EXIT, { d: { coopname: COOP, username: leaver.account, exit_hash: hash, statement } })
    expect(d.createMembershipExit.status).toBe('AWAITING_CONFIRMATION')

    const mail = await latestMail(leaver.email, 'membership-exit/confirm?token=', 120_000)
    const token = /membership-exit\/confirm\?token=([\w.-]+)/.exec(`${mail.text}\n${mail.html}`)?.[1]
    expect(token, 'в письме есть ссылка подтверждения').toBeTruthy()

    const confirmed = await gql<any>(null, CONFIRM_EXIT, { t: token })
    expect(confirmed.confirmMembershipExit).toEqual({ exit_hash: hash, status: 'PENDING' })

    const seen = await waitFor(async () => {
      const row = await exitStatus(leaverToken, leaver.account)
      return row?.status === 'PENDING' ? row : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'выход пайщика в цепи' })
    expect(seen.exit_hash).toBe(hash)

    expect(await gqlError(null, CONFIRM_EXIT, { t: token }), 'использованная ссылка отклонена').not.toBeNull()
  })

  it(caseName('mem.exit.side.08', 'новое заявление, когда выход уже в цепи, отклоняется'), async () => {
    expect((await create(exitHash()))?.code).toBe('MEMBERSHIP_EXIT_ALREADY_SUBMITTED')
    expect((await exitStatus(leaverToken, leaver.account))?.exit_hash).toBe(hash)
  })

  it(caseName('mem.exit.side.07', 'вышедший пайщик заявление снова не подаёт'), async () => {
    const decision = await awaitDecision(hash, `решение совета о выходе ${leaver.account}`)
    await voteOnDecision(Number(decision.id), 'for')
    await authorizeDecisionOnChain(Number(decision.id))
    await payOutExit(leaver, hash)

    const err = await waitFor(async () => {
      const e = await create(exitHash())
      return e?.code === 'MEMBERSHIP_EXIT_ALREADY_EXITED' ? e : null
    }, { timeoutMs: 60_000, intervalMs: 2_000, label: 'узел видит пайщика вышедшим' })
    expect(err.code).toBe('MEMBERSHIP_EXIT_ALREADY_EXITED')
  }, 300_000)

  it(caseName('mem.exit.side.09', 'вышедший пайщик теряет права пайщика, вход и своё остаются'), async () => {
    const MEETS = 'query($d:GetMeetsInput!){ getMeets(data:$d){ hash } }'
    // Статус снимает слушатель события цепи — после разбора блока с выходом.
    const denied = await waitFor(async () => {
      const e = await gqlError(leaverToken, MEETS, { d: { coopname: COOP } })
      return e?.code === 'KIT_MEMBERS_ONLY' ? e : null
    }, { timeoutMs: 60_000, intervalMs: 2_000, label: 'учётная запись вышедшего потеряла статус «принят»' })
    expect(denied.code).toBe('KIT_MEMBERS_ONLY')
    expect(await gqlError(await tokenOf(ROLES.member()), MEETS, { d: { coopname: COOP } }), 'действующий пайщик собрания читает').toBeNull()

    // Своё вышедший читает как прежде: ход возврата взноса и свои кошельки.
    // У выхода с нулевым возвратом хода нет — важно, что запрос отвечает без отказа.
    expect(await gqlError(leaverToken, EXIT_STATUS, { c: COOP, u: leaver.account }), 'ход своего выхода читается без отказа').toBeNull()
    expect(await gqlError(leaverToken, USER_WALLETS, { u: leaver.account }), 'свои кошельки видны').toBeNull()
  }, 180_000)
})

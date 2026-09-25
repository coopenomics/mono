/**
 * Кошельки и соглашения пайщика: соглашения кооператива (agreements —
 * зеркало soviet::agreements3), программные соглашения (user_agreements —
 * зеркало wallet::users), кошельки (user_wallets — зеркало ledger2::userwallets)
 * и журнал операций старого плана счетов (ledger_operations). Всё читается
 * через API; пишется мутациями контроллера либо, где API записи нет, действием
 * в цепь с последующим чтением зеркала.
 *
 * Подписывают соглашения только свежие пайщики (freshMember): подпись
 * необратима и видна всем следующим файлам прогона.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COOP_SIGNER, DEFAULT_WIF, ROLES, amount, caseName, deposit, freshMember, gql, gqlError, login, rub, signDocument, tokenOf, transact, waitFor } from '../core'
import {
  AGREEMENTS,
  CONFIRM_AGREEMENT,
  DECLINE_AGREEMENT,
  SEND_AGREEMENT,
  agreementsOf,
  generateAgreement,
  sendInput,
  signAndSend,
} from './wallet.agreements.helpers'

const USER_WALLETS = 'query($u:String!,$c:String){ getUserWallets(username:$u, coopname:$c){ id wallet_name available blocked program_id username } }'
const PROGRAM_WALLETS = 'query($f:ProgramWalletFilterInput,$o:PaginationInput){ getProgramWallets(filter:$f, options:$o){ items{ username program_id available } } }'
const LEDGER_HISTORY = 'query($d:GetLedgerHistoryInput!){ getLedgerHistory(data:$d){ totalCount items{ global_sequence action account_id quantity comment hash username } } }'

async function shareAvailable(token: string, username: string): Promise<number> {
  const d = await gql<any>(token, USER_WALLETS, { u: username, c: COOP })
  return amount((d.getUserWallets as any[]).find(w => w.wallet_name === 'w.wal.share')?.available)
}

describe('кошельки и соглашения пайщика', () => {
  let signer: Who
  let signerToken: string
  let intruder: Who
  let intruderToken: string
  let otherToken: string
  let chairToken: string

  beforeAll(async () => {
    signer = freshMember({ prefix: 'agr' })
    intruder = freshMember({ prefix: 'agrx' })
    signerToken = await login(signer)
    intruderToken = await login(intruder)
    otherToken = await tokenOf(ROLES.otherMember())
    chairToken = await tokenOf(CHAIRMAN)
  })

  // ── Программные соглашения и кошельки ────────────────────────────────────

  it(caseName('wal.agr.happy.01', 'пайщик видит своё подписанное соглашение программы «Кошелёк»'), async () => {
    const mine = await agreementsOf(signerToken, { username: signer.account })
    const wallet = mine.find(a => a.type === 'wallet')
    expect(wallet).toBeTruthy()
    expect(wallet.status).toBe('CONFIRMED')
    expect(wallet.username).toBe(signer.account)
    expect(wallet.program_id).toBeGreaterThan(0)
  })

  it(caseName('wal.agr.happy.02', 'пополнение паевого кошелька видно в кошельках пайщика и в программном кошельке'), async () => {
    const before = await shareAvailable(signerToken, signer.account)
    await deposit(signer.account, 777)
    const after = await waitFor(async () => {
      const v = await shareAvailable(signerToken, signer.account)
      return v >= before + 777 ? v : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: `зеркало кошелька ${signer.account} после пополнения` })
    expect(after).toBeCloseTo(before + 777, 4)

    const d = await gql<any>(signerToken, USER_WALLETS, { u: signer.account, c: COOP })
    const share = (d.getUserWallets as any[]).find(w => w.wallet_name === 'w.wal.share')
    expect(share.username).toBe(signer.account)
    expect(share.program_id).toBe('1')

    const pw = await gql<any>(signerToken, PROGRAM_WALLETS, { f: { username: signer.account, program_id: '1' }, o: { page: 1, limit: 10, sortOrder: 'ASC' } })
    const main = (pw.getProgramWallets.items as any[]).find(w => w.username === signer.account)
    expect(amount(main?.available)).toBeCloseTo(after, 4)
  })

  it(caseName('wal.agr.side.01', 'чужой пайщик и гость не видят кошельки пайщика'), async () => {
    expect((await gqlError(otherToken, USER_WALLETS, { u: signer.account }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await gqlError(otherToken, PROGRAM_WALLETS, { f: { username: signer.account } }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect(String((await gqlError(null, USER_WALLETS, { u: signer.account }))?.code)).toBe('401')
  })

  // ── Соглашения кооператива: подача, принятие, отказ ──────────────────────

  let signatureId: number

  it(caseName('wal.agr.happy.03', 'пайщик подаёт соглашение о простой подписи, председатель принимает'), async () => {
    const doc = await generateAgreement(signerToken, signer, 'signature')
    await signAndSend(signerToken, { username: signer.account, type: 'signature', doc, wif: signer.wif })

    const sent = (await agreementsOf(signerToken, { username: signer.account, type: 'signature', program_id: 0 }))
    expect(sent).toHaveLength(1)
    expect(sent[0].status).toBe('REGISTERED')
    expect(sent[0].document?.hash).toBeTruthy()
    signatureId = sent[0].id

    await gql(chairToken, CONFIRM_AGREEMENT, { d: { coopname: COOP, administrator: COOP, username: signer.account, agreement_id: String(signatureId) } })
    const confirmed = await agreementsOf(signerToken, { username: signer.account, type: 'signature', program_id: 0 })
    expect(confirmed.map(a => [a.id, a.status])).toEqual([[signatureId, 'CONFIRMED']])
  })

  it(caseName('wal.agr.side.02', 'принятое соглашение повторно не подаётся'), async () => {
    const doc = await generateAgreement(signerToken, signer, 'privacy')
    // Документ другого типа подаётся как «signature»: проверяется отказ по статусу, а не по шаблону.
    const signed = await signDocument(signer.wif, doc, signer.account, 1)
    const err = await gqlError(signerToken, SEND_AGREEMENT, sendInput(signer.account, 'signature', signed))
    expect(err).not.toBeNull()
    const still = await agreementsOf(signerToken, { username: signer.account, type: 'signature', program_id: 0 })
    expect(still.map(a => [a.id, a.status])).toEqual([[signatureId, 'CONFIRMED']])

    // Тот же документ — законная подача политики конфиденциальности (для отказа ниже).
    await gql(signerToken, SEND_AGREEMENT, sendInput(signer.account, 'privacy', signed))
  })

  it(caseName('wal.agr.side.03', 'пайщик не принимает и не отклоняет соглашения — ни своё, ни чужое'), async () => {
    const privacy = (await agreementsOf(signerToken, { username: signer.account, type: 'privacy', program_id: 0 }))[0]
    expect(privacy?.status).toBe('REGISTERED')
    const input = { d: { coopname: COOP, administrator: COOP, username: signer.account, agreement_id: String(privacy.id) } }
    expect((await gqlError(signerToken, CONFIRM_AGREEMENT, input))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await gqlError(otherToken, DECLINE_AGREEMENT, { d: { ...input.d, comment: 'нет' } }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await agreementsOf(signerToken, { username: signer.account, type: 'privacy', program_id: 0 }))[0].status).toBe('REGISTERED')
  })

  it(caseName('wal.agr.happy.04', 'председатель отклоняет поданное соглашение с комментарием'), async () => {
    const privacy = (await agreementsOf(signerToken, { username: signer.account, type: 'privacy', program_id: 0 }))[0]
    await gql(chairToken, DECLINE_AGREEMENT, {
      d: { coopname: COOP, administrator: COOP, username: signer.account, agreement_id: String(privacy.id), comment: 'api-tests: отказ' },
    })
    const declined = await agreementsOf(chairToken, { username: signer.account, program_id: 0, statuses: ['DECLINED'] })
    expect(declined.map(a => [a.id, a.type, a.status])).toEqual([[privacy.id, 'privacy', 'DECLINED']])
  })

  it(caseName('wal.agr.side.11', 'фильтр по статусу или типу без program_id не подмешивает соглашение программы'), async () => {
    // До 25.09.2026 программное соглашение «Кошелёк» (подтверждённое) попадало
    // в любую выдачу без program_id — и в «отклонённые», и в «тип privacy».
    const declined = await agreementsOf(chairToken, { username: signer.account, statuses: ['DECLINED'] })
    expect(declined.every(a => a.status === 'DECLINED')).toBe(true)
    expect(declined.some(a => a.type === 'wallet')).toBe(false)
    const privacy = await agreementsOf(chairToken, { username: signer.account, type: 'privacy' })
    expect(privacy.length).toBeGreaterThan(0)
    expect(privacy.every(a => a.type === 'privacy')).toBe(true)
  })

  it(caseName('wal.agr.happy.05', 'пайщик переподписывает программное соглашение «Кошелёк» — дата подписи обновляется'), async () => {
    const before = (await agreementsOf(signerToken, { username: signer.account })).find(a => a.type === 'wallet')
    const doc = await generateAgreement(signerToken, signer, 'wallet')
    await signAndSend(signerToken, { username: signer.account, type: 'wallet', doc, wif: signer.wif })
    const after = (await agreementsOf(signerToken, { username: signer.account })).find(a => a.type === 'wallet')
    expect(after.status).toBe('CONFIRMED')
    expect(after.program_id).toBe(before.program_id)
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(before.updated_at).getTime())
    // Соглашение одно — переподпись не плодит второе.
    expect((await agreementsOf(signerToken, { username: signer.account })).filter(a => a.type === 'wallet')).toHaveLength(1)
  })

  // ── Подача с нарушениями ─────────────────────────────────────────────────

  let intruderDoc: any

  it(caseName('wal.agr.side.04', 'пайщик не подаёт соглашение за другого пайщика'), async () => {
    intruderDoc = await generateAgreement(intruderToken, intruder, 'signature')
    const other = ROLES.otherMember()
    const signed = await signDocument(intruder.wif, intruderDoc, other.account, 1)
    const err = await gqlError(intruderToken, SEND_AGREEMENT, sendInput(other.account, 'signature', signed))
    expect(err?.code).toBe('AGREEMENT_ONLY_FOR_SELF')
  })

  it(caseName('wal.agr.side.05', 'соглашение без подписи самого пайщика отклоняется'), async () => {
    const signed = await signDocument(intruder.wif, intruderDoc, ROLES.otherMember().account, 1)
    const err = await gqlError(intruderToken, SEND_AGREEMENT, sendInput(intruder.account, 'signature', signed))
    expect(err?.code).toBe('AGREEMENT_MISSING_SIGNATURE')
  })

  it(caseName('wal.agr.side.06', 'подпись от имени пайщика чужим ключом отклоняется'), async () => {
    const signed = await signDocument(DEFAULT_WIF, intruderDoc, intruder.account, 1)
    const err = await gqlError(intruderToken, SEND_AGREEMENT, sendInput(intruder.account, 'signature', signed))
    expect(err?.code).toBe('AGREEMENT_SIGNATURE_KEY_MISMATCH')
    expect(await agreementsOf(intruderToken, { username: intruder.account, type: 'signature', program_id: 0 })).toEqual([])
  })

  it(caseName('wal.agr.side.07', 'соглашение типа, которого нет в кооперативе, отклоняется'), async () => {
    const signed = await signDocument(intruder.wif, intruderDoc, intruder.account, 1)
    const err = await gqlError(intruderToken, SEND_AGREEMENT, sendInput(intruder.account, 'nosuchtype', signed))
    expect(err?.code).toBe('AGREEMENT_TYPE_NOT_CONFIGURED')
  })

  it(caseName('wal.agr.side.08', 'гость не подаёт соглашение, чужой пайщик не читает соглашения пайщика'), async () => {
    const signed = await signDocument(intruder.wif, intruderDoc, intruder.account, 1)
    expect(String((await gqlError(null, SEND_AGREEMENT, sendInput(intruder.account, 'signature', signed)))?.code)).toBe('401')
    expect((await gqlError(otherToken, AGREEMENTS, { f: { coopname: COOP, username: signer.account } }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
  })

  // ── Журнал операций старого плана счетов ─────────────────────────────────

  it(caseName('wal.agr.happy.06', 'операции старого плана счетов попадают в журнал совета'), async () => {
    // Записи в журнал через API нет: его пишет разбор действий ledger::add/sub.
    // Проводка и сторно на ту же сумму — остаток счёта не меняется. Свои строки
    // ищем по комментарию, хэш и пайщика сверяем отдельно (wal.agr.side.12).
    const comment = `api-tests: журнал ${crypto.randomBytes(6).toString('hex')}`
    const data = { coopname: COOP, account_id: 91, quantity: rub(1.5), comment, hash: crypto.randomBytes(32).toString('hex'), username: signer.account }
    await transact(COOP_SIGNER, [
      { account: 'ledger', name: 'add', data },
      { account: 'ledger', name: 'sub', data },
    ])
    const ops = await waitFor(async () => {
      const d = await gql<any>(chairToken, LEDGER_HISTORY, { d: { coopname: COOP, account_id: 91, limit: 100 } })
      const mine = (d.getLedgerHistory.items as any[]).filter(o => o.comment === comment)
      return mine.length >= 2 ? mine : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'операции ledger::add/sub в журнале' })
    expect(ops.map(o => o.action).sort()).toEqual(['add', 'sub'])
    expect(ops.every(o => Number(o.account_id) === 91 && amount(o.quantity) === 1.5)).toBe(true)
    expect(new Set(ops.map(o => String(o.global_sequence))).size).toBe(2)
    // wal.agr.side.12: хэш пакета и пайщик в журнале есть (до 25.09.2026 — null).
    expect(ops.every(o => o.hash?.toLowerCase() === data.hash && o.username === signer.account)).toBe(true)
  })

  it(caseName('wal.agr.side.09', 'пайщик не читает журнал операций кооператива'), async () => {
    const err = await gqlError(signerToken, LEDGER_HISTORY, { d: { coopname: COOP } })
    expect(err?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
  })
})

/**
 * Платежи ядра (gateway): паевой платёж пайщика, смена статуса советом, чеки
 * об оплате и реквизиты. Таблицы payments и payment_files читаются и пишутся
 * только через API — тест переживёт перевод их репозиториев на Kysely.
 *
 * Пайщик-плательщик свой (freshMember): его платёж проводится в цепь и
 * меняет кошелёк.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COUNCIL, ROLES, amount, caseName, freshMember, gql, gqlError, login, tokenOf } from '../core'
import {
  ADD_METHOD,
  CREATE_DEPOSIT,
  DELETE_METHOD,
  GET_METHODS,
  GET_PAYMENTS,
  PAYMENT_FILE,
  PAYMENT_PROOFS,
  SET_STATUS,
  UPDATE_BANK,
  UPLOAD_PROOF,
  addSbpMethod,
  bankAccount,
  createDeposit,
  listPayments,
  memberNamedAfter,
  methodsOf,
  paymentByHash,
  proofContent,
  randomPhone,
} from './payments.helpers'

const USER_WALLETS = 'query($u:String!){ getUserWallets(username:$u){ wallet_name available } }'

async function walletsTotal(token: string, username: string): Promise<number> {
  const d = await gql<any>(token, USER_WALLETS, { u: username })
  return (d.getUserWallets as any[]).reduce((s, w) => s + amount(w.available), 0)
}

describe('платежи ядра: паевой платёж, статус, чеки, реквизиты', () => {
  let payer: Who
  let payerToken: string
  let otherToken: string
  let chairToken: string
  let deposit: any

  beforeAll(async () => {
    payer = freshMember({ prefix: 'pay' })
    payerToken = await login(payer)
    otherToken = await tokenOf(ROLES.otherMember())
    chairToken = await tokenOf(CHAIRMAN)
  })

  // ── Создание и чтение ────────────────────────────────────────────────────

  it(caseName('pay.core.happy.01', 'пайщик создаёт свой паевой платёж и видит его в списке'), async () => {
    deposit = await createDeposit(payerToken, payer.account, 1000)
    expect(deposit.username).toBe(payer.account)
    expect(deposit.status).toBe('PENDING')
    expect(deposit.type).toBe('DEPOSIT')
    expect(deposit.direction).toBe('INCOMING')
    expect(deposit.quantity).toBe(1000)
    expect(deposit.can_change_status).toBe(true)
    expect(deposit.is_final).toBe(false)
    expect(deposit.hash).toBeTruthy()
    expect(deposit.payment_details?.amount_without_fee).toBeTruthy()

    const own = await listPayments(payerToken, { username: payer.account, hash: deposit.hash })
    expect(own.map(p => p.id)).toEqual([deposit.id])
  })

  it(caseName('pay.core.side.01', 'повтор паевого платежа той же суммы возвращает ожидающий, второй не заводится'), async () => {
    const again = await createDeposit(payerToken, payer.account, 1000)
    expect(again.id).toBe(deposit.id)
    expect(again.hash).toBe(deposit.hash)
  })

  it(caseName('pay.core.side.02', 'гость не создаёт паевой платёж'), async () => {
    const err = await gqlError(null, CREATE_DEPOSIT, { d: { username: payer.account, quantity: 500, symbol: 'RUB' } })
    expect(String(err?.code)).toBe('401')
  })

  it(caseName('pay.core.side.03', 'пайщик не создаёт платёж за другого пайщика'), async () => {
    const err = await gqlError(otherToken, CREATE_DEPOSIT, { d: { username: payer.account, quantity: 500, symbol: 'RUB' } })
    expect(err?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    const own = await listPayments(payerToken, { username: payer.account })
    expect(own.some(p => p.quantity === 500)).toBe(false)
  })

  it(caseName('pay.core.side.16', 'паевой платёж нулевой или отрицательной суммы — отказ, платёж не заводится'), async () => {
    // До 25.09.2026 принимались 0 и −100 RUB.
    for (const quantity of [0, -100]) {
      const err = await gqlError(payerToken, CREATE_DEPOSIT, { d: { username: payer.account, quantity, symbol: 'RUB' } })
      expect(err?.code).toBe('GATEWAY_DEPOSIT_AMOUNT_NOT_POSITIVE')
    }
    const own = await listPayments(payerToken, { username: payer.account })
    expect(own.some(p => p.quantity <= 0)).toBe(false)
  })

  it(caseName('pay.core.side.04', 'платёж в чужой валюте отклоняется'), async () => {
    const err = await gqlError(payerToken, CREATE_DEPOSIT, { d: { username: payer.account, quantity: 700, symbol: 'XYZ' } })
    expect(err?.code).toBe('KIT_SYMBOL_UNSUPPORTED')
  })

  // ── Чужие платежи ────────────────────────────────────────────────────────

  it(caseName('pay.core.side.05', 'чужой пайщик и гость не видят платежи пайщика'), async () => {
    expect((await gqlError(otherToken, GET_PAYMENTS, { d: { username: payer.account } }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await gqlError(otherToken, GET_PAYMENTS, { d: { hash: deposit.hash } }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect(String((await gqlError(null, GET_PAYMENTS, { d: { username: payer.account } }))?.code)).toBe('401')
    // Совет видит платёж пайщика.
    expect((await paymentByHash(await tokenOf(COUNCIL), deposit.hash))?.id).toBe(deposit.id)
  })

  it(caseName('pay.core.side.06', 'платежи пайщика выбираются по точному имени: платёж ekaterinaXYZ не попадает к ekaterina'), async () => {
    const member = ROLES.member()
    const lookalike = memberNamedAfter(member.account)
    const lookalikePayment = await createDeposit(await login(lookalike), lookalike.account, 321)
    const memberToken = await tokenOf(member)

    // Свой список пайщика: ни одного чужого имени, платежа двойника нет.
    const own = await listPayments(memberToken, { username: member.account })
    expect(own.every(p => p.username === member.account)).toBe(true)
    expect(await paymentByHash(memberToken, lookalikePayment.hash, { username: member.account })).toBeNull()
    // Совет по имени пайщика тоже получает только его платежи.
    const byChair = await listPayments(chairToken, { username: member.account, hash: lookalikePayment.hash })
    expect(byChair).toEqual([])
  })

  // ── Статус ───────────────────────────────────────────────────────────────

  it(caseName('pay.core.side.07', 'пайщик не отмечает свой платёж оплаченным'), async () => {
    const err = await gqlError(payerToken, SET_STATUS, { d: { id: deposit.id, status: 'PAID' } })
    expect(err?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await paymentByHash(payerToken, deposit.hash, { username: payer.account }))?.status).toBe('PENDING')
  })

  it(caseName('pay.core.happy.02', 'председатель отмечает паевой платёж оплаченным — платёж завершён, кошелёк пополнен'), async () => {
    const before = await walletsTotal(payerToken, payer.account)
    const d = await gql<any>(chairToken, SET_STATUS, { d: { id: deposit.id, status: 'PAID' } })
    expect(d.setPaymentStatus.id).toBe(deposit.id)

    const after = await paymentByHash(payerToken, deposit.hash, { username: payer.account })
    expect(after.status).toBe('COMPLETED')
    expect(after.can_change_status).toBe(false)
    expect(after.is_final).toBe(true)
    expect(await walletsTotal(payerToken, payer.account)).toBeCloseTo(before + 1000, 4)
  })

  it(caseName('pay.core.side.08', 'завершённый платёж повторно не меняет статус'), async () => {
    const err = await gqlError(chairToken, SET_STATUS, { d: { id: deposit.id, status: 'CANCELLED' } })
    // pay.core.side.17: причина своя, не «платёж не найден» (до 25.09.2026).
    expect(err?.code).toBe('GATEWAY_PAYMENT_STATUS_CHANGE_FORBIDDEN')
    expect((await paymentByHash(payerToken, deposit.hash, { username: payer.account }))?.status).toBe('COMPLETED')
  })

  it(caseName('pay.core.side.09', 'смена статуса несуществующего платежа — не найден'), async () => {
    const err = await gqlError(chairToken, SET_STATUS, { d: { id: crypto.randomUUID(), status: 'PAID' } })
    expect(err?.code).toBe('GATEWAY_PAYMENT_NOT_FOUND')
  })

  it(caseName('pay.core.happy.03', 'член совета отменяет ожидающий платёж с причиной — пайщик видит статус и причину'), async () => {
    const pending = await createDeposit(payerToken, payer.account, 1234)
    const reason = `отмена api-tests ${crypto.randomBytes(4).toString('hex')}`
    await gql(await tokenOf(COUNCIL), SET_STATUS, { d: { id: pending.id, status: 'CANCELLED', message: reason } })
    const seen = await paymentByHash(payerToken, pending.hash, { username: payer.account })
    expect(seen.status).toBe('CANCELLED')
    expect(seen.message).toBe(reason)
    expect(seen.can_change_status).toBe(false)
  })

  // ── Чеки об оплате ───────────────────────────────────────────────────────

  let proofId: number
  let proofChecksum: string

  it(caseName('pay.core.happy.04', 'председатель прикладывает чек к платежу — пайщик видит чек и ссылку, платёж помечен'), async () => {
    const c = proofContent()
    proofChecksum = c.checksum_sha256
    const d = await gql<any>(chairToken, UPLOAD_PROOF, {
      d: { coopname: COOP, payment_hash: deposit.hash, mime_type: 'image/png', original_filename: 'chek.png', ...c },
    })
    const file = d.uploadPaymentProof
    expect(file.kind).toBe('PAYMENT_PROOF')
    expect(file.payment_hash).toBe(deposit.hash.toLowerCase())
    expect(file.checksum_sha256).toBe(c.checksum_sha256)
    expect(file.size_bytes).toBe(c.size_bytes)
    expect(file.uploaded_by_username).toBe(CHAIRMAN.account)
    expect(file.read_url).toBeTruthy()
    proofId = file.id

    const list = await gql<any>(payerToken, PAYMENT_PROOFS, { c: COOP, h: deposit.hash })
    expect(list.paymentProofs.map((f: any) => f.id)).toContain(proofId)
    const one = await gql<any>(payerToken, PAYMENT_FILE, { id: proofId })
    expect(one.paymentFile.read_url).toBeTruthy()
    expect(one.paymentFile.original_filename).toBe('chek.png')

    const payment = await paymentByHash(payerToken, deposit.hash, { username: payer.account })
    expect(payment.blockchain_data?.proof_count).toBe(1)
  })

  it(caseName('pay.core.side.10', 'пайщик не прикладывает чек к своему платежу'), async () => {
    const err = await gqlError(payerToken, UPLOAD_PROOF, {
      d: { coopname: COOP, payment_hash: deposit.hash, mime_type: 'image/png', ...proofContent() },
    })
    expect(err?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
  })

  it(caseName('pay.core.side.11', 'чужой пайщик не видит чек чужого платежа'), async () => {
    expect((await gqlError(otherToken, PAYMENT_PROOFS, { c: COOP, h: deposit.hash }))?.code).toBe('GATEWAY_PAYMENT_FILE_ACCESS_FORBIDDEN')
    expect((await gqlError(otherToken, PAYMENT_FILE, { id: proofId }))?.code).toBe('GATEWAY_PAYMENT_FILE_ACCESS_FORBIDDEN')
  })

  it(caseName('pay.core.side.12', 'тот же чек второй раз не прикладывается'), async () => {
    // Содержимое прежнего чека восстановить нельзя — кладём новый и повторяем его.
    const c = proofContent()
    await gql(chairToken, UPLOAD_PROOF, { d: { coopname: COOP, payment_hash: deposit.hash, mime_type: 'image/png', ...c } })
    const err = await gqlError(chairToken, UPLOAD_PROOF, { d: { coopname: COOP, payment_hash: deposit.hash, mime_type: 'image/png', ...c } })
    expect(err?.code).toBe('GATEWAY_PAYMENT_FILE_DUPLICATE')
    const list = await gql<any>(chairToken, PAYMENT_PROOFS, { c: COOP, h: deposit.hash })
    expect(list.paymentProofs.filter((f: any) => f.checksum_sha256 === c.checksum_sha256)).toHaveLength(1)
    expect(list.paymentProofs.some((f: any) => f.checksum_sha256 === proofChecksum)).toBe(true)
  })

  it(caseName('pay.core.side.13', 'чек с неверной суммой или размером отклоняется'), async () => {
    const c = proofContent()
    const wrongSum = await gqlError(chairToken, UPLOAD_PROOF, {
      d: { coopname: COOP, payment_hash: deposit.hash, mime_type: 'image/png', ...c, checksum_sha256: 'a'.repeat(64) },
    })
    expect(wrongSum?.code).toBe('GATEWAY_PAYMENT_FILE_CHECKSUM_MISMATCH')
    const wrongSize = await gqlError(chairToken, UPLOAD_PROOF, {
      d: { coopname: COOP, payment_hash: deposit.hash, mime_type: 'image/png', ...c, size_bytes: c.size_bytes + 1 },
    })
    expect(wrongSize?.code).toBe('GATEWAY_PAYMENT_FILE_SIZE_MISMATCH')
  })

  it(caseName('pay.core.side.14', 'чек к несуществующему платежу и несуществующий чек — не найдены'), async () => {
    const noPayment = await gqlError(chairToken, UPLOAD_PROOF, {
      d: { coopname: COOP, payment_hash: crypto.randomBytes(32).toString('hex'), mime_type: 'image/png', ...proofContent() },
    })
    expect(noPayment?.code).toBe('GATEWAY_PAYMENT_NOT_FOUND_BY_HASH')
    const noFile = await gqlError(chairToken, PAYMENT_FILE, { id: 2_000_000_000 })
    expect(noFile?.code).toBe('GATEWAY_PAYMENT_FILE_NOT_FOUND')
  })

  // ── Реквизиты ────────────────────────────────────────────────────────────

  let sbp: any

  it(caseName('pay.core.happy.05', 'пайщик добавляет свои реквизиты СБП и видит их'), async () => {
    const phone = randomPhone()
    sbp = await addSbpMethod(payerToken, payer.account, phone)
    expect(sbp.username).toBe(payer.account)
    expect(sbp.method_type).toBe('sbp')
    expect(sbp.data.phone).toBe(phone)
    const mine = await methodsOf(payerToken, payer.account)
    expect(mine.find(m => m.method_id === sbp.method_id)?.data?.phone).toBe(phone)
  })

  it(caseName('pay.core.side.15', 'чужой пайщик не читает, не добавляет, не меняет и не удаляет реквизиты пайщика'), async () => {
    expect((await gqlError(otherToken, GET_METHODS, { d: { username: payer.account, page: 1, limit: 10, sortOrder: 'ASC' } }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await gqlError(otherToken, ADD_METHOD, { d: { username: payer.account, is_default: true, sbp_data: { phone: randomPhone() } } }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await gqlError(otherToken, UPDATE_BANK, { d: { username: payer.account, method_id: sbp.method_id, is_default: true, data: bankAccount({ bank_name: 'Чужой банк' }) } }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await gqlError(otherToken, DELETE_METHOD, { d: { username: payer.account, method_id: sbp.method_id } }))?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    expect(String((await gqlError(null, GET_METHODS, { d: { username: payer.account, page: 1, limit: 10, sortOrder: 'ASC' } }))?.code)).toBe('401')

    const mine = await methodsOf(payerToken, payer.account)
    const still = mine.find(m => m.method_id === sbp.method_id)
    expect(still?.method_type).toBe('sbp')
    expect(mine.every(m => m.data?.bank_name !== 'Чужой банк')).toBe(true)
  })

  it(caseName('pay.core.happy.06', 'пайщик ведёт свой банковский счёт: добавляет и меняет его'), async () => {
    const add = await gql<any>(payerToken, ADD_METHOD, { d: { username: payer.account, is_default: false, bank_transfer_data: bankAccount({ bank_name: 'Банк Первый' }) } })
    const bank = add.addPaymentMethod
    expect(bank.method_type).toBe('bank_transfer')

    const next = bankAccount({ bank_name: 'Банк Второй' })
    await gql(payerToken, UPDATE_BANK, { d: { username: payer.account, method_id: bank.method_id, is_default: false, data: next } })
    const mine = await methodsOf(payerToken, payer.account)
    const updated = mine.filter(m => m.method_id === bank.method_id)
    expect(updated).toHaveLength(1)
    expect(updated[0].data?.bank_name).toBe('Банк Второй')
    expect(updated[0].data?.account_number).toBe(next.account_number)
    // Прежние реквизиты СБП на месте.
    expect(mine.some(m => m.method_id === sbp.method_id)).toBe(true)
  })

  it(caseName('pay.core.happy.07', 'председатель ведёт реквизиты пайщика'), async () => {
    const phone = randomPhone()
    const added = await addSbpMethod(chairToken, payer.account, phone)
    expect(added.username).toBe(payer.account)
    const seenByChair = await methodsOf(chairToken, payer.account)
    expect(seenByChair.some(m => m.method_id === added.method_id)).toBe(true)
    const seenByPayer = await methodsOf(payerToken, payer.account)
    expect(seenByPayer.find(m => m.method_id === added.method_id)?.data?.phone).toBe(phone)
  })

  it(caseName('pay.core.happy.08', 'владелец удаляет свои реквизиты — они пропадают из списка'), async () => {
    // До 25.09.2026 удаление отвергалось всегда: id способа оплаты — строка,
    // а проверка входа ждала число (422).
    const extra = await addSbpMethod(payerToken, payer.account, randomPhone())
    expect((await gql<any>(payerToken, DELETE_METHOD, { d: { username: payer.account, method_id: extra.method_id } })).deletePaymentMethod).toBe(true)
    const mine = await methodsOf(payerToken, payer.account)
    expect(mine.some(m => m.method_id === extra.method_id)).toBe(false)
    expect(mine.some(m => m.method_id === sbp.method_id)).toBe(true)
  })
})

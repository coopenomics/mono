/**
 * Ответ мутации, когда блок её транзакции не разобран за предел
 * (test-registry/sync.write-wait-delta.yaml).
 *
 * Мутация с транзакцией отвечает после разбора её блока узлом. Здесь чтение
 * цепи заморожено: транзакция уходит в цепь, блок не разбирается. Мутация
 * обязана ответить по истечении предела ожидания (BLOCKCHAIN_WRITE_WAIT_DELTA_MS,
 * 3 с), а не повиснуть; запись появляется в зеркале узла, когда чтение
 * возобновлено.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIN_READER, CHAIRMAN, FAULTS_ENABLED, availableShare, awaitNodeSynced, caseName, freshMember, gql, login, pauseService, resumeService, tokenOf, waitFor } from '../core'
import { mirroredAvailable } from '../platform/platform-a.helpers'

const WRITE_WAIT_MS = 3_000
const AMOUNT = 777

describe.skipIf(!FAULTS_ENABLED)('sync.write-wait-delta: блок транзакции не разобран за предел', () => {
  let member: Who
  let memberToken = ''
  let chairmanToken = ''
  let paymentId = ''
  let mirrorBefore = 0
  let chainBefore = 0

  beforeAll(async () => {
    await awaitNodeSynced()
    member = freshMember({ prefix: 'wwf' })
    memberToken = await login(member)
    chairmanToken = await tokenOf(CHAIRMAN)
    mirrorBefore = await mirroredAvailable(memberToken, member.account)
    chainBefore = await availableShare(member.account)
    const pay = await gql<any>(memberToken, `mutation($d:CreateDepositPaymentInput!){
      createDepositPayment(data:$d){ id hash status }
    }`, { d: { username: member.account, quantity: AMOUNT, symbol: 'RUB' } })
    paymentId = pay.createDepositPayment.id
  })

  afterAll(async () => {
    await resumeService(CHAIN_READER)
    await awaitNodeSynced()
  })

  it(caseName('sync.wwd.side.04', 'чтение цепи стоит — мутация отвечает по истечении предела, запись доходит до зеркала после возобновления'), async () => {
    await pauseService(CHAIN_READER)
    let elapsedMs = 0
    try {
      const started = Date.now()
      await gql(chairmanToken, `mutation($d:SetPaymentStatusInput!){ setPaymentStatus(data:$d){ id } }`, { d: { id: paymentId, status: 'PAID' } })
      elapsedMs = Date.now() - started

      // Транзакция в цепи прошла, а блок узлом не разобран: зеркало прежнее.
      expect(await availableShare(member.account), 'взнос проведён в цепи').toBeCloseTo(chainBefore + AMOUNT, 4)
      expect(await mirroredAvailable(memberToken, member.account), 'зеркало узла ещё не видит взнос').toBeCloseTo(mirrorBefore, 4)
    }
    finally {
      await resumeService(CHAIN_READER)
    }
    expect(elapsedMs, 'ответ ждал разбора блока до предела').toBeGreaterThanOrEqual(WRITE_WAIT_MS - 200)
    expect(elapsedMs, 'ответ не повис на неразобранном блоке').toBeLessThan(WRITE_WAIT_MS * 5)

    const mirrored = await waitFor(async () => {
      const now = await mirroredAvailable(memberToken, member.account)
      return Math.abs(now - mirrorBefore - AMOUNT) < 0.00005 ? now : null
    }, { timeoutMs: 60_000, intervalMs: 500, label: 'взноса в зеркале узла после возобновления чтения цепи' })
    expect(mirrored).toBeCloseTo(mirrorBefore + AMOUNT, 4)
  })
})

/**
 * Паевой взнос в программу «Благорост» снаружи (реестр capital.program-invest):
 * стол после ответа сразу перечитывает кошельки и взносы пайщика и видит уже
 * новые — ответ уходит после изменений из блока транзакции.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { caseName, deposit, tokenOf, waitFor } from '../core'
import { amount, capitalMember, capitalWallets, contributorOf, ensureCapitalProgram, programInvest } from './cap-results.helpers'

const INVEST = 500

let member: Who
let token = ''

describe('Благорост: паевой взнос в программу', () => {
  beforeAll(async () => {
    await ensureCapitalProgram()
    member = await capitalMember('pinv')
    token = await tokenOf(member)
    await deposit(member.account, 2 * INVEST)
    await waitFor(async () => ((await capitalWallets(token, member.account)).share >= 2 * INVEST ? true : null),
      { timeoutMs: 120_000, intervalMs: 1_000, label: 'паевой взнос деньгами в зеркале' })
  })

  it(caseName('cap.pinv.side.10', 'сразу после ответа кошельки и взносы пайщика уже изменены'), async () => {
    const walletsBefore = await capitalWallets(token, member.account)
    const investedBefore = amount((await contributorOf(token, member.account))?.contributed_as_investor)

    await programInvest(member, token, INVEST)

    // Без ожидания: стол перечитывает сразу после ответа.
    const walletsAfter = await capitalWallets(token, member.account)
    expect(walletsAfter.share).toBeCloseTo(walletsBefore.share - INVEST, 4)
    expect(walletsAfter.blago).toBeCloseTo(walletsBefore.blago + INVEST, 4)
    const investedAfter = amount((await contributorOf(token, member.account))?.contributed_as_investor)
    expect(investedAfter).toBeCloseTo(investedBefore + INVEST, 4)
  })
})

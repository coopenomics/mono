/**
 * Паевой взнос в программу «Благорост» снаружи (реестр capital.program-invest):
 * стол после ответа сразу перечитывает кошельки и взносы пайщика и видит уже
 * новые — ответ уходит после изменений из блока транзакции.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COOP, caseName, deposit, gql, signDocument, tokenOf, waitFor } from '../core'
import { amount, capitalMember, contributorOf, ensureCapitalProgram, gqlPaced } from './cap-results.helpers'

const INVEST = 500
const INVEST_AMOUNT = `${INVEST.toFixed(4)} RUB`

async function wallets(token: string, username: string): Promise<{ share: number, blago: number }> {
  const d = await gql<any>(token, 'query($u:String!){ getUserWallets(username:$u){ wallet_name available blocked } }', { u: username })
  const rows = d.getUserWallets as any[]
  const share = rows.find(w => w.wallet_name === 'w.wal.share')
  const blago = rows.find(w => w.wallet_name === 'w.cap.blago')
  return {
    share: amount(share?.available),
    blago: amount(blago?.available) + amount(blago?.blocked),
  }
}

let member: Who
let token = ''

describe('Благорост: паевой взнос в программу', () => {
  beforeAll(async () => {
    await ensureCapitalProgram()
    member = await capitalMember('pinv')
    token = await tokenOf(member)
    await deposit(member.account, 2 * INVEST)
    await waitFor(async () => ((await wallets(token, member.account)).share >= 2 * INVEST ? true : null),
      { timeoutMs: 120_000, intervalMs: 1_000, label: 'паевой взнос деньгами в зеркале' })
  })

  it(caseName('cap.pinv.side.10', 'сразу после ответа кошельки и взносы пайщика уже изменены'), async () => {
    const walletsBefore = await wallets(token, member.account)
    const investedBefore = amount((await contributorOf(token, member.account))?.contributed_as_investor)

    const gen = await gqlPaced<any>(token, `mutation($d:ProgramCapitalizationMoneyInvestStatementGenerateDocumentInput!){
      capitalGenerateProgramMoneyInvestStatement(data:$d){ full_title html hash meta binary }
    }`, { d: { coopname: COOP, username: member.account, amount: INVEST_AMOUNT } })
    const statement = await signDocument(member.wif, gen.capitalGenerateProgramMoneyInvestStatement, member.account)
    await gql(token, `mutation($d:CreateProgramInvestInput!){ capitalCreateProgramInvest(data:$d){ transaction } }`, {
      d: { coopname: COOP, username: member.account, amount: INVEST_AMOUNT, statement },
    })

    // Без ожидания: стол перечитывает сразу после ответа.
    const walletsAfter = await wallets(token, member.account)
    expect(walletsAfter.share).toBeCloseTo(walletsBefore.share - INVEST, 4)
    expect(walletsAfter.blago).toBeCloseTo(walletsBefore.blago + INVEST, 4)
    const investedAfter = amount((await contributorOf(token, member.account))?.contributed_as_investor)
    expect(investedAfter).toBeCloseTo(investedBefore + INVEST, 4)
  })
})

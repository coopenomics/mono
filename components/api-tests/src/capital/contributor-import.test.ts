/**
 * Импорт пайщика с бумажными договорами снаружи (реестр
 * capital.contributor-import): после ответа председателю строка участника
 * программы уже читается такой, какой её записала цепь.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, caseName, freshMember, gql, tokenOf } from '../core'
import { amount, contributorOf, ensureCapitalProgram } from './cap-results.helpers'

const IMPORT = 1_500

let member: Who

describe('Благорост: импорт участника', () => {
  beforeAll(async () => {
    await ensureCapitalProgram()
    member = freshMember({ prefix: 'cimp' })
  })

  it(caseName('capital.ci.side.fact-01', 'строка импортированного участника читается сразу после ответа, без паузы'), async () => {
    const chairToken = await tokenOf(CHAIRMAN)
    const tag = member.account.slice(-6)
    await gql(chairToken, `mutation($d:ImportContributorInput!){ capitalImportContributor(data:$d){ transaction } }`, {
      d: {
        coopname: COOP,
        username: member.account,
        contribution_amount: `${IMPORT.toFixed(4)} RUB`,
        contributor_contract_number: `УХД-${tag}`,
        contributor_contract_created_at: '15.01.2025',
        blagorost_agreement_number: `БР-${tag}`,
        blagorost_agreement_created_at: '15.01.2025',
        memo: 'импорт внешнего слоя тестов',
      },
    })

    // Без ожидания: статус и сумма взноса — из строки цепи.
    const row = await contributorOf(chairToken, member.account)
    expect(row, 'участник программы после импорта').not.toBeNull()
    expect(row.status).toBe('IMPORT')
    expect(amount(row.contributed_as_investor)).toBeCloseTo(IMPORT, 4)
  })
})

/**
 * Участник Благороста появляется в зеркале вместе с данными цепи
 * (реестр capital.contributor-import).
 *
 * Строку участника контроллер заводил после транзакции, а транзакция с
 * 23.09.2026 ждёт свой блок: дельта приходила раньше строки, синхронизатор не
 * мог записать участника без имени, и зеркало навсегда оставалось с пустым
 * взносом и статусом «ожидает» (25.09.2026, C28-80). Участник, заведённый в
 * цепи мимо контроллера, не попадал в зеркало вовсе.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, caseName, freshMember, gql, gqlError, tableRows, tokenOf, waitFor } from '../core'
import { registerContributor } from './cap-metrics.helpers'
import { CAPITAL, amount, completeCapitalRegistration, ensureCapitalProgram } from './cap-results.helpers'

const IMPORT = 'mutation($d:ImportContributorInput!){ capitalImportContributor(data:$d){ __typename } }'
const FIELDS = 'username status blockchain_status display_name contributed_as_investor present'

let chairman = ''

async function contributor(username: string): Promise<any | null> {
  const d = await gql<any>(chairman, `query($d:GetContributorInput!){ capitalContributor(data:$d){ ${FIELDS} } }`, { d: { username } })
  return d.capitalContributor
}

function importInput(who: Who, amountRub: string) {
  return {
    coopname: COOP,
    username: who.account,
    contribution_amount: amountRub,
    contributor_contract_number: `УХД-${who.account}`,
    contributor_contract_created_at: '01.09.2026',
    blagorost_agreement_number: `БР-${who.account}`,
    blagorost_agreement_created_at: '01.09.2026',
    memo: 'импорт внешнего слоя',
  }
}

describe('Благорост: участник в зеркале вместе с данными цепи', () => {
  beforeAll(async () => {
    await ensureCapitalProgram()
    chairman = await tokenOf(CHAIRMAN)
  })

  it(caseName('cap.cimp.side.07', 'импорт: сразу после ответа участник в зеркале со взносом, статусом цепи и именем'), async () => {
    const who = freshMember({ prefix: 'cimp' })
    await gql(chairman, IMPORT, { d: importInput(who, '1500.0000 RUB') })

    const c = await contributor(who.account)
    expect(c.present).toBe(true)
    expect(c.blockchain_status).toBe('import')
    expect(amount(c.contributed_as_investor)).toBe(1500)
    expect(c.display_name).toContain('Внешнийслой')

    // Повторный импорт того же пайщика — отказ до цепи.
    const again = await gqlError(chairman, IMPORT, { d: importInput(who, '1500.0000 RUB') })
    expect(again?.code).toBe('CAPITAL_CONTRIBUTOR_ALREADY_REGISTERED')
  })

  it(caseName('cap.cimp.side.04', 'цепь отклонила импорт — записи участника в зеркале не остаётся, повтор возможен'), async () => {
    const who = freshMember({ prefix: 'cimp' })
    const refused = await gqlError(chairman, IMPORT, { d: importInput(who, '0.0000 RUB') })
    expect(refused).not.toBeNull()
    expect(await contributor(who.account)).toBeNull()

    await gql(chairman, IMPORT, { d: importInput(who, '700.0000 RUB') })
    expect(amount((await contributor(who.account)).contributed_as_investor)).toBe(700)
  })

  it(caseName('cap.cimp.side.08', 'договор УХД отправлен в цепь мимо контроллера — участник попадает в зеркало с именем из аккаунта'), async () => {
    const who = freshMember({ prefix: 'cimp' })
    await registerContributor(who)
    const c = await waitFor(async () => {
      const row = await contributor(who.account)
      return row?.display_name ? row : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: `участник ${who.account} в зеркале` })
    expect(c.display_name).toContain('Внешнийслой')
    expect(c.present).toBe(true)
  })

  it(caseName('cap.cimp.side.09', 'импортированный пайщик завершает регистрацию — зеркало совпадает с цепью, данные формы сохранены'), async () => {
    const who = freshMember({ prefix: 'cimp' })
    await gql(chairman, IMPORT, { d: importInput(who, '300.0000 RUB') })
    await completeCapitalRegistration(who, 'Импортированный пайщик внешнего слоя')

    const chain = (await tableRows<any>(CAPITAL, COOP, 'contributors')).find(r => r.username === who.account)
    const c = await contributor(who.account)
    expect(c.blockchain_status).toBe(chain.status)
    expect(amount(c.contributed_as_investor)).toBe(300)
    const d = await gql<any>(chairman, 'query($d:GetContributorInput!){ capitalContributor(data:$d){ about storage_agreement_hash } }', { d: { username: who.account } })
    expect(d.capitalContributor.about).toBe('Импортированный пайщик внешнего слоя')
    expect(d.capitalContributor.storage_agreement_hash).toBeTruthy()
  })
})

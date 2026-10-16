/**
 * Задачи кассы снаружи (test-registry/cashier.desk.yaml, случаи cashier.notify.*):
 * уведомление «подтвердите платёж» уходит председателю и пайщикам с ролью
 * «Кассир», ссылка ведёт в реестр платежей стола кассира. Проверяется на
 * заявке на паевой взнос — её заводит сам пайщик, без цепи и совета.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, caseName, freshMember, gql, login, tokenOf, waitFor } from '../core'
import { createDeposit } from './payments.helpers'

/** Тип уведомления «Новая заявка на паевой взнос» (каталог @coopenomics/notifications). */
const DEPOSIT_WORKFLOW = 'novaya-novaya-zayavka-na-paevoy-vznos'
const INBOX = `query($c:String!,$p:PaginationInput!){ getInboxNotifications(coopname:$c, pagination:$p){
  items{ workflowId payload createdAt } } }`
const ASSIGN = 'mutation($d:RoleAssignmentInput!){ assignRole(data:$d){ key } }'
const REVOKE = 'mutation($d:RoleAssignmentInput!){ revokeRole(data:$d){ key } }'

async function depositTaskFor(token: string, payer: string): Promise<any | undefined> {
  const d = await gql<any>(token, INBOX, { c: COOP, p: { page: 1, limit: 100, sortOrder: 'DESC' } })
  return (d.getInboxNotifications.items as any[]).find(i =>
    i.workflowId === DEPOSIT_WORKFLOW && String(i.payload?.paymentUrl ?? '').endsWith(`/${COOP}/cashier/payments/${payer}`))
}

function waitTask(token: string, payer: string, label: string): Promise<any> {
  return waitFor(() => depositTaskFor(token, payer), { timeoutMs: 90_000, intervalMs: 2_000, label })
}

describe('задачи кассы: уведомление о платеже на подтверждение', () => {
  let cashier: Who
  let cashierToken: string
  let chairToken: string

  beforeAll(async () => {
    chairToken = await tokenOf(CHAIRMAN)
    cashier = freshMember({ prefix: 'cdcash', firstName: 'Касса', lastName: 'Проверочная' })
    cashierToken = await login(cashier)
    await gql(chairToken, ASSIGN, { d: { username: cashier.account, role: 'cashier' } })
  }, 180_000)

  afterAll(async () => {
    await gql(chairToken, REVOKE, { d: { username: cashier.account, role: 'cashier' } })
  }, 60_000)

  it(caseName('cashier.notify.happy.01', 'кассир и председатель получают задачу о заявке на паевой взнос, ссылка — реестр платежей стола кассира'), async () => {
    const payer = freshMember({ prefix: 'cdpay' })
    await createDeposit(await login(payer), payer.account, 150)
    const task = await waitTask(cashierToken, payer.account, `задача кассы кассиру по взносу ${payer.account}`)
    // Обращение — к самому кассиру, не к председателю.
    expect(task.payload.chairmanName).toBeTruthy()
    expect(task.payload.participantName).toBeTruthy()
    expect(await waitTask(chairToken, payer.account, `задача кассы председателю по взносу ${payer.account}`)).toBeDefined()
  }, 240_000)

  it(caseName('cashier.notify.side.01', 'после снятия роли задачи кассы пайщику не приходят'), async () => {
    await gql(chairToken, REVOKE, { d: { username: cashier.account, role: 'cashier' } })
    const payer = freshMember({ prefix: 'cdpay' })
    await createDeposit(await login(payer), payer.account, 150)
    // Председатель задачу получил — рассылка прошла; бывшему кассиру её нет.
    await waitTask(chairToken, payer.account, `задача кассы председателю по взносу ${payer.account}`)
    expect(await depositTaskFor(cashierToken, payer.account)).toBeUndefined()
  }, 240_000)
})

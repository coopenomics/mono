/**
 * Пайщик без адреса Центра уведомлений получает его при старте узла
 * (test-registry/notifications.center.yaml, ntf.center.side.06).
 *
 * Пайщик, заведённый мимо регистрации контроллера (перенос, засев), приходит
 * без идентификатора подписчика, и уведомления ему адресовать некому. Узел
 * добирает таких пайщиков при старте — не дожидаясь фоновой задачи, которая
 * идёт раз в полчаса. Старт узла снаружи — перезапуск его сервиса, поэтому
 * набор живёт в фазе отказов стенда.
 */
import crypto from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, FAULTS_ENABLED, awaitNodeSynced, caseName, freshMember, gql, login, startService, stopService, tokenOf, waitFor } from '../core'

const WORKFLOW = 'reshenie-soveta-prinyato'
const CONTROLLER = 'coopback'
const TRIGGER = 'mutation($d:TriggerNotificationWorkflowInput!){ triggerNotificationWorkflow(data:$d) }'
const INBOX = `query($c:String!,$p:PaginationInput!){ getInboxNotifications(coopname:$c, pagination:$p){
  items{ id workflowId body payload isRead } } }`
const SUBSCRIBER = 'query($d:GetAccountInput!){ getAccount(data:$d){ provider_account{ subscriber_id } } }'

describe.skipIf(!FAULTS_ENABLED)('ntf.center: адрес уведомлений добирается при старте узла', () => {
  afterAll(async () => {
    await startService(CONTROLLER)
    await awaitNodeSynced()
  }, 400_000)

  it(caseName('ntf.center.side.06', 'пайщик заведён без адреса уведомлений — после старта узла адрес есть, уведомление доходит'), async () => {
    const member = freshMember({ prefix: 'nsb', withoutNotificationAddress: true })
    const token = await login(member)
    const subscriberOf = async (): Promise<string | null> =>
      (await gql<any>(token, SUBSCRIBER, { d: { username: member.account } })).getAccount.provider_account?.subscriber_id ?? null
    expect(await subscriberOf(), 'условие случая: адреса уведомлений у пайщика нет').toBeFalsy()

    await stopService(CONTROLLER)
    await startService(CONTROLLER)
    await awaitNodeSynced(300_000)

    // Добор идёт в фоне сразу после старта, старт он не держит.
    const subscriberId = await waitFor(subscriberOf, { timeoutMs: 120_000, intervalMs: 2_000, label: 'адрес уведомлений заведён после старта узла' })
    expect(subscriberId).toBeTruthy()

    const decisionId = `backfill-${crypto.randomBytes(5).toString('hex')}`
    await gql(await tokenOf(CHAIRMAN), TRIGGER, {
      d: { name: WORKFLOW, to: [{ username: member.account }], payload: { userName: 'Тест', decisionTitle: `Добор адреса ${decisionId}`, coopname: COOP, decision_id: decisionId } },
    })
    const item = await waitFor(async () => {
      const d = await gql<any>(token, INBOX, { c: COOP, p: { page: 1, limit: 50, sortOrder: 'DESC' } })
      return (d.getInboxNotifications.items as any[]).find(i => i.payload?.decision_id === decisionId) ?? null
    }, { timeoutMs: 90_000, intervalMs: 1_500, label: 'уведомление в инбоксе пайщика' })
    expect(item.workflowId).toBe(WORKFLOW)
    expect(item.isRead).toBe(false)
  }, 900_000)
})

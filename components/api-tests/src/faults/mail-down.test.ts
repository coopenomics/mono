/**
 * Почтовый шлюз лежит целиком (test-registry/notifications.center.yaml,
 * ntf.center.break.01).
 *
 * Письмо, поставленное в очередь при неработающем шлюзе, не сгорает: попытка
 * не тратится, строка ждёт возвращения канала и уходит сама, как только шлюз
 * ответит. Остальные каналы доставки простоя почты не замечают.
 *
 * Шлюз стенда — перехватчик Mailpit; набор останавливает и запускает его.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Candidate } from '../core'
import { CHAIRMAN, COOP, FAULTS_ENABLED, caseName, gql, latestMail, registerCandidate, startService, stopService, tokenOf, waitFor } from '../core'

const WORKFLOW = 'reshenie-soveta-prinyato'
const MAIL_GATEWAY = 'mailpit'
const TRIGGER = 'mutation($d:TriggerNotificationWorkflowInput!){ triggerNotificationWorkflow(data:$d) }'
const JOURNAL = `query($f:NotificationsFilterInput!,$p:PaginationInput!){ getNotifications(filter:$f, pagination:$p){
  items{ id channel recipientUsername status attempts lastError } } }`

describe.skipIf(!FAULTS_ENABLED)('ntf.center: почтовый шлюз недоступен', () => {
  let chairman = ''
  let recipient: Candidate
  const decisionTitle = `Почта лежит ${crypto.randomBytes(4).toString('hex')}`

  async function row(channel: 'EMAIL' | 'IN_APP'): Promise<any | undefined> {
    const d = await gql<any>(chairman, JOURNAL, {
      f: { coopname: COOP, workflowId: WORKFLOW, channel, recipientSubscriberId: recipient.subscriberId },
      p: { page: 1, limit: 20, sortOrder: 'DESC' },
    })
    return (d.getNotifications.items as any[]).find(i => i.recipientUsername === recipient.username)
  }

  beforeAll(async () => {
    chairman = await tokenOf(CHAIRMAN)
    recipient = await registerCandidate({ prefix: 'mdn' })
  })

  afterAll(async () => {
    await startService(MAIL_GATEWAY)
  })

  it(caseName('ntf.center.break.01', 'шлюз лежит — письмо ждёт канал, попытка не тратится; шлюз вернулся — письмо ушло само'), async () => {
    await stopService(MAIL_GATEWAY)
    await gql(chairman, TRIGGER, {
      d: { name: WORKFLOW, to: [{ username: recipient.username }], payload: { userName: 'Тест', decisionTitle, coopname: COOP, decision_id: `mail-${Date.now()}` } },
    })

    const parked = await waitFor(async () => {
      const email = await row('EMAIL')
      return email?.status === 'PENDING' && email.lastError ? email : null
    }, { timeoutMs: 120_000, intervalMs: 2_000, label: 'письмо отложено до возвращения шлюза' })
    expect(parked.attempts, 'простой канала попытку не тратит').toBe(0)

    // Уведомление в приложении простоя почты не замечает.
    const inApp = await waitFor(async () => {
      const r = await row('IN_APP')
      return r?.status === 'SENT' ? r : null
    }, { timeoutMs: 60_000, intervalMs: 2_000, label: 'уведомление в приложении доставлено' })
    expect(inApp.attempts).toBe(1)

    await startService(MAIL_GATEWAY)
    const sent = await waitFor(async () => {
      const email = await row('EMAIL')
      return email?.status === 'SENT' ? email : null
    }, { timeoutMs: 240_000, intervalMs: 3_000, label: 'письмо ушло после возвращения шлюза' })
    expect(sent.id, 'ушла та же строка очереди, новая не ставилась').toBe(parked.id)
    expect(sent.attempts).toBe(1)

    const mail = await latestMail(recipient.email, decisionTitle, 60_000)
    expect(mail.subject).toBeTruthy()
  }, 600_000)
})

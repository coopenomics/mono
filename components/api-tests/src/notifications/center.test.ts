/**
 * Центр уведомлений снаружи: очередь доставки (notification_outbox), журнал
 * попыток (notification_deliveries), личный инбокс (notification_inbox) и
 * веб-пуш подписки (web_push_subscriptions).
 *
 * Уведомление ставит председатель мутацией triggerNotificationWorkflow —
 * тем же входом, что и провайдер. Доставку делает фоновый обработчик очереди
 * контроллера (тик в несколько секунд), поэтому появление строки в инбоксе
 * и смена статуса в журнале ожидаются опросом: это запись мимо мутации.
 *
 * Получатель уведомлений — пайщик, зарегистрированный через контроллер
 * (center.helpers.ts): только регистрация заводит идентификатор подписчика, у
 * участников стенда его нет. Свои строки ищутся по decision_id, счётчик
 * непрочитанных сверяется с лентой в тот же момент.
 * Роль «пайщик» и веб-пуш подписки проверяются на свежем пайщике.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COUNCIL, ROLES, caseName, freshMember, gql, gqlError, login, tokenOf, waitFor } from '../core'
import type { GqlError } from '../core'
import type { Candidate } from './center.helpers'
import { registerCandidate } from './center.helpers'

/** Тип уведомления с шагами email + in_app + push (каталог @coopenomics/notifications). */
const WORKFLOW = 'reshenie-soveta-prinyato'
const PAGE = { page: 1, limit: 100, sortOrder: 'DESC' }

const AUTH_CODES = ['401', 'UNAUTHENTICATED', 'KIT_USER_NOT_AUTHORIZED', 'KIT_SESSION_ENDED']
function expectAuthDenied(err: GqlError | null): void {
  expect(err, 'ожидался отказ входа').not.toBeNull()
  expect(AUTH_CODES, JSON.stringify(err)).toContain(String(err!.code))
}
function expectCode(err: GqlError | null, code: string): void {
  expect(err, `ожидался отказ ${code}`).not.toBeNull()
  expect(String(err!.code), JSON.stringify(err)).toBe(code)
}

const INBOX = `query($c:String!,$p:PaginationInput!){ getInboxNotifications(coopname:$c, pagination:$p){
  totalCount items{ id workflowId title body payload actorSubscriberId isRead readAt createdAt } } }`
const UNREAD = 'query($c:String!){ getUnreadNotificationsCount(coopname:$c){ count } }'
const MARK = 'mutation($id:String!){ markNotificationRead(id:$id){ id isRead readAt } }'
const MARK_ALL = 'mutation($c:String!){ markAllNotificationsRead(coopname:$c){ count } }'
const TRIGGER = 'mutation($d:TriggerNotificationWorkflowInput!){ triggerNotificationWorkflow(data:$d) }'
const JOURNAL = `query($f:NotificationsFilterInput!,$p:PaginationInput!){ getNotifications(filter:$f, pagination:$p){
  totalCount items{ id coopname workflowId channel recipientSubscriberId recipientUsername status attempts lastError } } }`
const DETAIL = `query($id:String!){ getNotification(id:$id){ id channel status attempts recipientUsername
  deliveries{ id attemptNumber status providerResponse error } } }`
const RESEND = 'mutation($id:String!){ resendNotification(id:$id){ id status attempts channel recipientSubscriberId workflowId } }'

const SUB_FIELDS = 'id username endpoint isActive authKey p256dhKey'
const SUB_CREATE = `mutation($d:CreateSubscriptionInput!){ createWebPushSubscription(data:$d){ success subscription{ ${SUB_FIELDS} } } }`
const SUB_LIST = `query($d:GetUserSubscriptionsInput!){ getUserWebPushSubscriptions(data:$d){ ${SUB_FIELDS} } }`
const SUB_STATS = 'query{ getWebPushSubscriptionStats{ total active inactive uniqueUsers } }'
const SUB_OFF = 'mutation($d:DeactivateSubscriptionInput!){ deactivateWebPushSubscriptionById(data:$d) }'

async function inbox(token: string): Promise<any[]> {
  const d = await gql<any>(token, INBOX, { c: COOP, p: PAGE })
  return d.getInboxNotifications.items
}

async function unread(token: string): Promise<number> {
  const d = await gql<any>(token, UNREAD, { c: COOP })
  return d.getUnreadNotificationsCount.count
}

/** Счётчик непрочитанных совпадает с числом непрочитанных строк ленты. */
async function expectUnreadConsistent(token: string): Promise<number> {
  const [count, items] = [await unread(token), await inbox(token)]
  expect(count).toBe(items.filter(i => !i.isRead).length)
  return count
}

async function journal(token: string, filter: Record<string, unknown>): Promise<any[]> {
  const d = await gql<any>(token, JOURNAL, { f: { coopname: COOP, ...filter }, p: PAGE })
  return d.getNotifications.items
}

/** Получатель уведомлений — пайщик, прошедший регистрацию через контроллер. */
let recipient: Candidate
let recipientToken: string
let subscriberId: string
/** Свежий пайщик (роль user): отказы по роли и веб-пуш подписки. */
let member: Who
let memberToken: string
let chairToken: string
let councilToken: string
let otherToken: string

/** Уведомление, поставленное в этом прогоне: по decision_id его находят в инбоксе. */
const decisionId = `api-${crypto.randomBytes(6).toString('hex')}`
const decisionTitle = `Проверка центра уведомлений ${decisionId}`
let inboxItemId: string
let inAppOutboxId: string

function mine(items: any[]): any[] {
  return items.filter(i => i.payload?.decision_id === decisionId)
}

beforeAll(async () => {
  member = freshMember({ prefix: 'ntf' })
  memberToken = await login(member)
  chairToken = await tokenOf(CHAIRMAN)
  councilToken = await tokenOf(COUNCIL)
  otherToken = await tokenOf(ROLES.otherMember())
  recipient = await registerCandidate('ntf')
  recipientToken = recipient.token
  const acc = await gql<any>(recipientToken, 'query($d:GetAccountInput!){ getAccount(data:$d){ provider_account{ subscriber_id } } }', { d: { username: recipient.account } })
  subscriberId = acc.getAccount.provider_account.subscriber_id
  expect(subscriberId, 'регистрация завела идентификатор подписчика').toBeTruthy()
})

describe('центр уведомлений: очередь, журнал, инбокс', () => {
  it(caseName('ntf.center.side.01', 'поставить уведомление может только председатель'), async () => {
    const data = { d: { name: WORKFLOW, to: [{ username: recipient.account }], payload: { decision_id: 'x' } } }
    expectCode(await gqlError(councilToken, TRIGGER, data), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(memberToken, TRIGGER, data), 'KIT_INSUFFICIENT_RIGHTS')
    expectAuthDenied(await gqlError(null, TRIGGER, data))
    expect(mine(await inbox(recipientToken))).toEqual([])
  })

  it(caseName('ntf.center.happy.01', 'председатель ставит уведомление — получатель видит его в инбоксе непрочитанным'), async () => {
    const r = await gql<any>(chairToken, TRIGGER, {
      d: {
        name: WORKFLOW,
        to: [{ username: recipient.account }],
        payload: { userName: 'Тест', decisionTitle, coopname: COOP, decision_id: decisionId },
      },
    })
    expect(r.triggerNotificationWorkflow).toBe(true)

    const [item] = await waitFor(async () => {
      const found = mine(await inbox(recipientToken))
      return found.length ? found : null
    }, { timeoutMs: 90_000, intervalMs: 1_500, label: 'уведомление в инбоксе пайщика' })
    inboxItemId = item.id
    expect(item.workflowId).toBe(WORKFLOW)
    expect(item.title).toBeTruthy()
    expect(item.body).toContain(decisionTitle)
    expect(item.isRead).toBe(false)
    expect(item.readAt).toBeNull()
    expect(await expectUnreadConsistent(recipientToken)).toBeGreaterThanOrEqual(1)
  })

  it(caseName('ntf.center.happy.02', 'журнал председателя: строка in_app доставлена, попытка записана с номером строки инбокса'), async () => {
    // Строка инбокса пишется раньше, чем обработчик очереди отмечает доставку.
    const inApp = await waitFor(async () => {
      const rows = await journal(chairToken, { recipientSubscriberId: subscriberId, workflowId: WORKFLOW, channel: 'IN_APP' })
      return rows.find(r => r.status === 'SENT') ?? null
    }, { timeoutMs: 30_000, intervalMs: 1_000, label: 'строка in_app отмечена доставленной' })
    expect(inApp.recipientUsername).toBe(recipient.account)
    expect(inApp.attempts).toBe(1)
    inAppOutboxId = inApp.id

    const detail = (await gql<any>(chairToken, DETAIL, { id: inAppOutboxId })).getNotification
    expect(detail.deliveries).toHaveLength(1)
    expect(detail.deliveries[0]).toMatchObject({ attemptNumber: 1, status: 'SENT', providerResponse: `inbox:${inboxItemId}` })

    // фильтр по каналу отдаёт только этот канал
    const onlyInApp = await journal(chairToken, { recipientSubscriberId: subscriberId, channel: 'IN_APP' })
    expect(onlyInApp.length).toBeGreaterThan(0)
    expect(onlyInApp.every(r => r.channel === 'IN_APP')).toBe(true)
  })

  it(caseName('ntf.center.side.02', 'канал push без подписки у получателя гасится как отменённый, без попыток'), async () => {
    const push = await waitFor(async () => {
      const rows = await journal(chairToken, { recipientSubscriberId: subscriberId, workflowId: WORKFLOW, channel: 'PUSH' })
      return rows.find(r => r.status === 'CANCELED') ?? null
    }, { timeoutMs: 60_000, intervalMs: 1_500, label: 'строка push отменена обработчиком очереди' })
    expect(push.lastError).toBeTruthy()
    const detail = (await gql<any>(chairToken, DETAIL, { id: push.id })).getNotification
    expect(detail.deliveries).toEqual([])
  })

  it(caseName('ntf.center.side.03', 'журнал: пайщику закрыт, члену совета открыт, чужой кооператив и чужой id — отказ'), async () => {
    const filter = { f: { coopname: COOP, recipientSubscriberId: subscriberId }, p: PAGE }
    expectCode(await gqlError(memberToken, JOURNAL, filter), 'KIT_INSUFFICIENT_RIGHTS')
    expectAuthDenied(await gqlError(null, JOURNAL, filter))
    const byCouncil = await journal(councilToken, { recipientSubscriberId: subscriberId })
    expect(byCouncil.some(r => r.id === inAppOutboxId)).toBe(true)

    expectCode(await gqlError(chairToken, JOURNAL, { f: { coopname: 'othercoop' }, p: PAGE }), 'NOTIFICATION_CENTER_JOURNAL_FOREIGN_COOP')
    expectCode(await gqlError(chairToken, DETAIL, { id: crypto.randomUUID() }), 'NOTIFICATION_CENTER_JOURNAL_ITEM_NOT_FOUND')
    expectCode(await gqlError(memberToken, DETAIL, { id: inAppOutboxId }), 'KIT_INSUFFICIENT_RIGHTS')
  })

  it(caseName('ntf.center.side.04', 'чужой пайщик не отмечает и не видит уведомление из чужого инбокса, гостю инбокс закрыт'), async () => {
    expectCode(await gqlError(otherToken, MARK, { id: inboxItemId }), 'NOTIFICATION_CENTER_INBOX_ITEM_NOT_FOUND')
    const otherInbox = await inbox(otherToken)
    expect(otherInbox.some(i => i.id === inboxItemId)).toBe(false)
    const [still] = mine(await inbox(recipientToken))
    expect(still.isRead).toBe(false)
    expectAuthDenied(await gqlError(null, INBOX, { c: COOP, p: PAGE }))
    expectAuthDenied(await gqlError(null, MARK, { id: inboxItemId }))
  })

  it(caseName('ntf.center.happy.03', 'получатель отмечает уведомление прочитанным; повторная отметка ничего не меняет'), async () => {
    const first = (await gql<any>(recipientToken, MARK, { id: inboxItemId })).markNotificationRead
    expect(first).toMatchObject({ id: inboxItemId, isRead: true })
    expect(first.readAt).toBeTruthy()
    expect(mine(await inbox(recipientToken))[0]).toMatchObject({ id: inboxItemId, isRead: true, readAt: first.readAt })
    await expectUnreadConsistent(recipientToken)

    const again = (await gql<any>(recipientToken, MARK, { id: inboxItemId })).markNotificationRead
    expect(again.readAt).toBe(first.readAt)
    expectCode(await gqlError(recipientToken, MARK, { id: crypto.randomUUID() }), 'NOTIFICATION_CENTER_INBOX_ITEM_NOT_FOUND')
  })

  it(caseName('ntf.center.happy.04', 'переотправка: новая строка очереди, получатель получает уведомление второй раз'), async () => {
    expectCode(await gqlError(councilToken, RESEND, { id: inAppOutboxId }), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(chairToken, RESEND, { id: crypto.randomUUID() }), 'NOTIFICATION_CENTER_JOURNAL_ITEM_NOT_FOUND')

    const resent = (await gql<any>(chairToken, RESEND, { id: inAppOutboxId })).resendNotification
    expect(resent.id).not.toBe(inAppOutboxId)
    expect(resent).toMatchObject({ status: 'PENDING', attempts: 0, channel: 'IN_APP', recipientSubscriberId: subscriberId, workflowId: WORKFLOW })

    const copies = await waitFor(async () => {
      const found = mine(await inbox(recipientToken))
      return found.length >= 2 ? found : null
    }, { timeoutMs: 90_000, intervalMs: 1_500, label: 'второе уведомление в инбоксе после переотправки' })
    expect(copies).toHaveLength(2)
    const fresh = copies.find(c => c.id !== inboxItemId)
    expect(fresh.isRead).toBe(false)

    // исходная строка журнала не тронута
    const original = (await gql<any>(chairToken, DETAIL, { id: inAppOutboxId })).getNotification
    expect(original).toMatchObject({ status: 'SENT', attempts: 1 })
    expect(original.deliveries).toHaveLength(1)
  })

  it(caseName('ntf.center.happy.05', 'отметить всё прочитанным: счётчик в ноль, все строки инбокса прочитаны'), async () => {
    expect(await expectUnreadConsistent(recipientToken)).toBeGreaterThan(0)
    const r = (await gql<any>(recipientToken, MARK_ALL, { c: COOP })).markAllNotificationsRead
    expect(r.count).toBe(0)
    expect(await unread(recipientToken)).toBe(0)
    const items = mine(await inbox(recipientToken))
    expect(items).toHaveLength(2)
    expect(items.every(i => i.isRead && i.readAt)).toBe(true)
    // повтор на пустом — не ошибка
    expect((await gql<any>(recipientToken, MARK_ALL, { c: COOP })).markAllNotificationsRead.count).toBe(0)
  })
})

describe('веб-пуш подписки', () => {
  const endpoint = `https://push.api-tests.invalid/${crypto.randomBytes(8).toString('hex')}`
  const keys = { p256dh: `p256-${crypto.randomBytes(8).toString('hex')}`, auth: `auth-${crypto.randomBytes(4).toString('hex')}` }
  let subId: string

  it(caseName('ntf.push.happy.01', 'пайщик подписывает своё устройство и видит подписку в своём списке'), async () => {
    const r = (await gql<any>(memberToken, SUB_CREATE, { d: { username: member.account, subscription: { endpoint, keys }, userAgent: 'api-tests' } })).createWebPushSubscription
    expect(r.success).toBe(true)
    expect(r.subscription).toMatchObject({ username: member.account, endpoint, isActive: true, authKey: keys.auth, p256dhKey: keys.p256dh })
    subId = r.subscription.id

    const list = (await gql<any>(memberToken, SUB_LIST, { d: { username: member.account } })).getUserWebPushSubscriptions
    expect(list.map((s: any) => s.id)).toEqual([subId])
  })

  it(caseName('ntf.push.side.01', 'чужие подписки пайщику закрыты, гостю закрыто всё, статистика — только председателю'), async () => {
    expectCode(await gqlError(otherToken, SUB_LIST, { d: { username: member.account } }), 'NOTIFICATION_SUBSCRIPTION_SELF_ONLY')
    expectAuthDenied(await gqlError(null, SUB_LIST, { d: { username: member.account } }))
    expectAuthDenied(await gqlError(null, SUB_CREATE, { d: { username: member.account, subscription: { endpoint: `${endpoint}-guest`, keys } } }))
    expectCode(await gqlError(councilToken, SUB_STATS), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(memberToken, SUB_STATS), 'KIT_INSUFFICIENT_RIGHTS')

    const stats = (await gql<any>(chairToken, SUB_STATS)).getWebPushSubscriptionStats
    expect(stats.active).toBeGreaterThanOrEqual(1)
    expect(stats.total).toBe(stats.active + stats.inactive)
  })

  it(caseName('ntf.push.side.03', 'член совета и председатель не подписывают устройство на чужое имя, не читают и не снимают чужие подписки'), async () => {
    const foreign = { d: { username: member.account, subscription: { endpoint: `${endpoint}-council`, keys } } }
    expectCode(await gqlError(councilToken, SUB_CREATE, foreign), 'NOTIFICATION_SUBSCRIPTION_SELF_ONLY')
    expectCode(await gqlError(chairToken, SUB_LIST, { d: { username: member.account } }), 'NOTIFICATION_SUBSCRIPTION_SELF_ONLY')
    // чужая подписка — «не найдена»: существование не выдаётся
    expectCode(await gqlError(councilToken, SUB_OFF, { d: { subscriptionId: subId } }), 'NOTIFICATION_SUBSCRIPTION_NOT_FOUND')
    const list = (await gql<any>(memberToken, SUB_LIST, { d: { username: member.account } })).getUserWebPushSubscriptions
    expect(list.map((s: any) => [s.id, s.isActive])).toEqual([[subId, true]])
  })

  it(caseName('ntf.push.happy.02', 'повторная подписка того же устройства обновляет ключи, новой строки нет'), async () => {
    const keys2 = { p256dh: `${keys.p256dh}-2`, auth: `${keys.auth}-2` }
    const r = (await gql<any>(memberToken, SUB_CREATE, { d: { username: member.account, subscription: { endpoint, keys: keys2 } } })).createWebPushSubscription
    expect(r.subscription).toMatchObject({ id: subId, p256dhKey: keys2.p256dh, authKey: keys2.auth, isActive: true })
    const list = (await gql<any>(memberToken, SUB_LIST, { d: { username: member.account } })).getUserWebPushSubscriptions
    expect(list).toHaveLength(1)
  })

  it(caseName('ntf.push.happy.03', 'пайщик сам снимает подписку своего устройства (ntf.push.side.02): она уходит из списка, повторная подписка её возвращает'), async () => {
    const statsBefore = (await gql<any>(chairToken, SUB_STATS)).getWebPushSubscriptionStats
    expect((await gql<any>(memberToken, SUB_OFF, { d: { subscriptionId: subId } })).deactivateWebPushSubscriptionById).toBe(true)
    expect((await gql<any>(memberToken, SUB_LIST, { d: { username: member.account } })).getUserWebPushSubscriptions).toEqual([])
    const statsAfter = (await gql<any>(chairToken, SUB_STATS)).getWebPushSubscriptionStats
    expect(statsAfter.total).toBe(statsBefore.total)
    expect(statsAfter.inactive).toBe(statsBefore.inactive + 1)

    const back = (await gql<any>(memberToken, SUB_CREATE, { d: { username: member.account, subscription: { endpoint, keys } } })).createWebPushSubscription
    expect(back.subscription).toMatchObject({ id: subId, isActive: true })

    // уборка: подписка на несуществующий адрес не должна жить после теста
    await gql(memberToken, SUB_OFF, { d: { subscriptionId: subId } })
    expect((await gql<any>(memberToken, SUB_LIST, { d: { username: member.account } })).getUserWebPushSubscriptions).toEqual([])
  })
})

/**
 * Уведомления вокруг модерации предложения (реестр marketplace.offer, 25–27):
 * администратор узнаёт о новой заявке, поставщик — о её судьбе.
 *
 * До 25.09.2026 снаружи не проверялось: у засеянных аккаунтов стенда и у
 * свежих пайщиков не было адреса получателя уведомлений, его дописывал только
 * получасовой добор контроллера (C28-80).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, caseName, gql, tokenOf, waitFor } from '../core'
import type { Supplier } from './offer.helpers'
import { REJECT_OFFER, approve, availableCategoryId, createOffer, freshSupplier, offerInput } from './offer.helpers'

const INBOX = `query($c:String!,$p:PaginationInput!){ getInboxNotifications(coopname:$c, pagination:$p){
  items{ id workflowId title body payload createdAt } } }`

const tag = Date.now().toString(36)
let supplier: Supplier
let categoryId = 0

/** Уведомление во входящих, где упомянут текст (в заголовке, теле или данных). */
async function notificationAbout(token: string, text: string): Promise<any> {
  return waitFor(async () => {
    const d = await gql<any>(token, INBOX, { c: COOP, p: { page: 1, limit: 50, sortOrder: 'DESC' } })
    return (d.getInboxNotifications.items as any[]).find(i => JSON.stringify(i).includes(text)) ?? null
  }, { timeoutMs: 90_000, intervalMs: 1_500, label: `уведомление о «${text}»` })
}

describe('Стол заказов: уведомления о модерации предложения', () => {
  beforeAll(async () => {
    supplier = await freshSupplier('mkntf')
    categoryId = await availableCategoryId(supplier.token)
  })

  it(caseName('mkt.offer.side.25', 'поставщик отправил предложение — администратору уведомление с названием имущества'), async () => {
    const name = `Уведомление о заявке ${tag}`
    await createOffer(supplier.token, offerInput(name, categoryId))
    const item = await notificationAbout(await tokenOf(CHAIRMAN), name)
    expect(item.title || item.body).toBeTruthy()
  })

  it(caseName('mkt.offer.side.26', 'администратор одобрил — поставщику уведомление о публикации'), async () => {
    const name = `Уведомление об одобрении ${tag}`
    const offer = await createOffer(supplier.token, offerInput(name, categoryId))
    await approve(offer.id)
    await notificationAbout(supplier.token, name)
  })

  it(caseName('mkt.offer.side.27', 'администратор отклонил с причиной — поставщику уведомление с причиной'), async () => {
    const name = `Уведомление об отказе ${tag}`
    const reason = `Нет фото упаковки ${tag}`
    const offer = await createOffer(supplier.token, offerInput(name, categoryId))
    await gql(await tokenOf(CHAIRMAN), REJECT_OFFER, { i: { offer_id: offer.id, reason } })
    await notificationAbout(supplier.token, reason)
  })
})

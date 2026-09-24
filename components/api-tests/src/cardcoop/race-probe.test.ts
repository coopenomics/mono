// ВРЕМЕННЫЙ зонд первого прогона: состояние стенда и гонка удаления карты с доставкой. Не для слияния.
import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { freshMember, login } from '../core'
import { DELIVERY_EXHAUSTED_MS, linkCreated, myCard, newKey, publishWebhookKeys, sendSigned, sleep, subjectOf, waitCard, waitParticipantVisible, webhookPermissionKeys } from './cardcoop-card.helpers'

describe('зонд cardcoop', () => {
  it('гонка: card.deleted во время доставки', async () => {
    const who = freshMember({ prefix: 'ccz' })
    const token = await login(who)
    await waitParticipantVisible(who, token)
    console.log('PROBE ano@cardcoop keys before:', JSON.stringify(await webhookPermissionKeys()))
    const key = await newKey()
    await publishWebhookKeys([key.pub])
    const card = crypto.randomUUID()
    await sendSigned(linkCreated(subjectOf(token), card, '1111'), key)
    await waitCard(token, c => c.issued, 'issued')
    const del = await sendSigned({ event: 'card.deleted', card_id: card, coopname: 'x', event_id: crypto.randomUUID() }, key)
    console.log('PROBE delete resp', JSON.stringify(del))
    await sleep(2000)
    console.log('PROBE after delete 2s', JSON.stringify(await myCard(token)))
    await sleep(DELIVERY_EXHAUSTED_MS)
    console.log('PROBE after delivery exhausted', JSON.stringify(await myCard(token)))
    expect(true).toBe(true)
  })
})

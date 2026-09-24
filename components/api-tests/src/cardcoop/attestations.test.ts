/**
 * Выпуск подтверждений членства (cardcoop.attestations) — снаружи.
 *
 * Приёмник уведомлений сети карт — REST-ручка расширения. Тест играет сеть:
 * публикует её ключ в цепи (`ano@cardcoop`) и подписывает уведомления. Итог
 * выпуска читается тем, что видит пайщик, — `cardcoopMyCard`.
 *
 * Содержимое, подпись и доставка самого свидетельства видны только принимающей
 * стороне; сети на стенде нет, и эти случаи здесь не изображаются.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { caseName, freshMember, login } from '../core'
import {
  DELIVERY_EXHAUSTED_MS,
  chainMemberSince,
  isolateFromNetwork,
  linkCreated,
  myCard,
  newKey,
  postWebhook,
  publishWebhookKeys,
  randomCardNumber,
  sendSigned,
  signNotification,
  sleep,
  subjectOf,
  unpublishWebhookKey,
  waitCard,
  waitParticipantVisible,
} from './cardcoop-card.helpers'
import type { NetworkKey } from './cardcoop-card.helpers'

let holder: Who
let holderToken: string
let second: Who
let secondToken: string
let key: NetworkKey
let holderCard: string
let holderLinkedAt = 0

describe('карта кооператора: подтверждения членства по уведомлениям сети', () => {
  beforeAll(async () => {
    holder = freshMember({ prefix: 'cca' })
    second = freshMember({ prefix: 'ccb' })
    holderToken = await login(holder)
    secondToken = await login(second)
    await isolateFromNetwork(holderToken)
    await waitParticipantVisible(holder, holderToken)
    await waitParticipantVisible(second, secondToken)
  })

  it(caseName('cc.att.break.05', 'ключ уведомлений сети не опубликован в цепи или держит не один ключ — приём закрыт с причиной'), async () => {
    const stray = await newKey()
    const doc = linkCreated(subjectOf(holderToken), crypto.randomUUID())

    await unpublishWebhookKey()
    const none = await sendSigned(doc, stray)
    expect(none.status).toBe(503)
    expect(none.body.code).toBe('CARDCOOP_NETWORK_KEY_NOT_PUBLISHED')

    const other = await newKey()
    await publishWebhookKeys([stray.pub, other.pub])
    const two = await sendSigned(doc, stray)
    expect(two.status).toBe(503)
    expect(two.body.code).toBe('CARDCOOP_NETWORK_KEY_NOT_PUBLISHED')

    expect((await myCard(holderToken)).issued).toBe(false)
  })

  it(caseName('cc.att.break.03', 'без подписи, с чужой подписью и с подменённым телом — отказ, подтверждения нет'), async () => {
    key = await newKey()
    await publishWebhookKeys([key.pub])
    const doc = linkCreated(subjectOf(holderToken), crypto.randomUUID(), randomCardNumber())

    const unsigned = await postWebhook(doc, null)
    expect(unsigned.status).toBe(403)
    expect(unsigned.body.code).toBe('CARDCOOP_NOTIFICATION_UNSIGNED')

    const stranger = await newKey()
    const foreign = await sendSigned(doc, stranger)
    expect(foreign.status).toBe(403)
    expect(foreign.body.code).toBe('CARDCOOP_NOTIFICATION_SIGNATURE_MISMATCH')

    const signature = signNotification(doc, key.wif)
    const tampered = await postWebhook({ ...doc, card_id: crypto.randomUUID() }, signature)
    expect(tampered.status).toBe(403)
    expect(tampered.body.code).toBe('CARDCOOP_NOTIFICATION_SIGNATURE_MISMATCH')

    expect(await myCard(holderToken)).toMatchObject({ issued: false, cardNumber: null, state: null, memberSince: null })
  })

  it(caseName('cc.att.break.04', 'уведомление адресовано другому кооперативу — отказ'), async () => {
    const doc = linkCreated(subjectOf(holderToken), crypto.randomUUID(), randomCardNumber(), 'othercoop')
    const r = await sendSigned(doc, key)
    expect(r.status).toBe(403)
    expect(r.body.code).toBe('CARDCOOP_NOTIFICATION_FOREIGN_COOP')
    expect((await myCard(holderToken)).issued).toBe(false)
  })

  it(caseName('cc.att.happy.05', 'подписанное уведомление о связи — подтверждение выпущено с датой приёма из реестра пайщиков цепи'), async () => {
    holderCard = crypto.randomUUID()
    const number = randomCardNumber()
    const r = await sendSigned(linkCreated(subjectOf(holderToken), holderCard, number), key)
    holderLinkedAt = Date.now()
    expect(r.status).toBeLessThan(300)
    expect(r.body).toEqual({ accepted: true })

    const expected = await chainMemberSince(holder.account)
    expect(expected).not.toBeNull()
    // Выпуск идёт своим ходом после ответа сети — ждём запись журнала.
    const card = await waitCard(holderToken, c => c.issued, 'запись о выпуске подтверждения')
    expect(card).toMatchObject({ issued: true, cardNumber: number, memberSince: expected })
    // Сеть на стенде недоступна: подтверждение ждёт доставки, а не отвергнуто.
    expect(card.state).toBe('Pending')
  })

  it(caseName('cc.att.happy.06', 'сеть ротировала ключ уведомлений — первое уведомление новым ключом проходит'), async () => {
    const rotated = await newKey()
    await publishWebhookKeys([rotated.pub])

    const card = crypto.randomUUID()
    const r = await sendSigned(linkCreated(subjectOf(secondToken), card, randomCardNumber()), rotated)
    expect(r.status).toBeLessThan(300)
    expect(r.body).toEqual({ accepted: true })
    await waitCard(secondToken, c => c.issued, 'подтверждение по уведомлению, подписанному новым ключом')

    // Прежний ключ снят в цепи — подписанное им больше не принимается.
    const stale = await sendSigned(linkCreated(subjectOf(secondToken), card), key)
    expect(stale.status).toBe(403)
    expect(stale.body.code).toBe('CARDCOOP_NOTIFICATION_SIGNATURE_MISMATCH')
    key = rotated
  })

  it(caseName('cc.att.side.04', 'удаление карты и погашение согласия маршрутизируются без проверки принадлежности'), async () => {
    // Фоновая доставка свидетельства в недоступную сеть ещё может идти; удаление
    // до её конца проверяло бы гонку, а не маршрутизацию.
    const left = holderLinkedAt + DELIVERY_EXHAUSTED_MS - Date.now()
    if (left > 0)
      // timing: backoff — дождаться, пока доставка свидетельства исчерпает попытки
      await sleep(left)

    // Без карты — ничего не стирается.
    const empty = await sendSigned({ event: 'card.deleted', coopname: 'othercoop', event_id: crypto.randomUUID() }, key)
    expect(empty.status).toBeLessThan(300)
    expect(empty.body).toEqual({ accepted: true })
    expect((await myCard(holderToken)).issued).toBe(true)
    expect((await myCard(secondToken)).issued).toBe(true)

    // Погашение чужого согласия — принято, чужого кооператива не касается.
    const expired = await sendSigned({ event: 'disclosure.expired', coopname: 'othercoop', disclosure_id: crypto.randomUUID(), event_id: crypto.randomUUID() }, key)
    expect(expired.status).toBeLessThan(300)
    expect(expired.body).toEqual({ accepted: true })

    // Удаление адресовано всем, кто был с картой связан: кооператив в теле чужой.
    const deleted = await sendSigned({ event: 'card.deleted', card_id: holderCard, coopname: 'othercoop', event_id: crypto.randomUUID() }, key)
    expect(deleted.status).toBeLessThan(300)
    expect(deleted.body).toEqual({ accepted: true })
    const gone = await waitCard(holderToken, c => !c.issued, 'карта удалена держателем')
    expect(gone).toMatchObject({ issued: false, cardNumber: null, state: null, memberSince: null })
    // Чужая карта не задета.
    expect((await myCard(secondToken)).issued).toBe(true)
  })
})

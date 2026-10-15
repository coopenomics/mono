/**
 * Карта кооператора в столе пайщика (cardcoop.card-page) — снаружи.
 *
 * Стол спрашивает `cardcoopMyCard`, и ответ собирается из собственного журнала
 * расширения, без похода в сеть. Журнал наполняют уведомления сети о связи —
 * тест шлёт их сам, подписав ключом, опубликованным в цепи (см. помощники).
 * Подтверждённое сетью членство (`Active`) на стенде недостижимо: его ставит
 * только ответ card.coop на доставку свидетельства.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COOP, caseName, freshMember, gqlError, login } from '../core'
import {
  MY_CARD,
  UNREACHABLE_NETWORK,
  chainMemberSince,
  isolateFromNetwork,
  linkCreated,
  myCard,
  newKey,
  publishWebhookKeys,
  randomCardNumber,
  sendSigned,
  subjectOf,
  waitCard,
  waitParticipantVisible,
} from './cardcoop-card.helpers'
import type { NetworkKey } from './cardcoop-card.helpers'

let member: Who
let token: string
let key: NetworkKey
let cardId: string

describe('карта кооператора: страница карты в столе пайщика', () => {
  beforeAll(async () => {
    member = freshMember({ prefix: 'ccp' })
    token = await login(member)
    await isolateFromNetwork(token)
    await waitParticipantVisible(member, token)
    key = await newKey()
    await publishWebhookKeys([key.pub])
  })

  it(caseName('cc.card.happy.02', 'карты нет — стол зовёт выпустить, адрес выпуска собран из настроек и имени кооператива'), async () => {
    const card = await myCard(token)
    expect(card).toEqual({
      issued: false,
      cardNumber: null,
      state: null,
      memberSince: null,
      // В настройках адрес с косой чертой в конце — в адресе выпуска двойной черты нет.
      enterUrl: `${UNREACHABLE_NETWORK.replace(/\/+$/, '')}/enter/${COOP}`,
    })

    // Карта — всегда о себе: гость её не спрашивает.
    expect(await gqlError(null, MY_CARD)).not.toBeNull()
  })

  it(caseName('cc.card.side.03', 'запись без номера карты — номера нет, состояние и дата вступления на месте'), async () => {
    cardId = crypto.randomUUID()
    const r = await sendSigned(linkCreated(subjectOf(token), cardId), key)
    expect(r.status).toBeLessThan(300)

    const card = await waitCard(token, c => c.issued, 'запись журнала по уведомлению без номера')
    expect(card.cardNumber).toBeNull()
    expect(card.state).toBe('Pending')
    expect(card.memberSince).toBe(await chainMemberSince(member.account))
  })

  it(caseName('cc.card.side.01', 'свидетельство ещё не доехало до сети — карта всё равно показана выпущенной'), async () => {
    const card = await myCard(token)
    expect(card.issued).toBe(true)
    expect(card.state).toBe('Pending')
    expect(card.enterUrl).toBe(`${UNREACHABLE_NETWORK.replace(/\/+$/, '')}/enter/${COOP}`)
  })

  it(caseName('cc.card.side.04', 'номер карты приехал повторным уведомлением о той же связи — сохранён в журнале'), async () => {
    const number = randomCardNumber()
    const r = await sendSigned(linkCreated(subjectOf(token), cardId, number), key)
    expect(r.status).toBeLessThan(300)

    const card = await waitCard(token, c => c.cardNumber === number, 'номер карты дописан к записи')
    expect(card).toMatchObject({ issued: true, cardNumber: number, state: 'Pending' })
    expect(card.memberSince).toBe(await chainMemberSince(member.account))
  })
})

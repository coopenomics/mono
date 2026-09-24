/**
 * Журнал свидетельств членства снаружи (test-registry/cardcoop.membership.yaml).
 *
 * Сети карт на стенде нет: её сторону играет тест — подписывает уведомления
 * ключом, опубликованным в цепи в `ano@cardcoop`, а адрес сети переводит на
 * закрытый порт («сеть недоступна») или на узел цепи стенда, который отвечает
 * на незнакомый путь 404 («сеть отказала по существу»). Всё проверяется через
 * `cardcoopMyCard` и `getAccount`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { caseName, freshMember, gql, login, waitFor } from '../core'
import {
  type MyCard,
  type NetworkSwitch,
  REFUSING_NETWORK_URL,
  UNREACHABLE_NETWORK_URL,
  cardDeleted,
  linkCreated,
  myCard,
  newCard,
  publishNetworkKey,
  sendAsNetwork,
  switchNetwork,
  tokenSubject,
} from './cardcoop-entry.helpers'

const PARTICIPANT = `query($d: GetAccountInput!){ getAccount(data: $d){ username participant_account{ username } } }`

/** Пайщик связал карту: уведомление сети принято, запись видна в столе. */
async function memberWithLinkedCard(prefix: string): Promise<{ token: string, username: string, card: { cardId: string, cardNumber: string }, shown: MyCard }> {
  const member = freshMember({ prefix })
  const token = await login(member)
  const card = newCard()

  const res = await sendAsNetwork(linkCreated(card, tokenSubject(token)))
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  expect(res.body?.accepted).toBe(true)

  // Уведомление принимается сразу, свидетельство выпускается своим ходом.
  const shown = await waitFor(async () => {
    const c = await myCard(token)
    return c.issued && c.state !== null ? c : null
  }, { label: `карта пайщика ${member.account} появилась в столе` })
  return { token, username: member.account, card, shown }
}

describe('cardcoop.membership: журнал свидетельств без сети', () => {
  let network: NetworkSwitch

  beforeAll(async () => {
    network = await switchNetwork(UNREACHABLE_NETWORK_URL)
    await publishNetworkKey()
  })

  afterAll(async () => {
    await network?.restore()
  })

  it(caseName('cc.mbr.side.05', 'держатель удалил карту: записи о ней стёрты, членство в кооперативе не тронуто'), async () => {
    const { token, username, card, shown } = await memberWithLinkedCard('ccmd')
    expect(shown.cardNumber).toBe(card.cardNumber)
    expect(shown.memberSince).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const res = await sendAsNetwork(cardDeleted(card.cardId))
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
    expect(res.body?.accepted).toBe(true)

    const gone = await waitFor(async () => {
      const c = await myCard(token)
      return c.issued ? null : c
    }, { label: 'карта-призрак исчезла из стола' })
    expect(gone.state).toBeNull()
    expect(gone.cardNumber).toBeNull()
    expect(gone.memberSince).toBeNull()

    // Человек остаётся пайщиком, просто без карты.
    const acc = await gql<any>(token, PARTICIPANT, { d: { username } })
    expect(acc.getAccount.participant_account?.username).toBe(username)
  })

  it(caseName('cc.mbr.side.03', 'недоставка остаётся ожиданием, а отказ сети по существу — отдельным состоянием'), async () => {
    // Сеть недоступна: свидетельство ждёт повтора.
    const unreachable = await memberWithLinkedCard('ccmu')
    expect(unreachable.shown.state).toBe('Pending')
    expect(unreachable.shown.memberSince).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // Сеть ответила 4xx: отказ по существу, а не ожидание.
    await network.set(REFUSING_NETWORK_URL)
    const refused = await memberWithLinkedCard('ccmr')
    const rejected = await waitFor(async () => {
      const c = await myCard(refused.token)
      return c.state === 'Rejected' ? c : null
    }, { label: 'отказ сети записан как Rejected' })
    expect(rejected.issued).toBe(true)
    expect(rejected.cardNumber).toBe(refused.card.cardNumber)

    // Первое свидетельство при этом так и ждёт: отказ другому его не трогает.
    expect((await myCard(unreachable.token)).state).toBe('Pending')
  })
})

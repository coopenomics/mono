/**
 * Связь карты при вступлении и выпуск свидетельства по приёму снаружи
 * (test-registry/cardcoop.join.yaml).
 *
 * Сеть карт на стенде отсутствует, поэтому адрес сети переводится на закрытый
 * порт: доставка свидетельства заведомо не удаётся, и видно, что связь и
 * свидетельство при этом не теряются. Уведомление о связи тест подписывает
 * ключом, опубликованным в цепи в `ano@cardcoop` (см. cardcoop-entry.helpers.ts).
 * Проверяется всё через `cardcoopMyCard` — журнал кооператива глазами пайщика.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { caseName, freshMember, login, waitFor } from '../core'
import {
  type Candidate,
  type MyCard,
  type NetworkSwitch,
  UNREACHABLE_NETWORK_URL,
  admitByChain,
  linkCreated,
  myCard,
  newCard,
  publishNetworkKey,
  registerCandidate,
  sendAsNetwork,
  switchNetwork,
} from './cardcoop-entry.helpers'

/** Вчерашний день UTC и поздний час приёма — ошибка зоны сдвинула бы дату. */
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const ADMITTED_AT = `${yesterday}T23:30:00`

describe('cardcoop.join: карта кандидата ждёт решения о приёме', () => {
  let network: NetworkSwitch
  let candidate: Candidate
  const card = newCard()
  let admitted: MyCard

  beforeAll(async () => {
    network = await switchNetwork(UNREACHABLE_NETWORK_URL)
    await publishNetworkKey()
  })

  afterAll(async () => {
    await network?.restore()
  })

  it(caseName('cc.join.happy.01', 'кандидат связал карту до приёма: связь запомнена, свидетельства нет'), async () => {
    candidate = await registerCandidate()

    const res = await sendAsNetwork(linkCreated(card, candidate.subject))
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
    expect(res.body?.accepted).toBe(true)

    // Уведомление принимается сразу, связь записывается своим ходом.
    const shown = await waitFor(async () => {
      const c = await myCard(candidate.token)
      return c.issued ? c : null
    }, { label: 'карта кандидата появилась в столе' })

    expect(shown.cardNumber).toBe(card.cardNumber)
    // Совет ещё не решал: даты приёма нет, свидетельство не выпущено.
    expect(shown.memberSince).toBeNull()
    expect(shown.state).toBe('Pending')
  })

  it(caseName('cc.join.happy.02', 'цепь записала приём: по ожидавшей связи выпущено свидетельство с датой приёма'), async () => {
    await admitByChain(candidate.username, ADMITTED_AT)

    // Приём записан в цепь мимо контроллера — ждём, пока событие дойдёт до расширения.
    admitted = await waitFor(async () => {
      const c = await myCard(candidate.token)
      return c.memberSince ? c : null
    }, { timeoutMs: 120_000, label: 'свидетельство по приёму кандидата' })

    expect(admitted.issued).toBe(true)
    expect(admitted.cardNumber).toBe(card.cardNumber)
    expect(admitted.memberSince).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it(caseName('cc.join.side.03', 'момент приёма без зоны читается как UTC: дата в свидетельстве не сдвинута'), async () => {
    expect(admitted, 'нужен приём из cc.join.happy.02').toBeDefined()
    expect(admitted.memberSince).toBe(yesterday)
  })

  it(caseName('cc.join.break.01', 'сеть недоступна при приёме: событие не роняется, связь не теряется и ждёт доставки'), async () => {
    expect(admitted, 'нужен приём из cc.join.happy.02').toBeDefined()
    // Доставка ушла на закрытый порт: свидетельство осталось в ожидании
    // повтора, а не пропало вместе со связью и не выдано за принятое сетью.
    const now = await myCard(candidate.token)
    expect(now.issued).toBe(true)
    expect(now.state).toBe('Pending')
    expect(now.cardNumber).toBe(card.cardNumber)
    expect(now.memberSince).toBe(yesterday)
  })

  it(caseName('cc.join.side.01', 'принят пайщик, который карту не связывал: ничего не появляется'), async () => {
    // freshMember принимается той же записью цепи (adduser → addpartcpnt).
    const member = freshMember({ prefix: 'ccjn' })
    const token = await login(member)
    const c = await myCard(token)
    expect(c.issued).toBe(false)
    expect(c.state).toBeNull()
    expect(c.cardNumber).toBeNull()
    expect(c.memberSince).toBeNull()
  })
})

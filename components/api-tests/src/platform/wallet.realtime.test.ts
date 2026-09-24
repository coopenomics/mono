/**
 * Кошелёк пайщика — событийное обновление остатка (test-registry/wallet.realtime.yaml).
 *
 * Подписка `walletEvents` отдаёт пайщику сигнал «кошелёк изменился» с адресом
 * изменения и без сумм; остаток клиент дочитывает запросом. Топик выводится из
 * токена соединения, аргумент `coopname` только сверяется с кооперативом узла.
 * Изменение готовится паевым взносом прямо в цепи — так, как его проводит
 * платёжный шлюз.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COOP, ROLES, caseName, freshMember, login, tokenOf } from '../core'
import type { WsConn, WsSub } from './platform-a.helpers'
import {
  WS_FORBIDDEN,
  chainDeposit,
  mirroredAvailable,
  quietWindow,
  settleSubscriptions,
  typeFields,
  wsAs,
  wsRejectionCode,
} from './platform-a.helpers'

const WALLET_EVENTS = `subscription($i: WalletEventsInput!){
  walletEvents(input: $i){ coopname username wallet_name }
}`

describe('wallet.realtime: сигнал об изменении кошелька пайщика', () => {
  let member: Who
  let memberToken: string
  let own: WsSub
  let other: WsSub
  let event: { coopname: string, username: string, wallet_name: string }
  let availableAfter = 0
  const conns: WsConn[] = []

  async function open(token: string): Promise<WsConn> {
    const c = await wsAs(token)
    conns.push(c)
    return c
  }

  beforeAll(async () => {
    member = freshMember({ prefix: 'wrt' })
    memberToken = await login(member)
    own = (await open(memberToken)).subscribe(WALLET_EVENTS, { i: { coopname: COOP } })
    // Второй пайщик подписан так же — топик у него свой, из его токена.
    other = (await open(await tokenOf(ROLES.otherMember()))).subscribe(WALLET_EVENTS, { i: { coopname: COOP } })
    const before = await mirroredAvailable(memberToken, member.account)
    await settleSubscriptions()

    await chainDeposit(member.account, 300)

    event = (await own.waitFor(e => e.walletEvents?.wallet_name === 'w.wal.share' ? e.walletEvents : null, 60_000, 'сигнала паевого кошелька')) as any
    availableAfter = await mirroredAvailable(memberToken, member.account)
    expect(availableAfter).toBeCloseTo(before + 300, 4)
    await quietWindow()
  })

  afterAll(() => {
    for (const c of conns) c.close()
  })

  it(caseName('wallet.realtime.happy.02', 'подписка пайщика открывается на его персональный топик'), async () => {
    expect(own.errors).toBeNull()
    expect(own.events.length).toBeGreaterThan(0)
    expect(own.events.every(e => e.walletEvents.username === member.account)).toBe(true)
  })

  it(caseName('wallet.realtime.happy.01', 'дельта кошелька своего кооператива: сигнал в топик пайщика с адресом изменения'), async () => {
    expect(event).toEqual({ coopname: COOP, username: member.account, wallet_name: 'w.wal.share' })
  })

  it(caseName('wallet.realtime.side.01', 'в сигнале нет сумм — только адресные поля'), async () => {
    expect(await typeFields(memberToken, 'WalletChangedEvent')).toEqual(['coopname', 'username', 'wallet_name'])
    expect(Object.keys(event).sort()).toEqual(['coopname', 'username', 'wallet_name'])
  })

  it(caseName('wallet.realtime.break.01', 'чужой кооператив в аргументе и соединение без пайщика — отказ; чужой топик не выбрать'), async () => {
    const foreign = await (await open(memberToken)).subscribe(WALLET_EVENTS, { i: { coopname: 'othercoop' } }).failure()
    expect(foreign.code).toBe('WALLET_SUBSCRIPTION_OWN_COOPERATIVE_ONLY')

    expect(await wsRejectionCode(null)).toBe(WS_FORBIDDEN)

    // Второй пайщик подписан с тем же аргументом, но сигнала о чужом кошельке
    // не получил: топик берётся из токена соединения.
    expect(other.events.filter(e => e.walletEvents?.username === member.account)).toEqual([])
  })
})

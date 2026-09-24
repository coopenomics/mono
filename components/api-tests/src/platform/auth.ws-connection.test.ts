/**
 * Опознание пайщика в ws-соединении подписок (test-registry/auth.ws-connection.yaml).
 *
 * Соединение graphql-ws опознаётся однократно, тем же путём, что HTTP-запрос:
 * подписанный access-токен живой сессии. Снаружи это видно двумя способами:
 * отказ — закрытие сокета с кодом 4403 до подтверждения; допуск — подписка,
 * которая читает пайщика из контекста (`walletEvents` берёт топик из его имени,
 * `chainChanges` выбирает каналы по его роли), получает именно его сигналы.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COOP, COUNCIL, caseName, freshMember, gqlError, tokenOf } from '../core'
import type { Session, WsConn } from './platform-a.helpers'
import {
  WS_FORBIDDEN,
  chainChangesOf,
  chainDeposit,
  loginSession,
  logout,
  resignJwt,
  settleSubscriptions,
  waitSignal,
  wsConnect,
  wsRejectionCode,
} from './platform-a.helpers'

const WALLET_EVENTS = `subscription($i: WalletEventsInput!){
  walletEvents(input: $i){ coopname username wallet_name }
}`

const OWN_WALLETS = 'query($u:String!){ getUserWallets(username:$u){ wallet_name } }'

describe('auth.ws-connection: пайщик в ws-соединении — тот же, что в HTTP-запросе', () => {
  let member: Who
  let session: Session
  const conns: WsConn[] = []

  async function open(authorization: string | null): Promise<WsConn> {
    const c = await wsConnect(authorization)
    conns.push(c)
    return c
  }

  beforeAll(async () => {
    member = freshMember({ prefix: 'wsau' })
    session = await loginSession(member)
  })

  afterAll(() => {
    for (const c of conns) c.close()
  })

  it(caseName('auth.ws.happy.01', 'годный access-токен живой сессии: в контексте подписки его учётная запись — имя и роль'), async () => {
    const own = (await open(`Bearer ${session.access}`)).subscribe(WALLET_EVENTS, { i: { coopname: COOP } })
    // Член совета: каналы ленты выбираются по роли из контекста — ему идут
    // все строки личной таблицы, в том числе чужого кошелька.
    const staff = chainChangesOf(await open(`Bearer ${await tokenOf(COUNCIL)}`), [{ code: 'ledger2', table: 'userwallets' }])
    await settleSubscriptions()

    const dep = await chainDeposit(member.account, 100)

    const ev = await own.waitFor(e => e.walletEvents?.username === member.account ? e.walletEvents : null, 60_000, 'сигнала своего кошелька')
    expect(ev).toEqual({ coopname: COOP, username: member.account, wallet_name: expect.any(String) })
    const sig = await waitSignal(staff, { code: 'ledger2', table: 'userwallets', block_num: dep.completeBlock })
    expect(sig.scope).toBe(COOP)
  })

  it(caseName('auth.ws.side.01', 'токен без префикса Bearer принимается так же'), async () => {
    const bare = await open(session.access)
    const own = bare.subscribe(WALLET_EVENTS, { i: { coopname: COOP } })
    await settleSubscriptions()

    await chainDeposit(member.account, 100)

    const ev = await own.waitFor(e => e.walletEvents?.username === member.account ? e.walletEvents : null, 60_000, 'сигнала своего кошелька')
    expect(ev.coopname).toBe(COOP)
  })

  it(caseName('auth.ws.break.01', 'сессия завершена выходом — тот же токен соединения больше не открывает'), async () => {
    const other = await loginSession(member)
    // До выхода токен этой сессии соединение открывает.
    expect(await wsRejectionCode(`Bearer ${other.access}`)).toBeNull()

    await logout(other)

    expect(await wsRejectionCode(`Bearer ${other.access}`)).toBe(WS_FORBIDDEN)
    // HTTP с этим токеном тоже закрыт — путь опознания один.
    expect(await gqlError(other.access, OWN_WALLETS, { u: member.account })).not.toBeNull()
    // Выход завершает свою сессию, а не все: соседняя открывает по-прежнему.
    expect(await wsRejectionCode(`Bearer ${session.access}`)).toBeNull()
  })

  it(caseName('auth.ws.break.02', 'в соединение подан refresh-токен — отказ'), async () => {
    const s = await loginSession(member)
    expect(await wsRejectionCode(`Bearer ${s.refresh}`)).toBe(WS_FORBIDDEN)
    expect(await wsRejectionCode(s.refresh)).toBe(WS_FORBIDDEN)
    // Access-токен той же сессии при этом годен.
    expect(await wsRejectionCode(`Bearer ${s.access}`)).toBeNull()
  })

  it(caseName('auth.ws.break.03', 'токен подписан чужим секретом, пустой или его нет — отказ'), async () => {
    expect(await wsRejectionCode(`Bearer ${resignJwt(session.access)}`)).toBe(WS_FORBIDDEN)
    expect(await wsRejectionCode(null)).toBe(WS_FORBIDDEN)
    expect(await wsRejectionCode('')).toBe(WS_FORBIDDEN)
    expect(await wsRejectionCode('Bearer not-a-jwt')).toBe(WS_FORBIDDEN)
  })
})

/**
 * Индикация синхронизации узла с цепью (test-registry/system.node-sync-indication.yaml).
 *
 * Снаружи видно рабочее состояние стенда: узел у головы цепи. Запрос
 * `getNodeSyncState` открыт без входа — пайщик обязан видеть причину
 * недоступности кабинета до входа; подписка `nodeSyncState` шлёт состояние,
 * пока узел читает цепь. Догон, гистерезис и обрыв связи требуют остановить
 * чтение цепи — это случаи юнит-уровня.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { CHAIN_URL, ROLES, caseName, gql, tokenOf } from '../core'
import type { WsConn } from './platform-a.helpers'
import { wsAs } from './platform-a.helpers'

const STATE_FIELDS = 'status outage current_block_num head_block_num lag_blocks cursor_updated_at'

/** Порог входа в догон по умолчанию (BLOCKCHAIN_SYNC_LAGGING_LAG_BLOCKS). */
const LAGGING_LAG_BLOCKS = 40

async function chainHead(): Promise<number> {
  const info: any = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
  return Number(info.head_block_num)
}

describe('system.node-sync-indication: узел у головы цепи', () => {
  const conns: WsConn[] = []

  afterAll(() => {
    for (const c of conns) c.close()
  })

  it(caseName('sync.ind.happy.01', 'позиция чтения у головы цепи: узел рабочий, отставание в пределах порога, состояние уходит подписчикам'), async () => {
    // Запрос — без входа.
    const d = await gql<any>(null, `query{ getNodeSyncState{ ${STATE_FIELDS} } }`)
    const state = d.getNodeSyncState
    const head = await chainHead()
    expect(state).not.toBeNull()
    expect(state.status).toBe('SYNCED')
    expect(state.outage).toBeNull()
    expect(state.lag_blocks).toBeGreaterThanOrEqual(0)
    expect(state.lag_blocks).toBeLessThan(LAGGING_LAG_BLOCKS)
    expect(state.current_block_num).toBeLessThanOrEqual(state.head_block_num)
    // Голова в состоянии — та же цепь: состояние пересчитывается раз в тик
    // (секунды), а не хранится с прошлого запуска.
    expect(head - state.head_block_num).toBeGreaterThanOrEqual(0)
    expect(head - state.head_block_num).toBeLessThan(LAGGING_LAG_BLOCKS)

    // Подписка: пока узел читает цепь, прочитанный блок растёт — и каждое
    // такое продвижение уходит подписчику.
    const conn = await wsAs(await tokenOf(ROLES.member()))
    conns.push(conn)
    const sub = conn.subscribe(`subscription{ nodeSyncState{ ${STATE_FIELDS} } }`)
    const first = await sub.waitFor(e => e.nodeSyncState, 30_000, 'первого состояния узла')
    expect(first.status).toBe('SYNCED')
    const next = await sub.waitFor(e => (e.nodeSyncState.current_block_num > first.current_block_num ? e.nodeSyncState : null), 30_000, 'продвижения узла по цепи')
    expect(next.status).toBe('SYNCED')
    expect(next.lag_blocks).toBeLessThan(LAGGING_LAG_BLOCKS)
  })
})

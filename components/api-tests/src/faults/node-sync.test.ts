/**
 * Индикация синхронизации узла при остановке чтения цепи
 * (test-registry/system.node-sync-indication.yaml).
 *
 * Набор замораживает сервис, который читает цепь, и ведёт запись того, что
 * узел сообщает о себе снаружи: запросом `getNodeSyncState` раз в полсекунды и
 * подпиской `nodeSyncState`. Сценарий один и идёт около двух минут:
 *
 *   пауза чтения → отставание растёт → узел догоняющий → позиция чтения
 *   неподвижна дольше окна → связи нет → чтение возобновлено → выход из
 *   догона → повторная пауза посреди выхода → снова выход → узел рабочий.
 *
 * Пороги — значения по умолчанию (BLOCKCHAIN_SYNC_*): тик 3 с, вход в догон
 * с 40 блоков, выход при 10 и меньше три тика подряд, окно неподвижной
 * позиции 60 с.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIN_READER, FAULTS_ENABLED, ROLES, awaitNodeSynced, caseName, gql, pauseService, resumeService, tokenOf, waitFor } from '../core'
import type { WsConn, WsSub } from '../platform/platform-a.helpers'
import { wsAs } from '../platform/platform-a.helpers'

const STATE_FIELDS = 'status outage current_block_num head_block_num lag_blocks cursor_updated_at catch_up_blocks_per_second estimated_seconds_remaining'

const LAGGING_LAG_BLOCKS = 40
const HEALTHY_LAG_BLOCKS = 10
const HEALTHY_TICKS = 3
const STALE_CURSOR_MS = 60_000
/** Изменение остатка, с которого состояние публикуется повторно при том же статусе. */
const NOTABLE_LAG_CHANGE_BLOCKS = 10

type Phase = 'baseline' | 'paused' | 'resumed' | 'paused-again' | 'resumed-again'

interface Seen {
  at: number
  phase: Phase
  status: 'SYNCED' | 'LAGGING' | 'DISCONNECTED'
  outage: string | null
  current_block_num: number | null
  head_block_num: number | null
  lag_blocks: number | null
  cursor_updated_at: string | null
  catch_up_blocks_per_second: number | null
  estimated_seconds_remaining: number | null
}

const timeline: Seen[] = []
let phase: Phase = 'baseline'
const startedAt: Partial<Record<Phase, number>> = {}

/** Номер первого наблюдения последней повторной паузы. */
let relapseFrom = 0

function enter(next: Phase): void {
  phase = next
  startedAt[next] ??= Date.now()
}

/** Опрос состояния до тех пор, пока очередное наблюдение не подойдёт. */
async function until(pick: (s: Seen) => boolean, timeoutMs: number, label: string): Promise<Seen> {
  return waitFor(async () => {
    const d = await gql<any>(null, `query{ getNodeSyncState{ ${STATE_FIELDS} } }`)
    const seen: Seen = { at: Date.now(), phase, ...d.getNodeSyncState }
    timeline.push(seen)
    return pick(seen) ? seen : null
  }, { timeoutMs, intervalMs: 500, label })
}

const of = (p: Phase): Seen[] => timeline.filter(s => s.phase === p)

/**
 * Пересчёты состояния: опрос чаще тика, и одно посчитанное состояние видно
 * несколько раз. Новый пересчёт — новая голова цепи либо новый статус.
 */
function ticks(seen: Seen[]): Seen[] {
  return seen.filter((s, i) => i === 0 || s.head_block_num !== seen[i - 1].head_block_num || s.status !== seen[i - 1].status)
}

describe.skipIf(!FAULTS_ENABLED)('system.node-sync-indication: чтение цепи остановлено и возобновлено', () => {
  let conn: WsConn
  let sub: WsSub
  let lagging: Seen
  let disconnected: Seen
  let exiting: Seen
  let relapsed: Seen

  /** Сигналы подписки, пришедшие в фазе: время прихода и состояние. */
  function published(p: Phase, next?: Phase): { at: number, state: Seen }[] {
    const from = startedAt[p]!
    const to = next ? startedAt[next]! : Number.POSITIVE_INFINITY
    return sub.events
      .map((e, i) => ({ at: sub.times[i], state: e.nodeSyncState as Seen }))
      .filter(e => e.at >= from && e.at < to)
  }

  beforeAll(async () => {
    await until(s => s.status === 'SYNCED', 60_000, 'рабочего состояния узла перед паузой')
    conn = await wsAs(await tokenOf(ROLES.member()))
    sub = conn.subscribe(`subscription{ nodeSyncState{ ${STATE_FIELDS} } }`)
    await sub.waitFor(e => e.nodeSyncState, 30_000, 'первого состояния узла в подписке')

    await pauseService(CHAIN_READER)
    enter('paused')
    lagging = await until(s => s.status === 'LAGGING', 90_000, 'входа в догон при остановленном чтении')
    disconnected = await until(s => s.status === 'DISCONNECTED', 120_000, 'состояния «связи нет» при неподвижной позиции чтения')

    await resumeService(CHAIN_READER)
    enter('resumed')
    // Повторная пауза ставится на первом здоровом тике выхода. Если пауза
    // запоздала и узел успел выйти из догона, сценарий повторяется с нового
    // входа в догон.
    for (let attempt = 1; attempt <= 3; attempt++) {
      exiting = await until(s => s.status === 'LAGGING' && (s.lag_blocks ?? Infinity) <= HEALTHY_LAG_BLOCKS, 120_000, 'выхода догоняющего узла к голове цепи')
      await pauseService(CHAIN_READER)
      enter('paused-again')
      relapseFrom = timeline.length
      relapsed = await until(s => s.status !== 'LAGGING' || (s.lag_blocks ?? 0) > HEALTHY_LAG_BLOCKS, 60_000, 'нового роста отставания посреди выхода из догона')
      if (relapsed.status === 'LAGGING')
        break
      await until(s => s.status === 'LAGGING', 90_000, 'нового входа в догон')
      await resumeService(CHAIN_READER)
      enter('resumed')
    }

    await resumeService(CHAIN_READER)
    enter('resumed-again')
    await until(s => s.status === 'SYNCED', 120_000, 'возврата узла в рабочее состояние')
  }, 600_000)

  afterAll(async () => {
    conn?.close()
    await resumeService(CHAIN_READER)
    await awaitNodeSynced()
  })

  it(caseName('sync.ind.side.01', 'отставание достигло порога — узел объявлен догоняющим'), () => {
    expect(lagging.lag_blocks).toBeGreaterThanOrEqual(LAGGING_LAG_BLOCKS)
    expect(lagging.outage).toBeNull()
    // Позиция чтения стоит там, где её застала пауза, голова цепи ушла вперёд.
    expect(lagging.head_block_num! - lagging.current_block_num!).toBe(lagging.lag_blocks)
  })

  it(caseName('sync.ind.side.02', 'отставание между порогом выхода и порогом входа — узел остаётся рабочим'), () => {
    const between = of('paused').filter(s => (s.lag_blocks ?? 0) > HEALTHY_LAG_BLOCKS && (s.lag_blocks ?? 0) < LAGGING_LAG_BLOCKS)
    expect(between.length, 'отставание между порогами наблюдалось').toBeGreaterThan(0)
    expect(between.map(s => s.status)).toEqual(between.map(() => 'SYNCED'))
  })

  it(caseName('sync.ind.side.06', 'отставание растёт — оценки времени догона нет'), () => {
    const growing = of('paused').filter(s => s.status === 'LAGGING')
    expect(growing.length).toBeGreaterThan(0)
    for (const s of growing) {
      expect(s.catch_up_blocks_per_second ?? null, `отставание ${s.lag_blocks}`).toBeNull()
      expect(s.estimated_seconds_remaining ?? null, `отставание ${s.lag_blocks}`).toBeNull()
    }
  })

  it(caseName('sync.ind.break.03', 'позиция чтения неподвижна дольше окна — «связи нет», причина — чтение цепи'), () => {
    expect(disconnected.outage).toBe('READER')
    expect(disconnected.at - Date.parse(disconnected.cursor_updated_at!), 'позиция чтения стояла дольше окна').toBeGreaterThan(STALE_CURSOR_MS)
    // До истечения окна это был догон, а не обрыв: медленное чтение и
    // остановка различаются.
    const before = of('paused').filter(s => s.at < disconnected.at && s.at - startedAt.paused! < STALE_CURSOR_MS - 5_000)
    expect(before.some(s => s.status === 'DISCONNECTED')).toBe(false)
    expect(disconnected.lag_blocks).toBeGreaterThan(lagging.lag_blocks!)
    expect(disconnected.current_block_num).toBe(lagging.current_block_num)
  })

  it(caseName('sync.ind.break.04', 'после обрыва узел не объявляется рабочим сразу: счётчики начинаются заново'), () => {
    const afterOutage = ticks(of('resumed').filter(s => s.status !== 'DISCONNECTED'))
    expect(afterOutage.length).toBeGreaterThan(0)
    // Первый пересчёт после обрыва — догон без скорости: до паузы её не было
    // с чего считать, а прежняя сброшена.
    expect(afterOutage[0].status).toBe('LAGGING')
    expect(afterOutage[0].catch_up_blocks_per_second ?? null).toBeNull()
    expect(exiting.status).toBe('LAGGING')
  })

  it(caseName('sync.ind.side.04', 'посреди выхода отставание снова подскочило — здоровые тики считаются заново'), () => {
    expect(relapsed.status, 'узел не успел выйти из догона до нового роста отставания').toBe('LAGGING')
    expect(relapsed.lag_blocks).toBeGreaterThan(HEALTHY_LAG_BLOCKS)
    expect(timeline.slice(relapseFrom).some(s => s.phase === 'paused-again' && s.status === 'SYNCED')).toBe(false)
    // До повторной паузы узел уже набрал здоровые тики. Если бы счёт не
    // начался заново, после возобновления ему хватило бы одного-двух тиков.
    const healthy = ticks(of('resumed-again')).filter(s => s.status === 'LAGGING' && (s.lag_blocks ?? Infinity) <= HEALTHY_LAG_BLOCKS)
    expect(healthy.length, 'у головы цепи узел ждёт положенные тики с нуля').toBeGreaterThanOrEqual(HEALTHY_TICKS - 1)
  })

  it(caseName('sync.ind.side.03', 'узел у головы цепи меньше положенных тиков — заглушка держится'), () => {
    const exit = ticks(of('resumed-again'))
    const firstSynced = exit.findIndex(s => s.status === 'SYNCED')
    expect(firstSynced).toBeGreaterThan(0)
    const held = exit.slice(0, firstSynced).filter(s => (s.lag_blocks ?? Infinity) <= HEALTHY_LAG_BLOCKS)
    expect(held.length).toBeGreaterThanOrEqual(HEALTHY_TICKS - 1)
    expect(held.map(s => s.status)).toEqual(held.map(() => 'LAGGING'))
  })

  it(caseName('sync.ind.side.05', 'узел догоняет — скорость и оценка считаются по сокращению отставания'), () => {
    const catching = [...of('resumed'), ...of('resumed-again')].filter(s => s.status === 'LAGGING' && (s.catch_up_blocks_per_second ?? 0) > 0)
    expect(catching.length, 'скорость догона наблюдалась').toBeGreaterThan(0)
    for (const s of catching)
      expect(s.estimated_seconds_remaining).toBe(Math.ceil(s.lag_blocks! / s.catch_up_blocks_per_second!))
  })

  it(caseName('sync.ind.side.07', 'состояние то же, остаток сдвинулся мало — подписчикам ничего не уходит'), () => {
    // Чтение стоит, узел ещё рабочий: прочитанный блок не меняется, и до
    // входа в догон в канал не уходит ничего. Первые секунды после паузы
    // отданы сигналу, который был в пути.
    const quiet = published('paused', 'resumed').filter(e => e.at > startedAt.paused! + 4_000 && e.at < lagging.at - 3_500)
    expect(quiet.map(e => `${e.state.status} ${e.state.lag_blocks}`)).toEqual([])

    // В догоне повторный сигнал уходит только при заметном сдвиге остатка.
    const repeats = published('paused', 'resumed').filter(e => e.state.status === 'LAGGING')
    for (let i = 1; i < repeats.length; i++)
      expect(Math.abs(repeats[i].state.lag_blocks! - repeats[i - 1].state.lag_blocks!)).toBeGreaterThanOrEqual(NOTABLE_LAG_CHANGE_BLOCKS)
  })

  it(caseName('sync.ind.side.08', 'сменилось состояние либо остаток заметно сдвинулся — подписчики получают обновление'), () => {
    const paused = published('paused', 'resumed').map(e => e.state)
    expect(paused.some(s => s.status === 'LAGGING'), 'вход в догон дошёл до подписчика').toBe(true)
    expect(paused.filter(s => s.status === 'LAGGING').length, 'рост отставания в догоне дошёл до подписчика').toBeGreaterThanOrEqual(2)
    expect(paused.some(s => s.status === 'DISCONNECTED' && s.outage === 'READER'), 'обрыв связи дошёл до подписчика').toBe(true)
    const back = published('resumed-again').map(e => e.state)
    expect(back.some(s => s.status === 'SYNCED'), 'возврат в рабочее состояние дошёл до подписчика').toBe(true)
  })
})

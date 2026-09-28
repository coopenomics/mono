/**
 * Имя нитки процесса ledger2 в реестре процессов (test-registry/ledger2.process-naming.yaml).
 *
 * Контракт-инициатор эмитит имя нитки в `ledger2::apply`, реестр процессов
 * показывает его в списке и в детализации. Нитка готовится паевым взносом в
 * цепи: `wallet::completedpst` проводит операцию под именем `p.wal.depo` с
 * хэшем взноса. Исторические нитки без эмитированного имени снаружи создать
 * нельзя — цепь их больше не порождает, эти случаи проверяются юнит-тестами.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COOP, COUNCIL, caseName, freshMember, gql, tokenOf, waitFor } from '../core'
import { chainDeposit } from './platform-a.helpers'

const DEPOSIT_PROCESS = 'p.wal.depo'

const PROCESS = `query($h:String!,$c:String!){
  process(hash:$h, coopname:$c){ process_type process_hash actions{ account name data } }
}`

const PROCESSES = `query($f:ProcessesFilter!,$p:PaginationInput!){
  processes(filter:$f, pagination:$p){ items{ processType processHash username } totalCount }
}`

describe('ledger2.process-naming: имя нитки из цепи — в списке и в детализации', () => {
  let member: Who
  let token: string
  let hash: string
  let view: any

  beforeAll(async () => {
    member = freshMember({ prefix: 'lpn' })
    token = await tokenOf(COUNCIL)
    hash = (await chainDeposit(member.account, 150)).hash
    // Взнос записан в цепь мимо контроллера — ждём, пока узел разберёт его.
    view = await waitFor(async () => {
      const d = await gql<any>(token, PROCESS, { h: hash, c: COOP })
      return d.process?.actions?.some((a: any) => a.account === 'ledger2' && a.name === 'apply') ? d.process : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: `процесс взноса ${hash.slice(0, 10)} в реестре` })
  })

  it(caseName('l2.pnam.happy.02', 'эмитированное имя нитки читается дословно'), async () => {
    const applies = (view.actions as any[]).filter(a => a.account === 'ledger2' && a.name === 'apply')
    const emitted = new Set(applies.map(a => a.data?.process_type).filter(Boolean))
    expect([...emitted]).toEqual([DEPOSIT_PROCESS])
    expect(view.process_type).toBe(DEPOSIT_PROCESS)
    expect(view.process_hash).toBe(hash)
  })

  it(caseName('l2.pnam.side.07', 'один процесс называется одинаково в списке и в детализации'), async () => {
    const byHash = await gql<any>(token, PROCESSES, { f: { coopname: COOP, processHash: hash }, p: { page: 1, limit: 10 } })
    const row = (byHash.processes.items as any[]).find(i => i.processHash === hash)
    expect(row).toBeTruthy()
    expect(row.processType).toBe(view.process_type)
    expect(row.username).toBe(member.account)

    // Фильтр по типу отбирает по тому же имени, что показывает строка.
    const byType = await gql<any>(token, PROCESSES, {
      f: { coopname: COOP, processType: DEPOSIT_PROCESS, username: member.account },
      p: { page: 1, limit: 10 },
    })
    const typed = (byType.processes.items as any[]).find(i => i.processHash === hash)
    expect(typed?.processType).toBe(view.process_type)
  })
})

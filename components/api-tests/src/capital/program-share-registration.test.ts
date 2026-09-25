/**
 * Автоматическая регистрация долей держателей Благороста (реестр
 * capital.program-share-registration): как только проект становится активным,
 * контроллер сам заводит в нём доли всех действующих вкладчиков по их балансу
 * Благороста, а изменение баланса переносит в доли активных проектов.
 *
 * Решение владельца 16.06.2026: окно между запуском проекта и переходом к
 * результату бывает короче минуты, а отката нет — не успевший вкладчик терял
 * долю. На стенде внешнего слоя автоматика выключена только на время
 * boot-тестов контракта (CAPITAL_PROGRAM_SHARE_AUTOREGISTRATION), здесь она
 * снова включена (C28-80).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { caseName, deposit, tokenOf, waitFor } from '../core'
import {
  amount,
  capitalMember,
  capitalWallets,
  chainSegment,
  clearance,
  createProject,
  ensureCapitalProgram,
  programInvest,
  setMasterInChain,
  startProject,
} from './cap-results.helpers'

const INVEST = 700
const MORE = 300

const tag = Date.now().toString(36)
let holder: Who
let holderToken = ''
let project = ''

/** Доля держателя в проекте совпала с его балансом Благороста. */
async function shareSettles(expected: number, label: string): Promise<any> {
  return waitFor(async () => {
    const seg = await chainSegment(project, holder.account)
    return seg && Number(seg.is_contributor) === 1 && Math.abs(amount(seg.capital_contributor_shares) - expected) < 0.00005 ? seg : null
  }, { timeoutMs: 120_000, intervalMs: 1_000, label })
}

describe('Благорост: автоматическая регистрация долей держателей', () => {
  beforeAll(async () => {
    await ensureCapitalProgram()
    holder = await capitalMember('areg')
    holderToken = await tokenOf(holder)
    await deposit(holder.account, INVEST + MORE)
    await waitFor(async () => ((await capitalWallets(holderToken, holder.account)).share >= INVEST + MORE ? true : null),
      { timeoutMs: 120_000, intervalMs: 1_000, label: 'паевой взнос деньгами в зеркале' })
    await programInvest(holder, holderToken, INVEST)
  })

  it(caseName('cap.areg.happy.01', 'проект запущен — держатель Благороста без допуска получает долю по своему балансу'), async () => {
    // Ведёт проект другой участник: держатель к проекту не допускался и сам
    // ничего не делает — долю заводит контроллер.
    const master = await capitalMember('aregm')
    project = await createProject(`Автодоли ${tag}`)
    await clearance(master, project)
    await setMasterInChain(project, master)
    await startProject(project)

    const balance = (await capitalWallets(holderToken, holder.account)).blago
    expect(balance).toBeGreaterThanOrEqual(INVEST)
    await shareSettles(balance, 'доля держателя в запущенном проекте')
  })

  it(caseName('cap.areg.happy.02', 'баланс Благороста вырос — доля в активном проекте догоняет его'), async () => {
    expect(project, 'нужен проект из cap.areg.happy.01').not.toBe('')
    await programInvest(holder, holderToken, MORE)
    const balance = (await capitalWallets(holderToken, holder.account)).blago
    await shareSettles(balance, 'доля держателя после взноса')
  })
})

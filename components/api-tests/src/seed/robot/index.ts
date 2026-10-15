/* eslint-disable node/prefer-global/process */
/**
 * Засев стенда для документации приложения «Робот совета» (docs-harness,
 * сюита run-robot-all). Робот на стенде установлен предустановкой boot: весь
 * совет голосует «сразу» по приёму пайщика и решениям Стола заказов, протоколы
 * подписывает робот. На свежем стенде журнал робота пуст — фаза 01 даёт ему
 * работу: совет доверяет роботу ещё и решения о выходе пайщика, пайщик подаёт
 * заявление на выход, робот голосует за совет и утверждает протокол.
 *
 *   esno src/seed/robot/index.ts 01-activity
 */
import { gql } from '../../core/client'
import { tokenOf } from '../../core/auth'
import { CHAIRMAN } from '../../core/roles'
import { freshMember } from '../../core/participants'
import { requestExit } from '../../core/membership-exit'
import { automateCouncil, presetDecisionTypes } from '../../core/robot'
import { waitFor } from '../../core/wait'

const log = (...a: unknown[]) => console.error('[seed-robot]', ...a)

const TYPE = 'leavecoop'
const JOURNAL = `query($o:PaginationInput){ sovietRobotJournal(options:$o){ items{ decision_id decision_type stage } } }`

async function journal(): Promise<any[]> {
  const chairman = await tokenOf(CHAIRMAN)
  return (await gql<any>(chairman, JOURNAL, { o: { page: 1, limit: 50, sortOrder: 'DESC' } })).sovietRobotJournal.items as any[]
}

/** 01 — робот провёл решение о выходе пайщика от голосов до исполнения. */
async function phase01(): Promise<void> {
  const executed = (await journal()).filter(e => e.decision_type === TYPE && String(e.stage).toLowerCase() === 'executed')
  if (executed.length) {
    log(`в журнале робота уже есть исполненное решение «${TYPE}»`)
    return
  }
  await automateCouncil([...presetDecisionTypes(), TYPE])
  log(`совет доверил роботу решения «${TYPE}»`)
  for (const [firstName, lastName, middleName] of [['Глеб', 'Тихонов', 'Сергеевич'], ['Вера', 'Лаврова', 'Андреевна']]) {
    const member = freshMember({ prefix: 'rob', firstName, lastName, middleName })
    await requestExit(member, false)
    log(`${lastName} ${firstName} подал заявление на выход`)
  }
  await waitFor(async () => {
    const done = (await journal()).filter(e => e.decision_type === TYPE && String(e.stage).toLowerCase() === 'executed')
    return done.length >= 2 ? true : null
  }, { timeoutMs: 180_000, intervalMs: 3_000, label: `робот исполнил решения «${TYPE}»` })
  log(`робот исполнил решения о выходе`)
}

const PHASES: Record<string, () => Promise<void>> = {
  '01-activity': phase01,
}

async function main(): Promise<void> {
  const names = process.argv.slice(2)
  if (!names.length) {
    console.error(`Usage: seed-robot <фаза>\nФазы: ${Object.keys(PHASES).join(', ')}`)
    process.exit(2)
  }
  for (const name of names) {
    const fn = PHASES[name]
    if (!fn) {
      console.error(`неизвестная фаза ${name}; есть: ${Object.keys(PHASES).join(', ')}`)
      process.exit(2)
    }
    console.error(`\n=== seed-robot: ${name} ===`)
    await fn()
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })

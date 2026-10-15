/**
 * Стол «Результаты» Благороста снаружи (реестр capital.results-desk):
 * строка доли строится одним запросом — с названиями компонента и проекта,
 * статусом проекта и признаком голоса; сводный список долей кооператива
 * читает только совет.
 *
 * Подготовка: свежий участник ведёт проект верхнего уровня и компонент в нём —
 * мастер получает долю автора в обоих.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COUNCIL, caseName, freshMember, gqlError, tokenOf, waitFor } from '../core'
import {
  capitalMember,
  clearance,
  createProject,
  ensureCapitalProgram,
  refreshSegment,
  segmentOf,
  segmentsOf,
  setMasterInChain,
} from './cap-results.helpers'

const SEGMENTS = `query($f:CapitalSegmentFilter){ capitalSegments(filter:$f){ totalCount items{ username project_hash } } }`

let alice: Who
let aliceToken: string
let project = ''
let component = ''
const tag = Date.now().toString(36)
const projectTitle = `Проект стола результатов ${tag}`
const componentTitle = `Компонент стола результатов ${tag}`

describe('Благорост: стол «Результаты»', () => {
  beforeAll(async () => {
    await ensureCapitalProgram()
    alice = await capitalMember('rdsk')
    aliceToken = await tokenOf(alice)

    project = await createProject(projectTitle)
    component = await createProject(componentTitle, project)
    await clearance(alice, project)
    await clearance(alice, component)
    // Мастер получает долю автора: так у участника появляются доли и в
    // проекте верхнего уровня, и в компоненте.
    await setMasterInChain(project, alice)
    await setMasterInChain(component, alice)

    await waitFor(async () => {
      const mine = await segmentsOf(aliceToken, { username: alice.account })
      const hashes = new Set(mine.map(s => s.project_hash))
      return hashes.has(project) && hashes.has(component) ? true : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: 'доли участника в зеркале' })
  })

  it(caseName('cap.resdesk.happy.06', 'доли по имени пайщика приходят с названиями компонента и проекта, статусом проекта и признаком голоса'), async () => {
    const mine = await segmentsOf(aliceToken, { username: alice.account })
    for (const s of mine) {
      expect(s.username).toBe(alice.account)
      expect(s.project_title, `у доли ${s.project_hash} есть название`).toBeTruthy()
      expect(s.project_status, `у доли ${s.project_hash} есть статус проекта`).toBeTruthy()
      expect(typeof s.has_voted, `признак голоса у доли ${s.project_hash} — да/нет`).toBe('boolean')
    }
    const inComponent = mine.find(s => s.project_hash === component)
    expect(inComponent).toBeDefined()
    expect(inComponent.project_title).toBe(componentTitle)
    expect(inComponent.parent_title).toBe(projectTitle)
    expect(inComponent.parent_hash).toBe(project)
    expect(inComponent.project_status).toBe('PENDING')
    expect(inComponent.has_voted).toBe(false)
  })

  it(caseName('cap.resdesk.side.09', 'доля проекта без родителя: название проекта есть, название и хэш родителя пусты'), async () => {
    const mine = await segmentsOf(aliceToken, { username: alice.account })
    const top = mine.find(s => s.project_hash === project)
    expect(top).toBeDefined()
    expect(top.project_title).toBe(projectTitle)
    expect(top.parent_title ?? '').toBe('')
    expect(top.parent_hash ?? '').toBe('')
  })

  it(caseName('cap.resdesk.side.11', 'на путях без контекста признак голоса приходит «нет», а не пустым'), async () => {
    const single = await segmentOf(aliceToken, component, alice.account)
    expect(single).not.toBeNull()
    expect(single.has_voted).toBe(false)

    const refreshed = await refreshSegment(alice, component)
    expect(refreshed).not.toBeNull()
    expect(refreshed.has_voted).toBe(false)
  })

  it(caseName('cap.resdesk.break.03', 'сводный список долей кооператива рядовому пайщику закрыт, совету и запросу по проекту — открыт'), async () => {
    const stranger = freshMember({ prefix: 'rdsx' })
    const token = await tokenOf(stranger)

    expect((await gqlError(token, SEGMENTS, { f: {} }))?.code).toBe('CAPITAL_SEGMENTS_SUMMARY_FORBIDDEN')
    expect((await gqlError(token, SEGMENTS, { f: { username: alice.account } }))?.code).toBe('CAPITAL_SEGMENTS_SUMMARY_FORBIDDEN')

    // Решение владельца 2026-08-20: запрос по конкретному проекту ролью не
    // ограничен — на нём стоят рабочие виджеты проекта.
    expect(await gqlError(token, SEGMENTS, { f: { project_hash: component } })).toBeNull()
    expect(await gqlError(await tokenOf(COUNCIL), SEGMENTS, { f: {} })).toBeNull()
  })
})

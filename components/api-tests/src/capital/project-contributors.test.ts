/**
 * Состав участников проекта Благороста снаружи (реестр
 * capital.project-contributors): новый соавтор виден в списке сразу после
 * ответа на добавление, рядовой пайщик читает свои доли по всем проектам, а
 * учётная запись, которую совет ещё не принял, списков «Капитала» не видит.
 */
import crypto from 'node:crypto'
import ecc from 'eosjs-ecc'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, caseName, gql, gqlError, randomAccount, tokenOf, waitFor } from '../core'
import {
  capitalMember,
  clearance,
  createProject,
  ensureCapitalProgram,
  segmentOf,
  segmentsOf,
  setMasterInChain,
} from './cap-results.helpers'

const ADD_AUTHOR = `mutation($d:AddAuthorInput!){ capitalAddAuthor(data:$d){ project_hash } }`
const SEGMENTS = `query($f:CapitalSegmentFilter){ capitalSegments(filter:$f){ totalCount items{ username project_hash } } }`
const CONTRIBUTORS = `query($f:CapitalContributorFilter){ capitalContributors(filter:$f){ totalCount items{ username } } }`

/**
 * Учётная запись после регистрации, до решения совета о приёме: вход у неё
 * есть (токен выдаётся при регистрации), а пайщиком она ещё не стала.
 */
async function registeredCandidate(): Promise<{ username: string, token: string }> {
  const wif = await ecc.randomKey()
  const username = randomAccount('cand')
  const d = await gql<any>(null, `mutation($d:RegisterAccountInput!){
    registerAccount(data:$d){ tokens{ access{ token } } account{ username } }
  }`, {
    d: {
      email: `${username}@api-tests.coop`,
      username,
      public_key: ecc.privateToPublic(wif),
      type: 'individual',
      individual_data: {
        first_name: 'Кандидат',
        last_name: 'Внешнийслой',
        middle_name: 'Проверочный',
        birthdate: '1990-01-01',
        full_address: 'г. Москва, ул. Тестовая, д. 1',
        phone: `+7999${crypto.randomInt(1_000_000, 9_999_999)}`,
      },
    },
  })
  return { username, token: d.registerAccount.tokens.access.token as string }
}

let alice: Who
let bob: Who
let project = ''
let component = ''
const tag = Date.now().toString(36)

describe('Благорост: участники проекта', () => {
  beforeAll(async () => {
    await ensureCapitalProgram()
    alice = await capitalMember('pcta')
    bob = await capitalMember('pctb')

    project = await createProject(`Проект участников ${tag}`)
    component = await createProject(`Компонент участников ${tag}`, project)
    await clearance(alice, project)
    await clearance(alice, component)
    await clearance(bob, component)
    await setMasterInChain(project, alice)
    await setMasterInChain(component, alice)

    const aliceToken = await tokenOf(alice)
    await waitFor(async () => {
      const mine = await segmentsOf(aliceToken, { username: alice.account })
      const hashes = new Set(mine.map(s => s.project_hash))
      return hashes.has(project) && hashes.has(component) ? true : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: 'доли мастера в зеркале' })
  })

  describe('добавление соавтора', () => {
    beforeAll(async () => {
      // Ответ мутации — после разбора блока транзакции; дальше ничего не ждём.
      const d = await gql<any>(await tokenOf(CHAIRMAN), ADD_AUTHOR, { d: { coopname: COOP, project_hash: component, author: bob.account } })
      expect(d.capitalAddAuthor.project_hash).toBe(component)
    })

    it(caseName('cap.contrib.happy.04', 'новый соавтор сразу виден в списке участников компонента'), async () => {
      const members = await segmentsOf(await tokenOf(alice), { project_hash: component })
      const added = members.find(s => s.username === bob.account)
      expect(added, 'доля нового соавтора в списке участников').toBeDefined()
      expect(added.is_author).toBe(true)
    })

    it(caseName('capital.pc.side.fact-01', 'доля соавтора читается сразу после ответа, без паузы'), async () => {
      const own = await segmentOf(await tokenOf(bob), component, bob.account)
      expect(own).not.toBeNull()
      expect(own.is_author).toBe(true)
      expect(own.status).toBe('GENERATION')
    })
  })

  describe('списки участников', () => {
    const PAGE = `query($f:CapitalSegmentFilter,$o:PaginationInput){ capitalSegments(filter:$f, options:$o){
      totalCount totalPages currentPage items{ username project_hash parent_hash project_title } } }`

    async function page(filter: Record<string, unknown>, options?: Record<string, unknown>) {
      const d = await gql<any>(await tokenOf(CHAIRMAN), PAGE, { f: filter, o: options })
      return d.capitalSegments as { totalCount: number, totalPages: number, currentPage: number, items: any[] }
    }

    it(caseName('cap.contrib.happy.02', 'участники компонента — только доли этого компонента, по одной на пайщика'), async () => {
      const list = await page({ project_hash: component })
      expect(list.items.map(s => s.username).sort()).toEqual([alice.account, bob.account].sort())
      expect(list.items.every(s => s.project_hash === component)).toBe(true)
      expect(list.totalCount).toBe(2)
    })

    it(caseName('cap.contrib.happy.03', 'участники проекта с компонентами — доли объединены по пайщику: один человек — одна строка'), async () => {
      const list = await page({ project_hash: project })
      const names = list.items.map(s => s.username)
      expect(names.sort(), 'мастер с долями в проекте и компоненте — одной строкой').toEqual([alice.account, bob.account].sort())
      expect(list.totalCount).toBe(2)
    })

    it(caseName('cap.contrib.side.04', 'страница отрезается после объединения — общее число считается по объединённым строкам'), async () => {
      const first = await page({ project_hash: project }, { page: 1, limit: 1 })
      expect(first.items).toHaveLength(1)
      expect(first.totalCount).toBe(2)
      expect(first.totalPages).toBe(2)
      const second = await page({ project_hash: project }, { page: 2, limit: 1 })
      expect(second.items).toHaveLength(1)
      expect(second.items[0].username).not.toBe(first.items[0].username)
    })

    it(caseName('cap.contrib.break.01', 'больше тысячи участников на страницу не отдаётся — отказ с допустимыми границами'), async () => {
      const err = await gqlError(await tokenOf(CHAIRMAN), PAGE, { f: { project_hash: project }, o: { page: 1, limit: 1001 } })
      expect(err, 'запрос сверх предела отклонён').not.toBeNull()
    })

    it(caseName('cap.contrib.side.05', 'хеш, которого нет среди проектов, — пустой список без ошибки'), async () => {
      const list = await page({ project_hash: 'a'.repeat(64) })
      expect(list.items).toEqual([])
      expect(list.totalCount).toBe(0)
    })

    it(caseName('cap.contrib.side.15', 'отбор «только компоненты» и «только проекты верхнего уровня» идёт по проекту доли'), async () => {
      const inComponents = await page({ username: alice.account, is_component: true }, { page: 1, limit: 100 })
      expect(inComponents.items.map(s => s.project_hash)).toContain(component)
      expect(inComponents.items.map(s => s.project_hash)).not.toContain(project)

      const inTopLevel = await page({ username: alice.account, is_component: false }, { page: 1, limit: 100 })
      expect(inTopLevel.items.map(s => s.project_hash)).toContain(project)
      expect(inTopLevel.items.map(s => s.project_hash)).not.toContain(component)
    })
  })

  it(caseName('cap.contrib.side.17', 'рядовой пайщик читает свои доли по всем проектам без указания проекта'), async () => {
    const mine = await segmentsOf(await tokenOf(alice), { username: alice.account })
    expect(mine.length).toBeGreaterThanOrEqual(2)
    expect(mine.every(s => s.username === alice.account)).toBe(true)
    const hashes = new Set(mine.map(s => s.project_hash))
    expect(hashes.has(project)).toBe(true)
    expect(hashes.has(component)).toBe(true)
  })

  it(caseName('cap.contrib.break.18', 'не принятая советом учётная запись не видит долей и участников проекта; свои доли — видит'), async () => {
    const candidate = await registeredCandidate()

    expect((await gqlError(candidate.token, SEGMENTS, { f: { project_hash: component } }))?.code).toBe('KIT_RIGHT_SCOPE_OWN')
    expect((await gqlError(candidate.token, CONTRIBUTORS, { f: { project_hash: component } }))?.code).toBe('KIT_RIGHT_SCOPE_OWN')

    // Самообход: свои доли по имени кандидат по-прежнему получает.
    const own = await gql<any>(candidate.token, SEGMENTS, { f: { username: candidate.username } })
    expect(own.capitalSegments.items).toEqual([])
  })
})

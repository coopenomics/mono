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
  setMaster,
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
    await setMaster(project, alice)
    await setMaster(component, alice)

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

    expect((await gqlError(candidate.token, SEGMENTS, { f: { project_hash: component } }))?.code).toBe('KIT_MEMBERS_ONLY')
    expect((await gqlError(candidate.token, CONTRIBUTORS, { f: { project_hash: component } }))?.code).toBe('KIT_MEMBERS_ONLY')

    // Самообход: свои доли по имени кандидат по-прежнему получает.
    const own = await gql<any>(candidate.token, SEGMENTS, { f: { username: candidate.username } })
    expect(own.capitalSegments.items).toEqual([])
  })
})

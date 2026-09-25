/**
 * Благорост: личное избранное — проекты, компоненты, задачи, требования
 * (test-registry/capital.favorites.yaml).
 *
 * Избранное строго личное: чужое не читает и не правит даже председатель.
 * Добавляется только существующая цель, повтор ничего не удваивает, выдача
 * берёт живое наименование цели и молча отбрасывает удалённые. Удаление
 * проекта, компонента, задачи или требования снимает их с избранного у всех.
 *
 * Мир теста: свежий пайщик F с личным проектом, его компонентом, задачами и
 * требованиями; проекты в цепи и личный проект председателя — для удалений.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP_SIGNER, caseName, freshMember, gql, tokenOf, transact, waitFor } from '../core'
import { COOP } from '../core/env'
import {
  addFavoriteAs,
  createChainProject,
  createIssue,
  createLocalProject,
  createStory,
  deleteIssueAsChairman,
  deleteProjectAsChairman,
  deleteStoryAs,
  ensureCapitalChainReady,
  favoritesAs,
  myFavorites,
  projectAs,
  randomHash,
  removeFavoriteAs,
  tag,
} from './cap-access.helpers'

let F: Who
let T = ''
let project: any
let component: any

function has(list: any[], hash: string): boolean {
  return list.some(f => f.target_hash === hash.toLowerCase())
}

beforeAll(async () => {
  await ensureCapitalChainReady()
  T = tag('fav')
  F = freshMember({ prefix: 'capf' })
  project = await createLocalProject(F, `Избранное ${T}`)
  component = await createLocalProject(F, `Избранное ${T} — компонент`, project.project_hash)
}, 600_000)

describe('Благорост — избранное: добавление и чтение', () => {
  it(caseName('cap.fav.happy.01', 'существующий проект ложится в избранное с живым наименованием'), async () => {
    const r = await addFavoriteAs(F, 'PROJECT', project.project_hash)
    expect(r.errors).toEqual([])
    const added = r.data.capitalAddFavorite.find((f: any) => f.target_hash === project.project_hash)
    expect(added).toMatchObject({ target_type: 'PROJECT', title: project.title, username: F.account })

    const c = await addFavoriteAs(F, 'COMPONENT', component.project_hash)
    expect(c.errors).toEqual([])
    const listed = (await myFavorites(F)).find(f => f.target_hash === component.project_hash)
    expect(listed).toMatchObject({ target_type: 'COMPONENT', title: component.title, parent_hash: project.project_hash })
  })

  it(caseName('cap.fav.side.01', 'цель, которой нет, в избранное не ложится'), async () => {
    const ghost = randomHash()
    for (const type of ['PROJECT', 'ISSUE', 'ARTIFACT'] as const) {
      const r = await addFavoriteAs(F, type, ghost)
      expect(r.errors[0]?.code).toBe('CAPITAL_FAVORITE_TARGET_NOT_FOUND')
    }
    expect(has(await myFavorites(F), ghost)).toBe(false)
  })

  it(caseName('cap.fav.side.10', 'чужой личный проект в избранное не ложится — ответ «не найдено», название не раскрывается'), async () => {
    // До 25.09.2026 проверялось только существование цели, и через избранное
    // читалось название чужого личного проекта.
    const stranger = freshMember({ prefix: 'capfs' })
    const r = await addFavoriteAs(stranger, 'PROJECT', project.project_hash)
    expect(r.errors[0]?.code).toBe('CAPITAL_FAVORITE_TARGET_NOT_FOUND')
    expect(JSON.stringify(r)).not.toContain(project.title)
    expect(has(await myFavorites(stranger), project.project_hash)).toBe(false)
  })

  it(caseName('cap.fav.side.02', 'повторное добавление той же цели не удваивает запись'), async () => {
    await addFavoriteAs(F, 'PROJECT', project.project_hash)
    const r = await addFavoriteAs(F, 'PROJECT', project.project_hash)
    expect(r.errors).toEqual([])
    const same = r.data.capitalAddFavorite.filter((f: any) => f.target_hash === project.project_hash)
    expect(same).toHaveLength(1)
  })

  it(caseName('cap.fav.side.03', 'звёздочка снимается и с цели, которой уже нет'), async () => {
    const before = await myFavorites(F)
    const r = await removeFavoriteAs(F, 'ISSUE', randomHash())
    expect(r.errors).toEqual([])
    expect(r.data.capitalRemoveFavorite).toHaveLength(before.length)

    const own = await removeFavoriteAs(F, 'COMPONENT', component.project_hash)
    expect(own.errors).toEqual([])
    expect(has(own.data.capitalRemoveFavorite, component.project_hash)).toBe(false)
  })

  it(caseName('cap.fav.break.01', 'председатель не читает и не правит чужое избранное'), async () => {
    const before = await myFavorites(F)
    expect((await favoritesAs(CHAIRMAN, F.account)).errors[0]?.code).toBe('CAPITAL_FAVORITES_ACCESS_FORBIDDEN')
    expect((await addFavoriteAs(CHAIRMAN, 'PROJECT', component.project_hash, F.account)).errors[0]?.code).toBe('CAPITAL_FAVORITES_ACCESS_FORBIDDEN')
    expect((await removeFavoriteAs(CHAIRMAN, 'PROJECT', project.project_hash, F.account)).errors[0]?.code).toBe('CAPITAL_FAVORITES_ACCESS_FORBIDDEN')
    const after = await myFavorites(F)
    expect(after.map(f => f.target_hash).sort()).toEqual(before.map(f => f.target_hash).sort())
  })

  it(caseName('cap.fav.side.09', 'задача и требование в избранном — с актуальными наименованиями'), async () => {
    const issue = await createIssue(F, { title: `Задача ${T}`, project_hash: project.project_hash })
    const story = await createStory(F, { title: `Требование ${T}`, project_hash: project.project_hash })
    expect((await addFavoriteAs(F, 'ISSUE', issue.issue_hash)).errors).toEqual([])
    expect((await addFavoriteAs(F, 'ARTIFACT', story.story_hash)).errors).toEqual([])

    let list = await myFavorites(F)
    expect(list.find(f => f.target_hash === issue.issue_hash)).toMatchObject({ target_type: 'ISSUE', title: `Задача ${T}`, parent_hash: project.project_hash })
    expect(list.find(f => f.target_hash === story.story_hash)).toMatchObject({ target_type: 'ARTIFACT', title: `Требование ${T}` })

    // Наименование берётся у цели при каждом чтении, а не запоминается при добавлении.
    await gql(await tokenOf(F),
      'mutation($d:UpdateIssueInput!){ capitalUpdateIssue(data:$d){ issue_hash } }',
      { d: { issue_hash: issue.issue_hash, title: `Задача ${T} (переименована)` } })
    list = await myFavorites(F)
    expect(list.find(f => f.target_hash === issue.issue_hash)?.title).toBe(`Задача ${T} (переименована)`)
  })
})

describe('Благорост — избранное: удалённые цели', () => {
  it(caseName('cap.fav.side.04', 'требование, исчезнувшее вместе со своей задачей, выпадает из выдачи'), async () => {
    const issue = await createIssue(F, { title: `Задача с требованием ${T}`, project_hash: project.project_hash })
    const story = await createStory(F, { title: `Требование задачи ${T}`, issue_hash: issue.issue_hash })
    expect((await addFavoriteAs(F, 'ARTIFACT', story.story_hash)).errors).toEqual([])
    expect(has(await myFavorites(F), story.story_hash)).toBe(true)

    // Удаляется задача — требование уходит вместе с ней, а снятие с избранного
    // касается только самой задачи.
    await deleteIssueAsChairman(issue.issue_hash)
    const r = await favoritesAs(F)
    expect(r.errors).toEqual([])
    expect(has(r.data.capitalFavorites, story.story_hash)).toBe(false)
    expect(has(r.data.capitalFavorites, project.project_hash)).toBe(true)
  })

  it(caseName('cap.fav.side.05', 'проект, удалённый в цепи мимо контроллера, выпадает из выдачи'), async () => {
    const chain = await createChainProject(`Избранное в цепи ${T}`)
    expect((await addFavoriteAs(F, 'PROJECT', chain)).errors).toEqual([])
    expect(has(await myFavorites(F), chain)).toBe(true)

    await transact(COOP_SIGNER, [{ account: 'capital', name: 'delproject', data: { coopname: COOP, project_hash: chain } }])
    await waitFor(async () => {
      const p = await projectAs(CHAIRMAN, chain)
      return !p || p.present === false ? true : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: 'удаление проекта дошло до зеркала' })

    expect(has(await myFavorites(F), chain)).toBe(false)
  })

  it(caseName('cap.fav.side.06', 'снятие удалённой цели идёт по хэшу в нижнем регистре'), async () => {
    const issue = await createIssue(F, { title: `Задача регистра ${T}`, project_hash: project.project_hash })
    const upper = issue.issue_hash.toUpperCase()
    const r = await addFavoriteAs(F, 'ISSUE', upper)
    expect(r.errors).toEqual([])
    expect(has(r.data.capitalAddFavorite, issue.issue_hash)).toBe(true)

    await deleteIssueAsChairman(upper)
    expect(has(await myFavorites(F), issue.issue_hash)).toBe(false)
  })

  it(caseName('cap.fav.side.07', 'удаление проекта и компонента — личного и из цепи — снимает их с избранного у всех'), async () => {
    // Личный проект председателя: мягкое удаление.
    const local = await createLocalProject(CHAIRMAN, `Личный ${T}`)
    const localComponent = await createLocalProject(CHAIRMAN, `Личный ${T} — компонент`, local.project_hash)
    expect((await addFavoriteAs(CHAIRMAN, 'PROJECT', local.project_hash)).errors).toEqual([])
    expect((await addFavoriteAs(CHAIRMAN, 'COMPONENT', localComponent.project_hash)).errors).toEqual([])
    await deleteProjectAsChairman(localComponent.project_hash)
    await deleteProjectAsChairman(local.project_hash)
    const mine = await myFavorites(CHAIRMAN)
    expect(has(mine, local.project_hash)).toBe(false)
    expect(has(mine, localComponent.project_hash)).toBe(false)

    // Проект в цепи: в избранном у двоих, удаляет председатель.
    const chain = await createChainProject(`Удаляемый ${T}`)
    expect((await addFavoriteAs(F, 'PROJECT', chain)).errors).toEqual([])
    expect((await addFavoriteAs(CHAIRMAN, 'PROJECT', chain)).errors).toEqual([])
    await deleteProjectAsChairman(chain)
    expect(has(await myFavorites(F), chain)).toBe(false)
    expect(has(await myFavorites(CHAIRMAN), chain)).toBe(false)
  })

  it(caseName('cap.fav.side.08', 'удаление задачи и требования снимает их с избранного'), async () => {
    const issue = await createIssue(F, { title: `Удаляемая задача ${T}`, project_hash: project.project_hash })
    const story = await createStory(F, { title: `Удаляемое требование ${T}`, project_hash: project.project_hash })
    expect((await addFavoriteAs(F, 'ISSUE', issue.issue_hash)).errors).toEqual([])
    expect((await addFavoriteAs(F, 'ARTIFACT', story.story_hash)).errors).toEqual([])

    await deleteIssueAsChairman(issue.issue_hash)
    await deleteStoryAs(F, story.story_hash)
    const list = await myFavorites(F)
    expect(has(list, issue.issue_hash)).toBe(false)
    expect(has(list, story.story_hash)).toBe(false)
  })
})

/**
 * Редакции содержимого проектов и артефактов (реестр capital.content-revisions).
 *
 * Каждая правка текста — новая редакция (content_rev). Клиент присылает
 * редакцию, с которой начал (base_rev); если на сервере с тех пор появилась
 * чужая правка, сервер сливает три версии (своя, базовая, текущая). Слить
 * нельзя — отказ CONTENT_CONFLICT с обеими версиями, ничего не сохранено.
 *
 * Правки идут от одного пайщика с разными base_rev: для сервера «второй
 * автор» — это правка от устаревшей редакции, чья она — неважно. Проекты и
 * артефакты персональные: только база контроллера, без цепи. Откат при
 * провале цепи проверяется на кооперативном проекте председателя.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, caseName, freshMember, gql, gqlError, login, tokenOf, transact } from '../core'
import { COOP_SIGNER } from '../core/wallet'
import {
  EDIT_PROJECT,
  createChainProject,
  createLocalProject,
  editProjectInput,
  ensureCapitalInitialized,
  getProject,
  getRevision,
  gqlErrorFull,
  listRevisions,
  randomHash,
  runTag,
} from './cap-metrics.helpers'

const BASE_TEXT = [
  '# План работ',
  'Первая строка плана',
  'Вторая строка плана',
  'Третья строка плана',
  'Четвёртая строка плана',
  'Пятая строка плана',
].join('\n')

function withLine(text: string, index: number, line: string): string {
  const lines = text.split('\n')
  lines[index] = line
  return lines.join('\n')
}

const CREATE_STORY = 'mutation($d:CreateStoryInput!){ capitalCreateStory(data:$d){ story_hash title description content_format content_rev } }'
const UPDATE_STORY = 'mutation($d:UpdateStoryInput!){ capitalUpdateStory(data:$d){ story_hash title description content_format content_rev } }'

let token = ''
let tag = ''

describe('Благорост — редакции содержимого и слияние правок', () => {
  beforeAll(async () => {
    const who = freshMember({ prefix: 'caprev' })
    token = await login(who)
    tag = runTag()
  })

  it(caseName('cap.rev.side.05', 'сущность без редакций получает первую запись — сеется rev 1, запись становится rev 2'), async () => {
    const hash = await createLocalProject(token, { title: `Посев ${tag}`, description: BASE_TEXT })
    const created = await getProject(token, hash)
    expect(created.content_rev, 'предусловие: проект создан без редакций').toBe(0)

    await gql(token, EDIT_PROJECT, editProjectInput(hash, { title: `Посев ${tag} — правка`, description: BASE_TEXT, base_rev: 0 }))

    const after = await getProject(token, hash)
    expect(after.content_rev).toBe(2)
    const revs = await listRevisions(token, 'PROJECT', hash)
    expect(revs.map(r => r.rev)).toEqual([2, 1])
    expect(revs[1].origin, 'первая редакция — посев из текущего текста').toBe('BACKFILL')
    expect(revs[0].origin).toBe('WEB')

    const seeded = await getRevision(token, 'PROJECT', hash, 1)
    expect(seeded.title, 'в посеве — текст до правки').toBe(`Посев ${tag}`)
    expect(seeded.description).toBe(BASE_TEXT)
  })

  it(caseName('cap.rev.happy.01', 'две правки разных мест от одной базы сливаются без конфликта'), async () => {
    const hash = await createLocalProject(token, { title: `Слияние ${tag}`, description: BASE_TEXT })
    // Первый автор правит первую строку от исходного текста (rev 1 после посева).
    const first = withLine(BASE_TEXT, 1, 'Первая строка плана — правка первого')
    await gql(token, EDIT_PROJECT, editProjectInput(hash, { title: `Слияние ${tag}`, description: first, base_rev: 1 }))
    // Второй начал с той же базы и правит пятую строку.
    const second = withLine(BASE_TEXT, 5, 'Пятая строка плана — правка второго')
    await gql(token, EDIT_PROJECT, editProjectInput(hash, { title: `Слияние ${tag}`, description: second, base_rev: 1 }))

    const project = await getProject(token, hash)
    expect(project.content_rev).toBe(3)
    expect(project.description).toContain('Первая строка плана — правка первого')
    expect(project.description).toContain('Пятая строка плана — правка второго')

    const revs = await listRevisions(token, 'PROJECT', hash)
    expect(revs[0]).toMatchObject({ rev: 3, base_rev: 1, merged: true })
  })

  it(caseName('cap.rev.side.01', 'одна строка изменена по-разному — конфликт с маркерами, ничего не потеряно'), async () => {
    const hash = await createLocalProject(token, { title: `Конфликт ${tag}`, description: BASE_TEXT })
    const theirs = withLine(BASE_TEXT, 3, 'Третья строка — вариант первого')
    await gql(token, EDIT_PROJECT, editProjectInput(hash, { title: `Конфликт ${tag}`, description: theirs, base_rev: 1 }))

    const ours = withLine(BASE_TEXT, 3, 'Третья строка — вариант второго')
    const err = await gqlErrorFull(token, EDIT_PROJECT, editProjectInput(hash, { title: `Конфликт ${tag}`, description: ours, base_rev: 1 }))
    expect(err?.code).toBe('CONTENT_CONFLICT')
    const c = err!.extensions.conflict
    expect(c).toMatchObject({ base_rev: 1, current_rev: 2, description_conflict: true, title_conflict: false })
    expect(c.ours.description, 'правка автора возвращается ему целиком').toContain('вариант второго')
    expect(c.theirs.description, 'и текущая версия сервера').toContain('вариант первого')
    expect(c.base.description).toContain('Третья строка плана')
    expect(c.marked).toMatch(/<{7}/)
    expect(c.marked).toContain('вариант второго')
    expect(c.marked).toContain('вариант первого')

    const project = await getProject(token, hash)
    expect(project.content_rev, 'при конфликте ничего не сохраняется').toBe(2)
    expect(project.description).toContain('вариант первого')
    expect(project.description).not.toContain('вариант второго')
  })

  it(caseName('cap.rev.side.02', 'заголовок изменён по-разному двумя авторами — title_conflict'), async () => {
    const hash = await createLocalProject(token, { title: `Заголовок ${tag}`, description: BASE_TEXT })
    await gql(token, EDIT_PROJECT, editProjectInput(hash, { title: `Заголовок ${tag} — первый`, description: BASE_TEXT, base_rev: 1 }))

    const err = await gqlErrorFull(token, EDIT_PROJECT, editProjectInput(hash, { title: `Заголовок ${tag} — второй`, description: BASE_TEXT, base_rev: 1 }))
    expect(err?.code).toBe('CONTENT_CONFLICT')
    expect(err!.extensions.conflict).toMatchObject({ title_conflict: true, description_conflict: false })
    expect((await getProject(token, hash)).title).toBe(`Заголовок ${tag} — первый`)
  })

  it(caseName('cap.rev.side.04', 'повторное сохранение того же текста не создаёт редакцию'), async () => {
    const hash = await createLocalProject(token, { title: `Повтор ${tag}`, description: BASE_TEXT })
    await gql(token, EDIT_PROJECT, editProjectInput(hash, { title: `Повтор ${tag}`, description: withLine(BASE_TEXT, 2, 'Вторая строка — правка'), base_rev: 0 }))
    const saved = await getProject(token, hash)
    expect(saved.content_rev).toBe(2)

    // Тот же текст от текущей редакции и от устаревшей — обе без новой редакции.
    await gql(token, EDIT_PROJECT, editProjectInput(hash, { title: saved.title, description: saved.description, base_rev: 2 }))
    await gql(token, EDIT_PROJECT, editProjectInput(hash, { title: saved.title, description: saved.description, base_rev: 1 }))

    const after = await getProject(token, hash)
    expect(after.content_rev, 'content_rev не растёт').toBe(2)
    expect((await listRevisions(token, 'PROJECT', hash)).map(r => r.rev)).toEqual([2, 1])
  })

  it(caseName('cap.rev.side.03', 'BPMN/DRAWIO: параллельные правки схемы — конфликт; правил один — берётся его версия'), async () => {
    const project = await createLocalProject(token, { title: `Схемы ${tag}`, description: 'Проект со схемой.' })
    const storyHash = randomHash()
    const xml = (label: string) => `<mxfile><diagram id="d1" name="Схема"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" value="${label}" parent="0"/></root></mxGraphModel></diagram></mxfile>`
    const created = await gql<any>(token, CREATE_STORY, {
      d: { coopname: COOP, story_hash: storyHash, project_hash: project, title: `Схема ${tag}`, description: xml('исходная'), content_format: 'DRAWIO' },
    })
    expect(created.capitalCreateStory.content_format).toBe('DRAWIO')
    const baseRev = Math.max(created.capitalCreateStory.content_rev, 1)

    // Первый правит схему от базы.
    const first = await gql<any>(token, UPDATE_STORY, { d: { story_hash: storyHash, description: xml('правка первого'), base_rev: baseRev } })
    const afterFirst = first.capitalUpdateStory
    expect(afterFirst.description).toContain('правка первого')

    // Второй тоже правил схему от той же базы — построчного слияния для XML нет.
    const err = await gqlErrorFull(token, UPDATE_STORY, { d: { story_hash: storyHash, description: xml('правка второго'), base_rev: baseRev } })
    expect(err?.code).toBe('CONTENT_CONFLICT')
    expect(err!.extensions.conflict.description_conflict).toBe(true)

    // Третий от той же базы схему не трогал, поменял только название — схема
    // берётся у того, кто её правил, а название — у третьего.
    const third = await gql<any>(token, UPDATE_STORY, {
      d: { story_hash: storyHash, title: `Схема ${tag} — новое название`, description: xml('исходная'), base_rev: baseRev },
    })
    expect(third.capitalUpdateStory.description, 'правил один — берётся его версия').toContain('правка первого')
    expect(third.capitalUpdateStory.title).toBe(`Схема ${tag} — новое название`)
    expect(third.capitalUpdateStory.content_rev).toBe(afterFirst.content_rev + 1)

    const revs = await listRevisions(token, 'STORY', storyHash)
    expect(revs[0]).toMatchObject({ rev: afterFirst.content_rev + 1, merged: true })
  })

  it(caseName('cap.rev.break.01', 'правка кооперативного проекта упала в цепи — текст и редакция откатываются'), async () => {
    await ensureCapitalInitialized()
    const chairman = await tokenOf(CHAIRMAN)
    const title = `Откат ${tag}`
    const hash = await createChainProject({ title, description: BASE_TEXT })

    const revsBefore = await listRevisions(chairman, 'PROJECT', hash)
    const before = await getProject(chairman, hash)
    expect(before.content_rev, 'предусловие: у проекта есть первая редакция').toBeGreaterThanOrEqual(1)

    // Строку проекта в цепи убирает сам кооператив — мимо контроллера. В базе
    // она остаётся, поэтому правка через API пройдёт подготовку редакции и
    // упадёт на транзакции editproj («Проект не найден»).
    await transact(COOP_SIGNER, [{ account: 'capital', name: 'delproject', data: { coopname: COOP, project_hash: hash } }])

    const err = await gqlError(chairman, EDIT_PROJECT, editProjectInput(hash, {
      title: `${title} — правка`,
      description: withLine(BASE_TEXT, 1, 'Правка, которая не дошла до цепи'),
      base_rev: before.content_rev,
    }))
    expect(err, 'правка обязана упасть на транзакции цепи').not.toBeNull()

    // Проект в цепи удалён, и карточка его больше не отдаёт; история редакций
    // читается по хешу — по ней видно, чем кончилась неудачная запись.
    const revsAfter = await listRevisions(chairman, 'PROJECT', hash)
    expect(revsAfter.map(r => r.rev), 'снимок несостоявшейся редакции обязан быть удалён').toEqual(revsBefore.map(r => r.rev))
    expect(revsAfter[0].rev, 'текущая редакция — прежняя').toBe(before.content_rev)
    const current = await getRevision(chairman, 'PROJECT', hash, revsAfter[0].rev)
    expect(current.title, 'текст обязан остаться прежним').toBe(title)
    expect(current.description).toBe(BASE_TEXT)

  })
})

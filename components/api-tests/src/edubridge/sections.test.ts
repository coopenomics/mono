/**
 * Разделы и уровни каталога «Образования» снаружи
 * (test-registry/edubridge.sections.yaml, edubridge.catalog.yaml).
 *
 * Раздел — область знаний, уровень — ступень внутри раздела. Курс ссылается на
 * записи справочника, поэтому переименование и порядок меняются один раз для
 * всех курсов. Названия сравниваются без учёта регистра и пробелов по краям.
 *
 * Каждый тест заводит свои разделы со случайным названием: справочник общий
 * для стенда, чужие записи набор не трогает и на их состав не опирается.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, caseName, expectCode, gql, gqlError, tokenOf } from '../core'
import {
  CATALOG_PAGE,
  COURSE,
  CREATE_COURSE,
  SAVE_SECTION,
  UPDATE_COURSE,
  courseInput,
  educationOff,
  educationOn,
  publishCourse,
} from './edubridge.helpers'

const SECTIONS = `query($f:EduSectionsFilterInput){ edubridgeSections(filter:$f){ id title sort_order archived levels{ id section_id title sort_order archived } } }`
const SAVE_LEVEL = 'mutation($d:EduSaveLevelInput!){ edubridgeSaveLevel(data:$d){ id section_id title sort_order archived } }'
const REORDER_LEVELS = 'mutation($d:EduReorderInput!){ edubridgeReorderLevels(data:$d){ id levels{ id title sort_order } } }'
const ARCHIVE_SECTION = 'mutation($d:EduArchiveInput!){ edubridgeArchiveSection(data:$d){ id archived } }'
const ARCHIVE_LEVEL = 'mutation($d:EduArchiveInput!){ edubridgeArchiveLevel(data:$d){ id archived } }'
const COURSE_LINKS = 'query($id:ID!){ edubridgeCourse(id:$id){ id section_id section_title level_id level_title } }'

const unique = (prefix: string) => `${prefix} ${crypto.randomBytes(5).toString('hex')}`

describe('Образование: разделы и уровни каталога', () => {
  let chairman = ''

  const saveSection = async (title: string, id?: string) =>
    (await gql<any>(chairman, SAVE_SECTION, { d: { title, ...(id ? { id } : {}) } })).edubridgeSaveSection
  const saveLevel = async (sectionId: string, title: string, id?: string) =>
    (await gql<any>(chairman, SAVE_LEVEL, { d: { section_id: sectionId, title, ...(id ? { id } : {}) } })).edubridgeSaveLevel
  const sections = async (filter: Record<string, unknown> = {}): Promise<any[]> =>
    (await gql<any>(chairman, SECTIONS, { f: filter })).edubridgeSections
  const sectionOf = async (id: string, filter: Record<string, unknown> = {}) => (await sections(filter)).find(s => s.id === id)

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  it(caseName('edu.sections.happy.01', 'новый раздел встаёт в конец порядка; то же название в другом регистре и с пробелами — прежняя запись; уровень живёт в своём разделе'), async () => {
    const title = unique('Математика')
    const first = await saveSection(title)
    const second = await saveSection(unique('Физика'))
    const all = await sections({ include_archived: true })
    const orderOf = (id: string) => all.find(s => s.id === id).sort_order
    expect(orderOf(second.id)).toBeGreaterThan(orderOf(first.id))
    expect(Math.max(...all.map(s => s.sort_order))).toBe(orderOf(second.id))

    const again = await saveSection(`  ${title.toUpperCase()}  `)
    expect(again.id).toBe(first.id)
    expect((await sections({ include_archived: true })).filter(s => s.title.toLowerCase() === title.toLowerCase())).toHaveLength(1)

    // Одинаково названные уровни двух разделов — разные записи.
    const a = await saveLevel(first.id, '7 класс')
    const b = await saveLevel(second.id, '7 класс')
    expect(a.id).not.toBe(b.id)
    expect(a.section_id).toBe(first.id)
    expect((await saveLevel(first.id, ' 7 КЛАСС ')).id, 'то же название в том же разделе — прежний уровень').toBe(a.id)
    const next = await saveLevel(first.id, '8 класс')
    expect(next.sort_order).toBeGreaterThan(a.sort_order)
  })

  it(caseName('edu.sections.break.01', 'переименование в занятое название и пустое название отклоняются'), async () => {
    const taken = await saveSection(unique('Химия'))
    const other = await saveSection(unique('Биология'))
    expectCode(await gqlError(chairman, SAVE_SECTION, { d: { id: other.id, title: taken.title } }), 'EDUBRIDGE_SECTION_ALREADY_EXISTS')
    expectCode(await gqlError(chairman, SAVE_SECTION, { d: { title: '   ' } }), 'EDUBRIDGE_SECTION_TITLE_EMPTY')

    const l1 = await saveLevel(taken.id, 'Ступень 1')
    const l2 = await saveLevel(taken.id, 'Ступень 2')
    expectCode(await gqlError(chairman, SAVE_LEVEL, { d: { id: l2.id, section_id: taken.id, title: l1.title } }), 'EDUBRIDGE_LEVEL_ALREADY_EXISTS')
    expectCode(await gqlError(chairman, SAVE_LEVEL, { d: { section_id: taken.id, title: '   ' } }), 'EDUBRIDGE_LEVEL_TITLE_EMPTY')

    // Переименование в свободное название проходит, записи прежние.
    const renamed = await saveSection(unique('Естествознание'), other.id)
    expect(renamed.id).toBe(other.id)
    expect((await sectionOf(taken.id)).levels.map((l: any) => l.title)).toEqual(['Ступень 1', 'Ступень 2'])
  })

  it(caseName('edu.sections.happy.02', 'порядок уровней раздела — по присланному списку; неполный список отклоняется'), async () => {
    const section = await saveSection(unique('Языки'))
    const a = await saveLevel(section.id, 'Начальный')
    const b = await saveLevel(section.id, 'Средний')
    const c = await saveLevel(section.id, 'Продвинутый')

    await gql(chairman, REORDER_LEVELS, { d: { section_id: section.id, ids: [c.id, a.id, b.id] } })
    expect((await sectionOf(section.id)).levels.map((l: any) => l.id)).toEqual([c.id, a.id, b.id])

    expectCode(await gqlError(chairman, REORDER_LEVELS, { d: { section_id: section.id, ids: [a.id, b.id] } }), 'EDUBRIDGE_REORDER_INCOMPLETE')
    expect((await sectionOf(section.id)).levels.map((l: any) => l.id), 'порядок прежний').toEqual([c.id, a.id, b.id])
  })

  it(caseName('edu.sections.side.01', 'архивное скрыто, пока не попросили; каталог получает только разделы и уровни с опубликованными курсами'), async () => {
    const withCourse = await saveSection(unique('Музыка'))
    const used = await saveLevel(withCourse.id, 'Первый год')
    const idle = await saveLevel(withCourse.id, 'Второй год')
    const empty = await saveSection(unique('Рисование'))
    await publishCourse(chairman, withCourse.id, 30, { level_id: used.id })

    const forCatalog = await sections({ only_with_courses: true })
    const shown = forCatalog.find(s => s.id === withCourse.id)
    expect(shown, 'раздел с опубликованным курсом виден каталогу').toBeTruthy()
    expect(shown.levels.map((l: any) => l.id)).toEqual([used.id])
    expect(forCatalog.map(s => s.id)).not.toContain(empty.id)

    await gql(chairman, ARCHIVE_LEVEL, { d: { id: idle.id, archived: true } })
    await gql(chairman, ARCHIVE_SECTION, { d: { id: empty.id, archived: true } })
    expect((await sections()).map(s => s.id)).not.toContain(empty.id)
    expect((await sectionOf(withCourse.id)).levels.map((l: any) => l.id)).toEqual([used.id])
    const full = await sections({ include_archived: true })
    expect(full.find(s => s.id === empty.id)?.archived).toBe(true)
    expect(full.find(s => s.id === withCourse.id).levels.find((l: any) => l.id === idle.id)?.archived).toBe(true)

    // Из архива запись возвращается.
    await gql(chairman, ARCHIVE_SECTION, { d: { id: empty.id, archived: false } })
    expect((await sections()).map(s => s.id)).toContain(empty.id)
  })

  it(caseName('edu.sections.break.02', 'курсу не выбрать уровень чужого раздела и архивный раздел; архивное, уже стоящее у курса, при правке остаётся'), async () => {
    const own = await saveSection(unique('История'))
    const ownLevel = await saveLevel(own.id, 'Древний мир')
    const foreign = await saveSection(unique('География'))
    const foreignLevel = await saveLevel(foreign.id, 'Материки')

    expectCode(await gqlError(chairman, CREATE_COURSE, { d: courseInput(own.id, { level_id: foreignLevel.id }) }), 'EDUBRIDGE_LEVEL_NOT_IN_SECTION')
    expectCode(await gqlError(chairman, CREATE_COURSE, { d: courseInput(crypto.randomUUID()) }), 'EDUBRIDGE_SECTION_NOT_IN_CATALOG')

    const input = courseInput(own.id, { level_id: ownLevel.id })
    const course = (await gql<any>(chairman, CREATE_COURSE, { d: input })).edubridgeCreateCourse
    await gql(chairman, ARCHIVE_LEVEL, { d: { id: ownLevel.id, archived: true } })
    await gql(chairman, ARCHIVE_SECTION, { d: { id: own.id, archived: true } })

    expectCode(await gqlError(chairman, CREATE_COURSE, { d: courseInput(own.id) }), 'EDUBRIDGE_SECTION_ARCHIVED')
    // Курс, у которого архивное уже стоит, правится без смены раздела и уровня.
    const updated = (await gql<any>(chairman, UPDATE_COURSE, { d: { ...input, id: course.id, description: 'Правка описания' } })).edubridgeUpdateCourse
    expect(updated.section_id).toBe(own.id)
    const links = (await gql<any>(chairman, COURSE_LINKS, { id: course.id })).edubridgeCourse
    expect(links).toMatchObject({ section_id: own.id, level_id: ownLevel.id })
  })

  it(caseName('edu.sections.happy.03', 'курс хранит ссылки на справочник: переименование раздела и уровня видно в курсе; уровень необязателен'), async () => {
    const section = await saveSection(unique('Литература'))
    const level = await saveLevel(section.id, '9 класс')
    const withLevel = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section.id, { level_id: level.id }) })).edubridgeCreateCourse
    const bare = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section.id) })).edubridgeCreateCourse

    expect((await gql<any>(chairman, COURSE_LINKS, { id: withLevel.id })).edubridgeCourse)
      .toMatchObject({ section_id: section.id, section_title: section.title, level_id: level.id, level_title: '9 класс' })
    expect((await gql<any>(chairman, COURSE_LINKS, { id: bare.id })).edubridgeCourse)
      .toMatchObject({ section_id: section.id, level_id: null, level_title: '' })

    const renamed = unique('Словесность')
    await saveSection(renamed, section.id)
    await saveLevel(section.id, 'Девятый класс', level.id)
    expect((await gql<any>(chairman, COURSE_LINKS, { id: withLevel.id })).edubridgeCourse)
      .toMatchObject({ section_title: renamed, level_title: 'Девятый класс' })
    expect((await gql<any>(chairman, COURSE, { id: bare.id })).edubridgeCourse.section_id).toBe(section.id)
  })

  it(caseName('edu.catalog.side.08', 'курс без уровня виден в разделе каталога, пустого пункта в уровнях раздела нет'), async () => {
    const section = await saveSection(unique('Духовные практики'))
    const level = await saveLevel(section.id, 'Ступень 1')
    const bare = await publishCourse(chairman, section.id, 30)
    const levelled = await publishCourse(chairman, section.id, 30, { level_id: level.id })

    const inSection = (await gql<any>(null, CATALOG_PAGE, { f: { section_id: section.id } })).edubridgeCatalog
    expect((inSection.items as any[]).map(c => c.id).sort()).toEqual([bare.id, levelled.id].sort())
    const inLevel = (await gql<any>(null, CATALOG_PAGE, { f: { section_id: section.id, level_id: level.id } })).edubridgeCatalog
    expect((inLevel.items as any[]).map(c => c.id)).toEqual([levelled.id])

    const filter = (await gql<any>(null, SECTIONS, { f: { only_with_courses: true } })).edubridgeSections as any[]
    const shown = filter.find(s => s.id === section.id)
    expect(shown.levels.map((l: any) => l.title)).toEqual(['Ступень 1'])
    expect(shown.levels.every((l: any) => Boolean(l.id) && Boolean(l.title))).toBe(true)
  })
})

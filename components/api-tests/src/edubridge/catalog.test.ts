/**
 * Форма курса «Образования» снаружи (test-registry/edubridge.catalog.yaml):
 * направление и носитель доступа, привязка к площадке, обложка.
 *
 * Носитель обязан соответствовать направлению: онлайн-платформа — площадки с
 * API, закрытое сообщество — мессенджеры, очное обучение — очный пропуск.
 * Идентификатор курса на площадке нужен только площадкам; у Skillspace это
 * идентификатор курса из реестра школы. Сами площадки набор не зовёт.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, caseName, expectCode, gql, gqlError, tokenOf } from '../core'
import { CREATE_COURSE, UPDATE_COURSE, courseInput, createSection, educationOff, educationOn } from './edubridge.helpers'

const COURSE_CARD = 'query($id:ID!){ edubridgeCourse(id:$id){ id direction carrier external_ref image_url } }'
const PLATFORM_COURSES = 'query($c:EduAccessCarrier!){ edubridgePlatformCourses(carrier:$c){ id name groups{ id name } } }'

/** Прозрачная точка PNG — наименьший настоящий файл изображения. */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('Образование: форма курса — направление, площадка, обложка', () => {
  let chairman = ''
  let section = ''

  const create = (over: Record<string, unknown>) => gqlError(chairman, CREATE_COURSE, { d: courseInput(section, over) })
  const card = async (id: string) => (await gql<any>(chairman, COURSE_CARD, { id })).edubridgeCourse

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    section = await createSection(chairman)
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  it(caseName('edu.catalog.side.03', 'носитель доступа обязан соответствовать направлению курса'), async () => {
    const ref = crypto.randomUUID()
    expectCode(await create({ direction: 'ONLINE_PLATFORM', carrier: 'TELEGRAM' }), 'EDUBRIDGE_COURSE_CARRIER_NOT_ALLOWED')
    expectCode(await create({ direction: 'ONSITE', carrier: 'GETCOURSE', external_ref: 'group-1' }), 'EDUBRIDGE_COURSE_CARRIER_NOT_ALLOWED')
    expectCode(await create({ direction: 'CLOSED_COMMUNITY', carrier: 'SKILLSPACE', external_ref: ref }), 'EDUBRIDGE_COURSE_CARRIER_NOT_ALLOWED')
    expectCode(await create({ direction: 'CLOSED_COMMUNITY', carrier: 'ONSITE' }), 'EDUBRIDGE_COURSE_CARRIER_NOT_ALLOWED')

    // Допустимые пары сохраняются.
    for (const pair of [
      { direction: 'ONLINE_PLATFORM', carrier: 'SKILLSPACE', external_ref: ref },
      { direction: 'ONLINE_PLATFORM', carrier: 'GETCOURSE', external_ref: 'group-1' },
      { direction: 'CLOSED_COMMUNITY', carrier: 'TELEGRAM' },
      { direction: 'CLOSED_COMMUNITY', carrier: 'VK' },
      { direction: 'ONSITE', carrier: 'ONSITE' },
    ]) {
      const saved = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section, pair) })).edubridgeCreateCourse
      expect(await card(saved.id), JSON.stringify(pair)).toMatchObject({ direction: pair.direction, carrier: pair.carrier })
    }
  })

  it(caseName('edu.catalog.side.04', 'площадке нужен идентификатор курса; у очного курса и сообщества он не сохраняется'), async () => {
    expectCode(await create({ direction: 'ONLINE_PLATFORM', carrier: 'GETCOURSE' }), 'EDUBRIDGE_COURSE_PLATFORM_REF_REQUIRED')
    expectCode(await create({ direction: 'ONLINE_PLATFORM', carrier: 'SKILLSPACE', external_ref: '   ' }), 'EDUBRIDGE_COURSE_PLATFORM_REF_REQUIRED')

    const onsite = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section, { external_ref: 'лишний-номер' }) })).edubridgeCreateCourse
    expect((await card(onsite.id)).external_ref).toBe('')
    const community = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section, { direction: 'CLOSED_COMMUNITY', carrier: 'TELEGRAM', external_ref: 'лишний-номер' }) })).edubridgeCreateCourse
    expect((await card(community.id)).external_ref).toBe('')

    // У площадки идентификатор сохраняется без пробелов по краям.
    const platform = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section, { direction: 'ONLINE_PLATFORM', carrier: 'GETCOURSE', external_ref: '  group-7  ' }) })).edubridgeCreateCourse
    expect((await card(platform.id)).external_ref).toBe('group-7')
  })

  it(caseName('edu.catalog.side.06', 'привязка к Skillspace принимает только идентификатор курса из реестра школы; у остальных носителей списка курсов площадки нет'), async () => {
    const skillspace = (ref: string) => create({ direction: 'ONLINE_PLATFORM', carrier: 'SKILLSPACE', external_ref: ref })
    // Числовой номер из адреса конструктора, идентификатор с опечаткой, группа не идентификатором.
    expectCode(await skillspace('184467'), 'EDUBRIDGE_COURSE_SKILLSPACE_REF_INVALID')
    expectCode(await skillspace(`${crypto.randomUUID().slice(0, -1)}z`), 'EDUBRIDGE_COURSE_SKILLSPACE_REF_INVALID')
    expectCode(await skillspace(`${crypto.randomUUID()}:группа-1`), 'EDUBRIDGE_COURSE_SKILLSPACE_REF_INVALID')

    for (const carrier of ['GETCOURSE', 'ONSITE', 'TELEGRAM'])
      expect((await gql<any>(chairman, PLATFORM_COURSES, { c: carrier })).edubridgePlatformCourses, carrier).toEqual([])
  })

  it(caseName('edu.catalog.side.07', 'обложка курса: загрузка, сохранение без изменений, удаление и отказы'), async () => {
    const input = courseInput(section)
    const created = (await gql<any>(chairman, CREATE_COURSE, { d: { ...input, image: { base64: PNG, mime_type: 'image/png' } } })).edubridgeCreateCourse
    const withImage = await card(created.id)
    expect(withImage.image_url, 'у курса есть адрес обложки').toBeTruthy()

    // Правка без поля обложки её не меняет.
    await gql(chairman, UPDATE_COURSE, { d: { ...input, id: created.id, description: 'Описание поправлено' } })
    expect((await card(created.id)).image_url).toBeTruthy()

    // Чужой ключ хранилища и пустое изображение отклоняются до хранилища.
    const update = (image: unknown) => gqlError(chairman, UPDATE_COURSE, { d: { ...input, id: created.id, image } })
    expectCode(await update({ bucket_key: `edubridge/images/${crypto.randomBytes(8).toString('hex')}.png` }), 'EDUBRIDGE_COURSE_IMAGE_KEY_FOREIGN')
    expectCode(await update({}), 'EDUBRIDGE_COURSE_IMAGE_EMPTY')
    expectCode(await update({ base64: PNG }), 'EDUBRIDGE_COURSE_IMAGE_EMPTY')
    expectCode(await update({ base64: PNG, mime_type: 'application/pdf' }), 'EDUBRIDGE_COURSE_IMAGE_TYPE_UNSUPPORTED')
    expect((await card(created.id)).image_url, 'после отказов обложка прежняя').toBeTruthy()

    // null убирает обложку.
    await gql(chairman, UPDATE_COURSE, { d: { ...input, id: created.id, image: null } })
    expect((await card(created.id)).image_url).toBeNull()
  })
})

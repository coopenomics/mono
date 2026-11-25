/**
 * Поздравления: шаблоны председателя и предпросмотр письма
 * (test-registry/greetings.birthday.yaml).
 *
 * Председатель пишет шаблон поздравления с периодом действия и переменными,
 * включает его в рассылку и проверяет письмо на пайщике. Приложение видит
 * только председатель: члены совета и пайщики получают отказ (решение
 * владельца 25.11.2026).
 *
 * Период теста — далёкий будущий год: рассылка стенда его шаблоны не берёт.
 * Набор удаляет за собой созданные шаблоны.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COUNCIL, ROLES, caseName, expectCode, gql, gqlError, tokenOf } from '../core'

const TEMPLATE = 'id title period_start period_end subject body status created_by'
const SAVE = `mutation($d:GreetingTemplateInput!){ greetingsSaveTemplate(data:$d){ ${TEMPLATE} } }`
const STATUS = `mutation($id:String!,$s:GreetingTemplateStatus!){ greetingsSetTemplateStatus(id:$id, status:$s){ ${TEMPLATE} } }`
const DELETE = 'mutation($id:String!){ greetingsDeleteTemplate(id:$id) }'
const LIST = `query{ greetingsTemplates{ ${TEMPLATE} } }`
const VARIABLES = 'query{ greetingsVariables{ variable token description } }'
const PREVIEW = 'query($d:GreetingPreviewInput!){ greetingsPreview(data:$d){ username displayName age subject bodyHtml unknownVariables } }'
const UPCOMING = 'query{ greetingsUpcoming(limit:5){ username displayName date age } }'

const YEAR = 2041

let chairman = ''
let council = ''
let member = ''
const created: string[] = []

async function save(data: Record<string, unknown>): Promise<any> {
  const d = await gql<any>(chairman, SAVE, { d: data })
  if (!created.includes(d.greetingsSaveTemplate.id))
    created.push(d.greetingsSaveTemplate.id)
  return d.greetingsSaveTemplate
}

const yearTemplate = (title: string) => ({
  title,
  period_start: `${YEAR}-01-01`,
  period_end: `${YEAR}-12-31`,
  subject: '{{Обращение}}, с днём рождения!',
  body: '{{Обращение}}, {{Кооператив}} поздравляет вас с {{Летие}}.',
})

beforeAll(async () => {
  chairman = await tokenOf(CHAIRMAN)
  council = await tokenOf(COUNCIL)
  member = await tokenOf(ROLES.member())
})

afterAll(async () => {
  for (const id of created)
    await gqlError(chairman, DELETE, { id })
})

describe('поздравления: шаблоны', () => {
  it(caseName('grt.tpl.happy.01', 'председатель сохраняет черновик шаблона и видит его в списке'), async () => {
    const draft = await save(yearTemplate('Поздравление на 2041 год'))
    expect(draft.status).toBe('DRAFT')
    expect(draft.created_by).toBe(CHAIRMAN.account)
    const d = await gql<any>(chairman, LIST)
    expect((d.greetingsTemplates as any[]).some(t => t.id === draft.id)).toBe(true)
  })

  it(caseName('grt.tpl.happy.02', 'шаблон включается в рассылку и возвращается в черновики'), async () => {
    const draft = await save(yearTemplate('Поздравление для включения'))
    const on = await gql<any>(chairman, STATUS, { id: draft.id, s: 'ACTIVE' })
    expect(on.greetingsSetTemplateStatus.status).toBe('ACTIVE')
    const off = await gql<any>(chairman, STATUS, { id: draft.id, s: 'DRAFT' })
    expect(off.greetingsSetTemplateStatus.status).toBe('DRAFT')
  })

  it(caseName('grt.tpl.side.01', 'шаблон с неизвестной переменной не включается'), async () => {
    const draft = await save({ ...yearTemplate('Поздравление с опечаткой'), body: 'Здравствуйте, {{Отчетсво}}!' })
    expectCode(await gqlError(chairman, STATUS, { id: draft.id, s: 'ACTIVE' }), 'GREETINGS_TEMPLATE_UNKNOWN_VARIABLES')
  })

  it(caseName('grt.tpl.side.02', 'второй действующий шаблон с тем же периодом не включается'), async () => {
    const first = await save({ ...yearTemplate('Первый на период'), period_start: `${YEAR}-06-01`, period_end: `${YEAR}-06-30` })
    const second = await save({ ...yearTemplate('Второй на период'), period_start: `${YEAR}-06-01`, period_end: `${YEAR}-06-30` })
    await gql<any>(chairman, STATUS, { id: first.id, s: 'ACTIVE' })
    expectCode(await gqlError(chairman, STATUS, { id: second.id, s: 'ACTIVE' }), 'GREETINGS_TEMPLATE_PERIOD_TAKEN')
  })

  it(caseName('grt.tpl.side.03', 'период с началом позже окончания отклоняется'), async () => {
    const err = await gqlError(chairman, SAVE, { d: { ...yearTemplate('Неверный период'), period_start: `${YEAR}-12-31`, period_end: `${YEAR}-01-01` } })
    expectCode(err, 'GREETINGS_TEMPLATE_PERIOD_INVALID')
  })

  it(caseName('grt.tpl.side.04', 'член совета и пайщик не читают и не пишут шаблоны'), async () => {
    expectCode(await gqlError(council, LIST), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(council, SAVE, { d: yearTemplate('Шаблон совета') }), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(member, LIST), 'KIT_INSUFFICIENT_RIGHTS')
  })
})

describe('поздравления: предпросмотр', () => {
  it(caseName('grt.prv.happy.01', 'переменные шаблона перечислены словами для вставки'), async () => {
    const d = await gql<any>(chairman, VARIABLES)
    const tokens = (d.greetingsVariables as any[]).map(v => v.token)
    expect(tokens).toEqual(expect.arrayContaining(['Фамилия', 'Имя', 'Отчество', 'Обращение', 'Возраст', 'Летие', 'Кооператив', 'Председатель']))
  })

  it(caseName('grt.prv.happy.02', 'письмо строится на ближайшем имениннике с подставленными переменными'), async () => {
    const upcoming = await gql<any>(chairman, UPCOMING)
    const nearest = (upcoming.greetingsUpcoming as any[])[0]
    expect(nearest, 'у засеянных пайщиков стенда есть даты рождения').toBeTruthy()
    const d = await gql<any>(chairman, PREVIEW, { d: { subject: '{{Обращение}}, поздравляем!', body: '**{{Фамилия}}** — {{Возраст}}. {{Неизвестная}}' } })
    const preview = d.greetingsPreview
    expect(preview.username).toBe(nearest.username)
    expect(preview.subject).not.toContain('{{')
    expect(preview.bodyHtml).toContain('<strong>')
    expect(preview.bodyHtml).toContain(`${preview.age}`)
    expect(preview.unknownVariables).toEqual(['Неизвестная'])
  })

  it(caseName('grt.prv.side.01', 'HTML в тексте шаблона в письмо не попадает'), async () => {
    const d = await gql<any>(chairman, PREVIEW, { d: { subject: 'Тема', body: '<script>alert(1)</script>Текст' } })
    expect(d.greetingsPreview.bodyHtml).not.toContain('<script>')
  })
})

/**
 * Отчётность: черновики форм и отметки календаря
 * (test-registry/reports.drafts-calendar.yaml).
 *
 * Председатель правит форму отчёта и сохраняет черновик: один на отчёт, год
 * и период. При следующем открытии форма собирается заново из учёта и
 * реквизитов, а поверх ложатся только поля, которые он правил руками. Ячейку
 * календаря можно отметить «сдан вне платформы» или «не требуется»; черновик
 * красит ячейку «в работе».
 *
 * Год теста — далёкий будущий: ячейки календаря в нём пустые, чужие наборы
 * отчётности его не трогают. Набор убирает за собой черновики и отметки.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COUNCIL, ROLES, caseName, expectCode, gql, gqlError, tokenOf } from '../core'

const DRAFT = 'id ownerUsername reportType year period editsJson editedFields createdAt updatedAt'
const SAVE = `mutation($i:SaveReportDraftInput!){ saveReportDraft(input:$i){ ${DRAFT} } }`
const GET = `query($t:ReportType!,$y:Int!,$p:Int){ getReportDraft(reportType:$t, year:$y, period:$p){ ${DRAFT} } }`
const LIST = `query($f:ListReportDraftsFilterInput){ listReportDrafts(filter:$f){ ${DRAFT} } }`
const DELETE = 'mutation($id:String!){ deleteReportDraft(id:$id) }'
const BUILD = 'query($t:ReportType!,$y:Int!,$p:Int){ buildInitialReportEdits(reportType:$t, year:$y, period:$p){ editsJson editedFields hasDraft } }'
const CALENDAR = 'query($y:Int!){ getReportCalendar(year:$y){ reportType periodKind periods{ periodCode reportYear status label } } }'
const MARK = 'mutation($d:MarkReportPeriodInput!){ markReportPeriod(data:$d) }'

const YEAR = 2031
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

let chairman = ''
let council = ''
let member = ''
/** Квартальная ячейка расчёта по взносам, отчётный год которой совпадает с годом теста. */
let cell: { periodCode: number, reportYear: number }
const draftIds: string[] = []

async function cellStatus(): Promise<string> {
  const d = await gql<any>(chairman, CALENDAR, { y: YEAR })
  const row = (d.getReportCalendar as any[]).find(r => r.reportType === 'RSV')
  return row.periods.find((p: any) => p.periodCode === cell.periodCode && p.reportYear === cell.reportYear).status
}

async function mark(value: string | null): Promise<void> {
  const d = await gql<any>(chairman, MARK, { d: { reportType: 'RSV', year: cell.reportYear, period: cell.periodCode, mark: value } })
  expect(d.markReportPeriod).toBe(true)
}

async function save(input: Record<string, unknown>): Promise<any> {
  const d = await gql<any>(chairman, SAVE, { i: input })
  if (!draftIds.includes(d.saveReportDraft.id))
    draftIds.push(d.saveReportDraft.id)
  return d.saveReportDraft
}

beforeAll(async () => {
  chairman = await tokenOf(CHAIRMAN)
  council = await tokenOf(COUNCIL)
  member = await tokenOf(ROLES.member())
  const d = await gql<any>(chairman, CALENDAR, { y: YEAR })
  const row = (d.getReportCalendar as any[]).find(r => r.reportType === 'RSV')
  cell = row.periods.find((p: any) => p.reportYear === YEAR)
  expect(cell, 'у расчёта по взносам есть ячейка за год теста').toBeTruthy()
})

afterAll(async () => {
  for (const id of draftIds)
    await gqlError(chairman, DELETE, { id })
  if (cell)
    await gqlError(chairman, MARK, { d: { reportType: 'RSV', year: cell.reportYear, period: cell.periodCode, mark: null } })
})

describe('Отчётность — черновики форм', () => {
  it(caseName('rep.draft.happy.01', 'черновик формы сохраняется и читается по отчёту, году и периоду'), async () => {
    expect((await gql<any>(chairman, GET, { t: 'BUHOTCH', y: YEAR, p: null })).getReportDraft, 'до сохранения черновика нет').toBeNull()

    const saved = await save({
      reportType: 'BUHOTCH',
      year: YEAR,
      editsJson: JSON.stringify({ signer: { lastName: 'Черновиков' } }),
      editedFields: ['signer.lastName'],
    })
    expect(saved).toMatchObject({ ownerUsername: CHAIRMAN.account, reportType: 'BUHOTCH', year: YEAR, period: null, editedFields: ['signer.lastName'] })
    expect(JSON.parse(saved.editsJson)).toEqual({ signer: { lastName: 'Черновиков' } })

    const stored = (await gql<any>(chairman, GET, { t: 'BUHOTCH', y: YEAR, p: null })).getReportDraft
    expect(stored.id).toBe(saved.id)
    expect(JSON.parse(stored.editsJson)).toEqual({ signer: { lastName: 'Черновиков' } })
  })

  it(caseName('rep.draft.happy.02', 'повторное сохранение обновляет тот же черновик, а не заводит второй'), async () => {
    const first = (await gql<any>(chairman, GET, { t: 'BUHOTCH', y: YEAR, p: null })).getReportDraft
    const second = await save({
      reportType: 'BUHOTCH',
      year: YEAR,
      editsJson: JSON.stringify({ signer: { lastName: 'Правкин', firstName: 'Пётр' } }),
      editedFields: ['signer.lastName', 'signer.firstName'],
    })
    expect(second.id).toBe(first.id)
    expect(second.editedFields).toEqual(['signer.lastName', 'signer.firstName'])

    const listed = (await gql<any>(chairman, LIST, { f: { reportType: 'BUHOTCH', year: YEAR } })).listReportDrafts
    expect(listed.map((d: any) => d.id)).toEqual([first.id])
  })

  it(caseName('rep.draft.happy.03', 'форма собирается из учёта, поверх ложатся только правленые поля черновика'), async () => {
    const withDraft = (await gql<any>(chairman, BUILD, { t: 'BUHOTCH', y: YEAR, p: null })).buildInitialReportEdits
    expect(withDraft.hasDraft).toBe(true)
    expect(withDraft.editedFields).toEqual(['signer.lastName', 'signer.firstName'])
    const merged = JSON.parse(withDraft.editsJson)
    expect(merged.signer.lastName).toBe('Правкин')
    expect(merged.signer.firstName).toBe('Пётр')
    expect(merged.balance, 'остальное собрано из учёта').toBeTruthy()

    // Соседний год без черновика: форма только из учёта и реквизитов.
    const clean = (await gql<any>(chairman, BUILD, { t: 'BUHOTCH', y: YEAR + 1, p: null })).buildInitialReportEdits
    expect(clean.hasDraft).toBe(false)
    expect(clean.editedFields).toEqual([])
    expect(JSON.parse(clean.editsJson).signer.lastName).not.toBe('Правкин')
  })

  it(caseName('rep.draft.side.01', 'черновики разных периодов и отчётов не смешиваются; список фильтруется'), async () => {
    // Форма 4-ФСС: ячейку календаря расчёта по взносам эти черновики не красят.
    const q1 = await save({ reportType: 'FSS4', year: YEAR, period: 1, editsJson: '{"header":{}}', editedFields: [] })
    const q2 = await save({ reportType: 'FSS4', year: YEAR, period: 2, editsJson: '{"header":{}}', editedFields: [] })
    expect(q2.id).not.toBe(q1.id)

    const fss = (await gql<any>(chairman, LIST, { f: { reportType: 'FSS4', year: YEAR } })).listReportDrafts
    expect(fss.map((d: any) => d.id).sort()).toEqual([q1.id, q2.id].sort())
    const onePeriod = (await gql<any>(chairman, LIST, { f: { reportType: 'FSS4', year: YEAR, period: 2 } })).listReportDrafts
    expect(onePeriod.map((d: any) => d.id)).toEqual([q2.id])
    const year = (await gql<any>(chairman, LIST, { f: { year: YEAR } })).listReportDrafts
    expect(year.length).toBe(3)
  })

  it(caseName('rep.draft.side.02', 'битый JSON правок — отказ, черновик не меняется'), async () => {
    expectCode(
      await gqlError(chairman, SAVE, { i: { reportType: 'BUHOTCH', year: YEAR, editsJson: '{не json', editedFields: [] } }),
      'REPORTS_EDITS_JSON_INVALID',
    )
    const stored = (await gql<any>(chairman, GET, { t: 'BUHOTCH', y: YEAR, p: null })).getReportDraft
    expect(JSON.parse(stored.editsJson).signer.lastName).toBe('Правкин')
  })

  it(caseName('rep.draft.side.03', 'черновики ведёт только председатель — члену совета и пайщику отказ'), async () => {
    const input = { i: { reportType: 'BUHOTCH', year: YEAR, editsJson: '{}', editedFields: [] } }
    for (const token of [council, member]) {
      expectCode(await gqlError(token, SAVE, input), 'KIT_INSUFFICIENT_RIGHTS')
      expectCode(await gqlError(token, LIST, { f: { year: YEAR } }), 'KIT_INSUFFICIENT_RIGHTS')
      expectCode(await gqlError(token, BUILD, { t: 'BUHOTCH', y: YEAR, p: null }), 'KIT_INSUFFICIENT_RIGHTS')
    }
  })

  it(caseName('rep.draft.side.04', 'удаление черновика: удалённый не читается, несуществующий — отказ «не найдено»'), async () => {
    const doomed = (await gql<any>(chairman, GET, { t: 'FSS4', y: YEAR, p: 1 })).getReportDraft
    expect((await gql<any>(chairman, DELETE, { id: doomed.id })).deleteReportDraft).toBe(true)
    expect((await gql<any>(chairman, GET, { t: 'FSS4', y: YEAR, p: 1 })).getReportDraft).toBeNull()

    expect(await gqlError(chairman, DELETE, { id: doomed.id }), 'повторное удаление').not.toBeNull()
    expect(await gqlError(chairman, DELETE, { id: UNKNOWN_ID }), 'несуществующий черновик').not.toBeNull()
  })
})

describe('Отчётность — отметки календаря', () => {
  it(caseName('rep.cal.happy.01', 'отметка «сдан вне платформы» красит ячейку, снятие отметки возвращает прежний вид'), async () => {
    const before = await cellStatus()
    expect(['EMPTY', 'NO_DATA', 'BEFORE_REGISTRATION', 'OVERDUE']).toContain(before)

    await mark('SUBMITTED_EXTERNALLY')
    expect(await cellStatus()).toBe('SUBMITTED_EXTERNALLY')
    await mark('SUBMITTED_EXTERNALLY')
    expect(await cellStatus(), 'повтор отметки ничего не меняет').toBe('SUBMITTED_EXTERNALLY')

    await mark(null)
    expect(await cellStatus()).toBe(before)
    await mark(null)
    expect(await cellStatus(), 'снятие отсутствующей отметки — без ошибки').toBe(before)
  })

  it(caseName('rep.cal.happy.02', 'отметка «не требуется» видна на ячейке; черновик по тому же периоду её перекрывает'), async () => {
    await mark('NOT_REQUIRED')
    expect(await cellStatus()).toBe('NOT_REQUIRED')

    await save({ reportType: 'RSV', year: cell.reportYear, period: cell.periodCode, editsJson: '{"header":{}}', editedFields: [] })
    expect(await cellStatus(), 'есть черновик — ячейка «в работе»').toBe('DRAFT')

    await mark('SUBMITTED_EXTERNALLY')
    expect(await cellStatus(), '«сдан вне платформы» важнее черновика').toBe('SUBMITTED_EXTERNALLY')
  })

  it(caseName('rep.cal.side.01', 'отметки ставит только председатель; календарь читает и член совета'), async () => {
    expect(await gqlError(council, CALENDAR, { y: YEAR }), 'совет читает календарь').toBeNull()
    expectCode(await gqlError(member, CALENDAR, { y: YEAR }), 'KIT_INSUFFICIENT_RIGHTS')
    for (const token of [council, member]) {
      expectCode(
        await gqlError(token, MARK, { d: { reportType: 'RSV', year: cell.reportYear, period: cell.periodCode, mark: null } }),
        'KIT_INSUFFICIENT_RIGHTS',
      )
    }
    expect(await cellStatus(), 'чужой запрос отметку не снял').toBe('SUBMITTED_EXTERNALLY')
  })
})

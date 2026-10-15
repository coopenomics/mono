/**
 * Благорост: таймер учёта времени по задаче
 * (test-registry/capital.time-tracking.yaml).
 *
 * У участника не больше одной открытой сессии. Старт на другой задаче
 * закрывает прежнюю сессию; пауза останавливает счёт, не отвязывая задачу;
 * остановка закрывает сессию и, если набежало время, заводит запись факта по
 * задаче таймера. Вести время можно только от своего имени и только
 * исполнителю задачи.
 *
 * Мир теста: свежий участник Благороста с личным проектом и двумя задачами,
 * где он исполнитель. Личный проект суточным лимитом не ограничен.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COOP, ROLES, caseName, expectCode, gql, gqlError, gqlRaw, tokenOf } from '../core'
import { createIssue, createLocalProject, tag } from './cap-access.helpers'
import { capitalMember, ensureCapitalProgram } from './cap-results.helpers'

const SESSION = '_id contributor_hash coopname issue_hash issue_title project_hash started_at stopped_at paused_at total_paused_ms is_paused elapsed_seconds'
const ENTRY = '_id contributor_hash issue_hash project_hash date hours is_committed entry_type'

const START = `mutation($d:CapitalStartTimerInput!){ capitalStartTimer(data:$d){ ${SESSION} } }`
const PAUSE = `mutation($d:CapitalPauseTimerInput!){ capitalPauseTimer(data:$d){ ${SESSION} } }`
const RESUME = `mutation($d:CapitalResumeTimerInput!){ capitalResumeTimer(data:$d){ ${SESSION} } }`
const STOP = `mutation($d:CapitalStopTimerInput!){ capitalStopTimer(data:$d){ ${ENTRY} } }`
const OPEN = `query($d:CapitalGetOpenTimerInput!){ capitalGetOpenTimer(data:$d){ ${SESSION} } }`
const WORKLOG = `mutation($d:CapitalAddWorklogInput!){ capitalAddWorklog(data:$d){ ${ENTRY} } }`
const ENTRIES = `query($f:CapitalTimeEntriesFilter,$o:PaginationInput){ capitalTimeEntries(filter:$f, options:$o){ totalCount items{ ${ENTRY} } } }`

/** Час округляется до сотых: запись факта появляется с восемнадцатой секунды сессии. */
const ENOUGH_FOR_ENTRY_MS = 22_000

let member: Who
let token = ''
let project: any
let first: any
let second: any

function me(): { coopname: string, username: string } {
  return { coopname: COOP, username: member.account }
}

async function openTimer(): Promise<any | null> {
  return (await gql<any>(token, OPEN, { d: me() })).capitalGetOpenTimer
}

async function entriesOf(issueHash: string): Promise<any[]> {
  const d = await gql<any>(token, ENTRIES, { f: { issue_hash: issueHash }, o: { page: 1, limit: 50 } })
  return d.capitalTimeEntries.items
}

beforeAll(async () => {
  await ensureCapitalProgram()
  member = await capitalMember('ctm')
  token = await tokenOf(member)
  const T = tag('timer')
  project = await createLocalProject(member, `Таймер ${T}`)
  first = await createIssue(member, { title: `Первая задача ${T}`, project_hash: project.project_hash, creators: [member.account] })
  second = await createIssue(member, { title: `Вторая задача ${T}`, project_hash: project.project_hash, creators: [member.account] })
}, 600_000)

describe('Благорост — таймер учёта времени', () => {
  it(caseName('cap.time.happy.10', 'старт таймера открывает сессию на задаче; повторный старт на той же задаче её не удваивает'), async () => {
    expect(await openTimer(), 'до старта открытой сессии нет').toBeNull()

    const started = (await gql<any>(token, START, { d: { ...me(), issue_hash: first.issue_hash } })).capitalStartTimer
    expect(started).toMatchObject({
      coopname: COOP,
      issue_hash: first.issue_hash,
      issue_title: first.title,
      project_hash: project.project_hash,
      stopped_at: null,
      paused_at: null,
      is_paused: false,
      total_paused_ms: 0,
    })

    const again = (await gql<any>(token, START, { d: { ...me(), issue_hash: first.issue_hash } })).capitalStartTimer
    expect(again._id, 'та же сессия').toBe(started._id)
    expect((await openTimer())?._id).toBe(started._id)
  })

  it(caseName('cap.time.happy.11', 'пауза останавливает счёт, продолжение копит время паузы; обе операции повторяются без последствий'), async () => {
    const paused = (await gql<any>(token, PAUSE, { d: me() })).capitalPauseTimer
    expect(paused.is_paused).toBe(true)
    expect(paused.paused_at).toBeTruthy()
    expect(paused.issue_hash, 'задача остаётся привязанной').toBe(first.issue_hash)
    const pausedAgain = (await gql<any>(token, PAUSE, { d: me() })).capitalPauseTimer
    expect(pausedAgain.paused_at, 'повторная пауза момент паузы не сдвигает').toBe(paused.paused_at)

    const resumed = (await gql<any>(token, RESUME, { d: me() })).capitalResumeTimer
    expect(resumed).toMatchObject({ _id: paused._id, is_paused: false, paused_at: null })
    expect(resumed.total_paused_ms).toBeGreaterThanOrEqual(0)
    const resumedAgain = (await gql<any>(token, RESUME, { d: me() })).capitalResumeTimer
    expect(resumedAgain.total_paused_ms, 'повторное продолжение паузу не досчитывает').toBe(resumed.total_paused_ms)
  })

  it(caseName('cap.time.break.04', 'старт на другой задаче закрывает прежнюю сессию — открытой остаётся одна, на новой задаче'), async () => {
    const before = await openTimer()
    const switched = (await gql<any>(token, START, { d: { ...me(), issue_hash: second.issue_hash } })).capitalStartTimer
    expect(switched._id).not.toBe(before._id)
    expect(switched.issue_hash).toBe(second.issue_hash)
    expect(switched.stopped_at).toBeNull()

    const open = await openTimer()
    expect(open?._id, 'открыта только новая сессия').toBe(switched._id)
    expect(open?.issue_title).toBe(second.title)
  })

  it(caseName('cap.time.happy.12', 'остановка закрывает сессию и заводит запись факта по задаче таймера'), async () => {
    // timing: timeout — сессия должна набрать время, которое округлится до сотой часа
    await new Promise(r => setTimeout(r, ENOUGH_FOR_ENTRY_MS))
    const entry = (await gql<any>(token, STOP, { d: me() })).capitalStopTimer
    expect(entry, 'набежавшее время стало записью факта').not.toBeNull()
    expect(entry).toMatchObject({
      issue_hash: second.issue_hash,
      project_hash: project.project_hash,
      is_committed: false,
      date: new Date().toISOString().slice(0, 10),
    })
    expect(entry.hours).toBeGreaterThan(0)
    expect(entry.hours).toBeLessThan(0.1)

    expect(await openTimer()).toBeNull()
    const listed = await entriesOf(second.issue_hash)
    expect(listed.map(e => e._id)).toContain(entry._id)
  }, 60_000)

  it(caseName('cap.time.break.05', 'без открытой сессии пауза и продолжение — отказ, остановка отвечает пусто; повторная остановка ничего не заводит'), async () => {
    expectCode(await gqlError(token, PAUSE, { d: me() }), 'CAPITAL_TIMER_NOT_ACTIVE')
    expectCode(await gqlError(token, RESUME, { d: me() }), 'CAPITAL_TIMER_NOT_ACTIVE')

    const before = (await entriesOf(second.issue_hash)).length
    const stopped = await gqlRaw<any>(token, STOP, { d: me() })
    expect(stopped.errors).toEqual([])
    expect(stopped.data.capitalStopTimer).toBeNull()
    expect((await entriesOf(second.issue_hash)).length).toBe(before)
  })

  it(caseName('cap.time.break.06', 'таймер и запись времени ведутся только от своего имени — чужому пайщику отказ'), async () => {
    const strangerToken = await tokenOf(ROLES.member())
    expectCode(await gqlError(strangerToken, START, { d: { ...me(), issue_hash: first.issue_hash } }), 'CAPITAL_TIME_TRACKING_SELF_ONLY')
    expectCode(await gqlError(strangerToken, STOP, { d: me() }), 'CAPITAL_TIME_TRACKING_SELF_ONLY')
    expectCode(await gqlError(strangerToken, PAUSE, { d: me() }), 'CAPITAL_TIME_TRACKING_SELF_ONLY')
    expect(await openTimer(), 'чужой запрос сессию не открыл').toBeNull()
  })

  it(caseName('cap.time.break.07', 'таймер по задаче, которой нет, не стартует'), async () => {
    expectCode(await gqlError(token, START, { d: { ...me(), issue_hash: 'f'.repeat(64) } }), 'CAPITAL_ISSUE_NOT_FOUND')
    expect(await openTimer()).toBeNull()
  })

  it(caseName('cap.time.break.03', 'запись времени с нулём, отрицательным и нечисловым значением часов — отказ, запись не создаётся'), async () => {
    const before = (await entriesOf(first.issue_hash)).length
    for (const hours of [0, -1]) {
      // Ноль и отрицательное отсекает проверка ввода (не меньше 0,01 часа) — раньше доменного правила.
      const err = await gqlError(token, WORKLOG, { d: { ...me(), issue_hash: first.issue_hash, hours } })
      expect(['422', 'CAPITAL_TIME_HOURS_NOT_POSITIVE'], JSON.stringify(err)).toContain(String(err?.code))
    }
    const text = await gqlRaw<any>(token, WORKLOG, { d: { ...me(), issue_hash: first.issue_hash, hours: 'два' } })
    expect(text.errors.length, 'нечисловое значение отклонено').toBeGreaterThan(0)
    expect((await entriesOf(first.issue_hash)).length).toBe(before)
  })
})

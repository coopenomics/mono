/**
 * Робот решений совета снаружи (test-registry/soviet.robot.yaml).
 *
 * Члены совета делегируют роботу голос — «сразу» либо «вслед за» другим
 * членом совета, — председатель делегирует подпись протокола. Проверяется на
 * решениях о выходе пайщика: предустановка стенда их не автоматизирует, и
 * остальные наборы от этого набора не зависят. Делегирования пишутся
 * действием цепи soviet::automate (как из рабочего стола), исход читается из
 * журнала и реестра робота и из таблицы решений цепи.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import {
  CHAIRMAN,
  COOP,
  automateMember,
  awaitDecision,
  caseName,
  declineDecisionOnChain,
  freshMember,
  gql,
  payOutExit,
  presetDecisionTypes,
  requestExit,
  restoreRobotPreset,
  sovietBoard,
  tableRows,
  tokenOf,
  voteOnDecision,
  waitFor,
} from '../core'

const TYPE = 'leavecoop'

const JOURNAL = `query($o:PaginationInput){ sovietRobotJournal(options:$o){ items{
  decision_id decision_type stage waiting_for attempts last_error votes{ member tx_id at } } } }`
const REGISTRY = `query{ sovietRobotRegistry{ type warnings my_mode
  chairman{ delegated has_key username }
  voters{ member mode follow has_key }
  vote_quorum{ delegated_count required_count total_members reachable reached follow_groups{ follow count } } } }`

interface Delegation { vote?: boolean, follow?: string, authorize?: boolean }

let chairman = ''
let boardId = 0
let council: string[] = []

/** Делегирование члена совета: предустановка стенда плюс режим по решениям о выходе. */
async function automate(member: string, d: Delegation = {}): Promise<void> {
  const preset = presetDecisionTypes()
  await automateMember(boardId, member, {
    vote_types: [...preset, ...(d.vote ? [TYPE] : [])],
    follow_rules: d.follow ? [{ decision_type: TYPE, follow: d.follow }] : [],
    authorize_types: member === CHAIRMAN.account ? [...preset, ...(d.authorize ? [TYPE] : [])] : [],
  })
}

/** Режимы всего совета разом; не названный член совета по выходам не делегирует ничего. */
async function delegations(map: Record<string, Delegation>): Promise<void> {
  for (const member of council)
    await automate(member, map[member] ?? {})
}

async function registry(): Promise<any> {
  const d = await gql<any>(chairman, REGISTRY)
  return (d.sovietRobotRegistry as any[]).find(t => t.type === TYPE)
}

async function journal(decisionId: number): Promise<any | undefined> {
  const d = await gql<any>(chairman, JOURNAL, { o: { page: 1, limit: 50, sortOrder: 'DESC' } })
  return (d.sovietRobotJournal.items as any[]).find(e => Number(e.decision_id) === decisionId)
}

async function journalAt(decisionId: number, stages: string[], label: string): Promise<any> {
  return waitFor(async () => {
    const entry = await journal(decisionId)
    return entry && stages.includes(entry.stage) ? entry : null
  }, { timeoutMs: 120_000, intervalMs: 1_000, label })
}

async function chainDecision(decisionId: number): Promise<any | undefined> {
  return (await tableRows<any>('soviet', COOP, 'decisions')).find(d => Number(d.id) === decisionId)
}

/** Заявление на выход свежего пайщика — повод для решения совета. */
async function exitDecision(prefix: string): Promise<{ member: Who, exitHash: string, id: number }> {
  const member = freshMember({ prefix })
  const exitHash = await requestExit(member, false)
  const decision = await awaitDecision(exitHash)
  return { member, exitHash, id: Number(decision.id) }
}

async function votesFor(decisionId: number, expected: string[], label: string): Promise<string[]> {
  return waitFor(async () => {
    const votes = [...((await chainDecision(decisionId))?.votes_for ?? [])].sort()
    return expected.every(m => votes.includes(m)) ? votes : null
  }, { timeoutMs: 120_000, intervalMs: 1_000, label })
}

describe('робот решений совета: кворум, повтор голоса и протокол', () => {
  beforeAll(async () => {
    chairman = await tokenOf(CHAIRMAN)
    const board = await sovietBoard()
    boardId = board.id
    council = [board.chairman, ...board.voters]
    expect(council, 'набору нужен расширенный совет стенда').toEqual(expect.arrayContaining(['ant', 'petr', 'anna', 'mikhail', 'olga']))
  })

  afterAll(async () => {
    await restoreRobotPreset()
  })

  it(caseName('sov.rob.side.10', 'кворум без ручных голосов недостижим — робот голосует за делегировавших, ждёт людей и дожимает протокол после кворума'), async () => {
    await delegations({ petr: { vote: true }, anna: { vote: true }, ant: { authorize: true } })

    // sov.rob.side.14: реестр считает голоса «сразу» и видит, что кворума нет.
    const type = await registry()
    expect(type.vote_quorum).toMatchObject({ total_members: 5, required_count: 3, delegated_count: 2, reached: false })
    expect(type.chairman).toMatchObject({ delegated: true, username: CHAIRMAN.account })

    const { member, exitHash, id } = await exitDecision('srbq')
    const waiting = await journalAt(id, ['AWAITING_QUORUM'], 'робот отдал голоса и ждёт кворума')
    expect(waiting.decision_type).toBe(TYPE)
    expect((waiting.votes as any[]).map(v => v.member).sort()).toEqual(['anna', 'petr'])
    expect(await votesFor(id, ['anna', 'petr'], 'голоса робота в цепи')).toEqual(['anna', 'petr'])

    // Живой голос набирает кворум — протокол подписывает робот председателя.
    await voteOnDecision(id, 'for', ['mikhail'])
    await journalAt(id, ['EXECUTED', 'CLOSED'], 'робот утвердил решение после кворума')
    await payOutExit(member, exitHash)
  })

  it(caseName('sov.rob.side.12', 'ведомый ещё не голосовал — робот за повторяющих не голосует, в журнале видно, кого ждут; после его голоса повторяющие голосуют тем же знаком'), async () => {
    await delegations({ petr: { follow: 'mikhail' }, anna: { follow: 'mikhail' }, ant: { authorize: true } })

    const type = await registry()
    expect(type.vote_quorum.delegated_count).toBe(0)
    expect(type.vote_quorum.follow_groups).toEqual([{ follow: 'mikhail', count: 2 }])
    expect((type.voters as any[]).filter(v => v.mode === 'FOLLOW').map(v => v.member).sort()).toEqual(['anna', 'petr'])

    const approved = await exitDecision('srbf')
    const waiting = await journalAt(approved.id, ['AWAITING_FOLLOWED'], 'робот ждёт голоса ведомого')
    expect(waiting.waiting_for).toEqual(['mikhail'])
    expect(waiting.votes).toEqual([])
    expect((await chainDecision(approved.id)).votes_for).toEqual([])

    // sov.rob.happy.12: «за» ведомого повторяют оба — одной транзакцией.
    await voteOnDecision(approved.id, 'for', ['mikhail'])
    await votesFor(approved.id, ['anna', 'mikhail', 'petr'], 'повторяющие проголосовали «за» вслед за ведомым')
    const done = await journalAt(approved.id, ['EXECUTED', 'CLOSED'], 'решение утверждено роботом председателя')
    const repeated = (done.votes as any[]).filter(v => ['anna', 'petr'].includes(v.member))
    expect(new Set(repeated.map(v => v.tx_id)).size).toBe(1)
    await payOutExit(approved.member, approved.exitHash)

    // «Против» ведомого повторяется тем же знаком.
    const declined = await exitDecision('srbg')
    await journalAt(declined.id, ['AWAITING_FOLLOWED'], 'робот ждёт голоса ведомого')
    await voteOnDecision(declined.id, 'against', ['mikhail'])
    await waitFor(async () => {
      const against = [...((await chainDecision(declined.id))?.votes_against ?? [])].sort()
      return against.join(',') === 'anna,mikhail,petr' ? true : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: 'повторяющие проголосовали «против» вслед за ведомым' })
    expect((await chainDecision(declined.id)).votes_for).toEqual([])
    await declineDecisionOnChain(declined.id)
  })

  it(caseName('sov.rob.side.13', 'цепочка повтора: первый повторяет второго, второй — третьего; голос третьего двигает цепочку по звену'), async () => {
    await delegations({ petr: { follow: 'anna' }, anna: { follow: 'olga' }, ant: { authorize: true } })

    const { member, exitHash, id } = await exitDecision('srbc')
    const waiting = await journalAt(id, ['AWAITING_FOLLOWED'], 'робот ждёт начала цепочки')
    expect(waiting.waiting_for).toContain('olga')

    await voteOnDecision(id, 'for', ['olga'])
    await votesFor(id, ['anna', 'olga', 'petr'], 'цепочка дошла до конца')
    const done = await journalAt(id, ['EXECUTED', 'CLOSED'], 'решение утверждено')
    const anna = (done.votes as any[]).find(v => v.member === 'anna')
    const petr = (done.votes as any[]).find(v => v.member === 'petr')
    // Звенья голосуют разными транзакциями: сначала второй, за ним первый.
    expect(anna.tx_id).not.toBe(petr.tx_id)
    expect(Date.parse(anna.at)).toBeLessThanOrEqual(Date.parse(petr.at))
    await payOutExit(member, exitHash)
  })

  it(caseName('sov.rob.side.14', 'реестр: замкнутый круг повтора помечен предупреждением; председатель «сразу» и все за ним — кворум гарантирован'), async () => {
    await delegations({ petr: { follow: 'anna' }, anna: { follow: 'petr' } })
    const looped = await registry()
    expect(looped.warnings.length, JSON.stringify(looped.warnings)).toBeGreaterThan(0)
    expect(looped.vote_quorum.reached).toBe(false)

    // sov.rob.break.09: голос председателя гарантирован, остальные идут за ним.
    await delegations({
      ant: { vote: true, authorize: true },
      petr: { follow: 'ant' },
      anna: { follow: 'ant' },
      mikhail: { follow: 'ant' },
      olga: { follow: 'ant' },
    })
    const chained = await registry()
    expect(chained.warnings).toEqual([])
    // Гарантированный голос председателя ведёт за собой всех, кто идёт за ним.
    expect(chained.vote_quorum.reached).toBe(true)
    expect(chained.vote_quorum.delegated_count).toBeGreaterThanOrEqual(chained.vote_quorum.required_count)

    // И на деле: заявление проходит без единого живого голоса.
    const { member, exitHash, id } = await exitDecision('srba')
    const done = await journalAt(id, ['EXECUTED', 'CLOSED'], 'решение прошло без людей')
    // Решение исполнено и из цепи убрано — голоса читаются из журнала робота.
    // Робот голосует за каждого, чей ключ у него есть: кворум набран без людей.
    const voted = (done.votes as any[]).map(v => String(v.member))
    expect(voted).toContain(CHAIRMAN.account)
    expect(voted.length, `голоса робота: ${voted.join(', ')}`).toBeGreaterThanOrEqual(chained.vote_quorum.required_count)
    expect(voted.every(m => council.includes(m))).toBe(true)
    await payOutExit(member, exitHash)
  })
})

/**
 * Оперативная память цепи: общее собрание пайщиков от созыва до закрытия.
 *
 * Два процесса. Первый — собрание с первого раза: созыв, решение совета о
 * созыве, голосование уполномоченных участков, подписи секретаря и
 * председателя собрания, цепь стирает закрытое собрание. Второй — собрание,
 * которое не собрало кворум: голосует один уполномоченный из трёх, после
 * закрытия собрание перезапускается (`meet::restartmeet` — новая повестка
 * совета, кворум второго круга ниже), и второй круг доводится до закрытия.
 *
 * Сроки на стенде — две минуты окна голосования: контракт собрания собран в
 * режиме проверки и пропускает пятнадцатидневный срок созыва (meet.hpp,
 * TEST_MODE). Байты от срока не зависят; сколько длится каждый этап в работе,
 * задают сутки этапов ниже (допущения: созыв за две недели, повторный круг —
 * ещё две недели).
 */
import crypto from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COUNCIL, authorizeDecisionOnChain, awaitDecision, gql, signDocument, tableRows, toChainDoc, tokenOf, voteOnDecision, waitFor } from '../core'
import { GENERATED, castBallots, meetAs, meetVoters } from '../meet/meet.helpers'
import { ProcessMeter, RAM_COST_ON } from './ram-cost.helpers'

/** Окно голосования: открывается через полминуты после созыва (или перезапуска), длится две минуты — между шагами идут снимки памяти. */
const OPENS_IN_MS = 35_000
const VOTING_MS = 120_000

const FIRST_ROUND = {
  created: { title: 'Собрание созвано', awaits: 'решения совета о созыве' },
  authorized: { title: 'Совет разрешил собрание', awaits: 'открытия голосования' },
  voted: { title: 'Уполномоченные проголосовали', awaits: 'закрытия голосования' },
}
const CLOSING = {
  'secretary': { title: 'Секретарь подписал протокол собрания', awaits: 'подписи председателя собрания' },
  'closed': { title: 'Председатель подписал протокол, собрание закрыто', awaits: '—' },
}

const once = new ProcessMeter('general-meet', 'общее собрание пайщиков с первого раза (от созыва до закрытия)', {
  ...FIRST_ROUND,
  closed_vote: { title: 'Голосование закрыто, кворум собран', awaits: 'подписи секретаря собрания' },
  ...CLOSING,
}, {
  created: 1,
  authorized: 14,
  voted: 2,
  closed_vote: 1,
  secretary: 1,
})

const restarted = new ProcessMeter('general-meet-restart', 'общее собрание пайщиков с перезапуском после несобранного кворума', {
  created: FIRST_ROUND.created,
  authorized: FIRST_ROUND.authorized,
  voted_short: { title: 'Проголосовал один уполномоченный из трёх', awaits: 'закрытия голосования' },
  no_quorum: { title: 'Голосование закрыто без кворума', awaits: 'перезапуска собрания' },
  restarted: { title: 'Собрание перезапущено', awaits: 'решения совета о повторном собрании' },
  authorized_2: { title: 'Совет разрешил повторное собрание', awaits: 'открытия голосования второго круга' },
  voted_2: { title: 'Уполномоченные проголосовали во втором круге', awaits: 'закрытия голосования' },
  closed_vote: { title: 'Голосование второго круга закрыто, кворум собран', awaits: 'подписи секретаря собрания' },
  ...CLOSING,
}, {
  created: 1,
  authorized: 14,
  voted_short: 2,
  no_quorum: 1,
  restarted: 1,
  authorized_2: 14,
  voted_2: 2,
  closed_vote: 1,
  secretary: 1,
})

function agendaOf(tag: string) {
  return [
    { title: `Утвердить смету ${tag}`, context: `Смета приложена ${tag}`, decision: `Смету утвердить ${tag}` },
    { title: `Принять отчёт совета ${tag}`, context: '', decision: `Отчёт совета принять ${tag}` },
  ]
}

function windowFromNow(): { opens: Date, closes: Date } {
  const opens = new Date(Date.now() + OPENS_IN_MS)
  return { opens, closes: new Date(opens.getTime() + VOTING_MS) }
}

/** Повестка собрания, подписанная председателем совета (первый или повторный созыв). */
async function signedAgenda(token: string, agenda: ReturnType<typeof agendaOf>, w: { opens: Date, closes: Date }, isRepeated: boolean): Promise<any> {
  const generated = (await gql<any>(token, `mutation($d:AnnualGeneralMeetingAgendaGenerateDocumentInput!){
    generateAnnualGeneralMeetAgendaDocument(data:$d){ ${GENERATED} } }`, {
    d: {
      coopname: COOP,
      username: CHAIRMAN.account,
      is_repeated: isRepeated,
      meet: { type: 'regular', open_at_datetime: w.opens.toISOString(), close_at_datetime: w.closes.toISOString() },
      questions: agenda.map((q, i) => ({ number: String(i + 1), title: q.title, context: q.context, decision: q.decision })),
    },
  })).generateAnnualGeneralMeetAgendaDocument
  return signDocument(CHAIRMAN.wif, generated, CHAIRMAN.account, 1)
}

/** Совет разрешает созыв (или повторный созыв) — протокол по голосам, утверждение председателем. */
async function councilAuthorizes(token: string, meetHash: string, isRepeated: boolean): Promise<void> {
  const decision = await awaitDecision(meetHash, 'вопрос совета о созыве собрания')
  await voteOnDecision(Number(decision.id), 'for')
  const protocol = (await waitFor(() => gql<any>(token, `mutation($d:AnnualGeneralMeetingSovietDecisionGenerateDocumentInput!){
    generateSovietDecisionOnAnnualMeetDocument(data:$d){ ${GENERATED} } }`, {
    d: { coopname: COOP, username: CHAIRMAN.account, decision_id: Number(decision.id), meet_hash: meetHash, is_repeated: isRepeated },
  }), { timeoutMs: 30_000, intervalMs: 1_500, label: 'протокол решения совета о созыве' })).generateSovietDecisionOnAnnualMeetDocument
  await authorizeDecisionOnChain(Number(decision.id), toChainDoc(await signDocument(CHAIRMAN.wif, protocol, CHAIRMAN.account, 1)))
  await waitFor(async () => ((await meetAs(CHAIRMAN, meetHash)).processing?.meet?.status === 'authorized' ? true : null),
    { timeoutMs: 60_000, intervalMs: 1_000, label: 'собрание разрешено советом' })
}

async function waitUntil(ms: number, label: string): Promise<void> {
  await waitFor(async () => (Date.now() > ms ? true : null), { timeoutMs: Math.max(0, ms - Date.now()) + 60_000, intervalMs: 500, label })
}

async function meetRow(id: number): Promise<any | undefined> {
  return (await tableRows<any>('meet', COOP, 'meets')).find(r => Number(r.id) === id)
}

/** Собрание от созыва до закрытия; `restart` — первый круг без кворума и перезапуск. */
async function runMeet(pm: ProcessMeter, restart: boolean): Promise<void> {
  const token = await tokenOf(CHAIRMAN)
  const presider: Who = CHAIRMAN
  const secretary: Who = COUNCIL
  const agenda = agendaOf(crypto.randomBytes(4).toString('hex'))
  // Ключи уполномоченным чужих участков — до снимка «до процесса».
  const { trustees, strangers } = await meetVoters()
  await pm.start()

  let w = windowFromNow()
  const created = (await gql<any>(token, 'mutation($d:CreateAnnualGeneralMeetInput!){ createAnnualGeneralMeet(data:$d){ hash } }', {
    d: {
      coopname: COOP,
      initiator: CHAIRMAN.account,
      presider: presider.account,
      secretary: secretary.account,
      agenda,
      open_at: w.opens.toISOString(),
      close_at: w.closes.toISOString(),
      proposal: await signedAgenda(token, agenda, w, false),
      details: 'Замер памяти: общее собрание',
    },
  })).createAnnualGeneralMeet
  let meetHash = String(created.hash)
  await pm.mark('created')

  await councilAuthorizes(token, meetHash, false)
  await pm.mark('authorized')

  await waitUntil(w.opens.getTime() + 1_500, 'открытие голосования')
  if (restart) {
    // Один бюллетень из трёх и больше — кворум первого круга не собран.
    await castBallots(meetHash, trustees.slice(0, 1))
    await pm.mark('voted_short')
    await waitUntil(w.closes.getTime() + 2_000, 'закрытие голосования без кворума')
    await pm.mark('no_quorum')

    const meetId = Number((await meetAs(CHAIRMAN, meetHash)).processing.meet.id)
    w = windowFromNow()
    const re = await gql<any>(token, 'mutation($d:RestartAnnualGeneralMeetInput!){ restartAnnualGeneralMeet(data:$d){ hash } }', {
      d: {
        coopname: COOP,
        hash: meetHash,
        newproposal: await signedAgenda(token, agenda, w, true),
        new_open_at: w.opens.toISOString(),
        new_close_at: w.closes.toISOString(),
        details: 'Замер памяти: повторное общее собрание',
      },
    })
    // Перезапуск меняет хэш собрания в той же строке цепи — новый берём из цепи.
    const row = await waitFor(async () => {
      const r = await meetRow(meetId)
      return r && String(r.hash).toLowerCase() !== meetHash.toLowerCase() ? r : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'собрание перезапущено с новым хэшем' })
    meetHash = String(row.hash ?? re.restartAnnualGeneralMeet.hash)
    await pm.mark('restarted')

    await councilAuthorizes(token, meetHash, true)
    await pm.mark('authorized_2')
    await waitUntil(w.opens.getTime() + 1_500, 'открытие голосования второго круга')
    await castBallots(meetHash, trustees, strangers)
    await waitFor(async () => ((await meetAs(trustees[0], meetHash)).processing?.meet?.quorum_passed ? true : null),
      { timeoutMs: 30_000, intervalMs: 1_000, label: 'кворум второго круга собран' })
    await pm.mark('voted_2')
  }
  else {
    await castBallots(meetHash, trustees, strangers)
    await waitFor(async () => ((await meetAs(trustees[0], meetHash)).processing?.meet?.quorum_passed ? true : null),
      { timeoutMs: 30_000, intervalMs: 1_000, label: 'кворум собран' })
    await pm.mark('voted')
  }

  await waitUntil(w.closes.getTime() + 2_000, 'закрытие голосования')
  await pm.mark('closed_vote')

  const secretaryToken = await tokenOf(secretary)
  const decisionDoc = (await gql<any>(secretaryToken, `mutation($d:AnnualGeneralMeetingDecisionGenerateDocumentInput!){
    generateAnnualGeneralMeetDecisionDocument(data:$d){ ${GENERATED} } }`, {
    d: { coopname: COOP, username: secretary.account, meet_hash: meetHash },
  })).generateAnnualGeneralMeetDecisionDocument
  await gql(secretaryToken, 'mutation($d:SignBySecretaryOnAnnualGeneralMeetInput!){ signBySecretaryOnAnnualGeneralMeet(data:$d){ hash } }', {
    d: { coopname: COOP, hash: meetHash, username: secretary.account, secretary_decision: await signDocument(secretary.wif, decisionDoc, secretary.account, 1) },
  })
  const first = await waitFor(async () => (await meetAs(presider, meetHash)).processing?.meet?.decision1 ?? null,
    { timeoutMs: 60_000, intervalMs: 1_000, label: 'протокол с подписью секретаря' })
  await pm.mark('secretary')

  await gql(token, 'mutation($d:SignByPresiderOnAnnualGeneralMeetInput!){ signByPresiderOnAnnualGeneralMeet(data:$d){ hash } }', {
    d: { coopname: COOP, hash: meetHash, username: presider.account, presider_decision: await signDocument(presider.wif, first.rawDocument, presider.account, 2, [first.document]) },
  })
  await waitFor(async () => {
    const rows = await tableRows<any>('meet', COOP, 'meets')
    return rows.some(r => String(r.hash).toLowerCase() === meetHash.toLowerCase()) ? null : true
  }, { timeoutMs: 90_000, intervalMs: 1_500, label: 'закрытое собрание стёрто из цепи' })
  await pm.mark('closed')

  expect(pm.passed()).toEqual(['before', ...Object.keys(pm.stages)])
}

describe.runIf(RAM_COST_ON)('оперативная память: общее собрание пайщиков', () => {
  afterAll(() => {
    once.finish()
    restarted.finish()
  }, 120_000)

  it('собрание с первого раза', async () => {
    await runMeet(once, false)
  }, 1_200_000)

  it('собрание с перезапуском после несобранного кворума', async () => {
    await runMeet(restarted, true)
  }, 1_800_000)
})

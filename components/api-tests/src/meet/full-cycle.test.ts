/**
 * Общее собрание от созыва до закрытия (test-registry/meet.chain-texts.yaml).
 *
 * На стенде три кооперативных участка, голосуют их уполномоченные; кворум —
 * больше трёх четвертей. Собрание созывается с окном голосования в минуту,
 * совет разрешает его, уполномоченные голосуют бюллетенями, секретарь и
 * председатель собрания подписывают протокол. Закрытое собрание цепь стирает —
 * стол и фабрика документов читают его дальше из журнала изменений цепи.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import {
  CHAIRMAN,
  COOP,
  COUNCIL,
  ROLES,
  authorizeDecisionOnChain,
  awaitDecision,
  caseName,
  fixture,
  gql,
  signDocument,
  tableRows,
  toChainDoc,
  tokenOf,
  voteOnDecision,
  waitFor,
} from '../core'

const digest = (text: string): string => crypto.createHash('sha256').update(text, 'utf8').digest('hex')

const AGGREGATE = `rawDocument{ full_title html hash meta binary }
  document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }`
const MEET = `hash
  processing{ hash isVoted extendedStatus
    meet{ id hash status quorum_passed current_quorum_percent decision1{ ${AGGREGATE} } }
    questions{ id number title context decision counter_votes_for counter_votes_against } }
  processed{ hash quorum_passed }`
const GET = `query($d:GetMeetInput!){ getMeet(data:$d){ ${MEET} } }`
const LIST = `query($d:GetMeetsInput!){ getMeets(data:$d){ hash processing{ hash extendedStatus } } }`
const GENERATED = 'full_title html hash meta binary'

const tag = crypto.randomBytes(4).toString('hex')
const agenda = [
  { title: `Утвердить смету ${tag}`, context: `Смета приложена ${tag}`, decision: `Смету утвердить ${tag}` },
  { title: `Принять отчёт совета ${tag}`, context: '', decision: `Отчёт совета принять ${tag}` },
]

/** Окно голосования: открывается через полминуты после созыва, длится минуту. */
const OPENS_IN_MS = 35_000
const VOTING_MS = 60_000

describe('общее собрание: созыв, голосование уполномоченных, закрытие', () => {
  const presider = CHAIRMAN
  const secretary = COUNCIL
  let trustees: Who[] = []
  let chairToken = ''
  let meetHash = ''
  let closeAt = 0
  let decisionHtmlBeforeClose = ''
  let closedForVoter: any
  let closedForOutsider: any

  async function meetAs(who: Who): Promise<any> {
    return (await gql<any>(await tokenOf(who), GET, { d: { coopname: COOP, hash: meetHash } })).getMeet
  }

  beforeAll(async () => {
    chairToken = await tokenOf(CHAIRMAN)
    trustees = [fixture('chairkrg'), fixture('chairodn'), fixture('chairmyt')]
    const branches = await tableRows<any>('branch', COOP, 'branches')
    expect(branches.length, 'голосуют уполномоченные всех участков; у набора ключи трёх').toBeLessThanOrEqual(trustees.length)

    // Созыв.
    const opens = new Date(Date.now() + OPENS_IN_MS)
    const closes = new Date(opens.getTime() + VOTING_MS)
    closeAt = closes.getTime()
    const generated = (await gql<any>(chairToken, `mutation($d:AnnualGeneralMeetingAgendaGenerateDocumentInput!){
      generateAnnualGeneralMeetAgendaDocument(data:$d){ ${GENERATED} } }`, {
      d: {
        coopname: COOP,
        username: CHAIRMAN.account,
        is_repeated: false,
        meet: { type: 'regular', open_at_datetime: opens.toISOString(), close_at_datetime: closes.toISOString() },
        questions: agenda.map((q, i) => ({ number: String(i + 1), title: q.title, context: q.context, decision: q.decision })),
      },
    })).generateAnnualGeneralMeetAgendaDocument
    const created = (await gql<any>(chairToken, `mutation($d:CreateAnnualGeneralMeetInput!){ createAnnualGeneralMeet(data:$d){ hash } }`, {
      d: {
        coopname: COOP,
        initiator: CHAIRMAN.account,
        presider: presider.account,
        secretary: secretary.account,
        agenda,
        open_at: opens.toISOString(),
        close_at: closes.toISOString(),
        proposal: await signDocument(CHAIRMAN.wif, generated, CHAIRMAN.account, 1),
        details: `Собрание внешнего слоя ${tag}`,
      },
    })).createAnnualGeneralMeet
    meetHash = String(created.hash)

    // Совет разрешает собрание.
    const decision = await awaitDecision(meetHash, 'вопрос совета о созыве собрания')
    await voteOnDecision(Number(decision.id), 'for')
    const protocol = (await gql<any>(chairToken, `mutation($d:AnnualGeneralMeetingSovietDecisionGenerateDocumentInput!){
      generateSovietDecisionOnAnnualMeetDocument(data:$d){ ${GENERATED} } }`, {
      d: { coopname: COOP, username: CHAIRMAN.account, decision_id: Number(decision.id), meet_hash: meetHash, is_repeated: false },
    })).generateSovietDecisionOnAnnualMeetDocument
    await authorizeDecisionOnChain(Number(decision.id), toChainDoc(await signDocument(CHAIRMAN.wif, protocol, CHAIRMAN.account, 1)))
    await waitFor(async () => ((await meetAs(CHAIRMAN)).processing?.meet?.status === 'authorized' ? true : null),
      { timeoutMs: 60_000, intervalMs: 1_000, label: 'собрание разрешено советом' })

    // Голосование открылось — уполномоченные подают бюллетени.
    await waitFor(async () => (Date.now() > opens.getTime() + 1_500 ? true : null), { timeoutMs: OPENS_IN_MS + 30_000, intervalMs: 500, label: 'открытие голосования' })
    for (const trustee of trustees) {
      const token = await tokenOf(trustee)
      const questions = (await meetAs(trustee)).processing.questions as any[]
      const ballot = (await gql<any>(token, `mutation($d:AnnualGeneralMeetingVotingBallotGenerateDocumentInput!){
        generateBallotForAnnualGeneralMeetDocument(data:$d){ ${GENERATED} } }`, {
        d: { coopname: COOP, username: trustee.account, meet_hash: meetHash, answers: questions.map(q => ({ id: String(q.id), number: String(q.number), vote: 'for' })) },
      })).generateBallotForAnnualGeneralMeetDocument
      await gql(token, 'mutation($d:VoteOnAnnualGeneralMeetInput!){ voteOnAnnualGeneralMeet(data:$d){ hash } }', {
        d: {
          coopname: COOP,
          hash: meetHash,
          username: trustee.account,
          ballot: await signDocument(trustee.wif, ballot, trustee.account, 1),
          votes: questions.map(q => ({ question_id: Number(q.id), vote: 'for' })),
        },
      })
    }
    const voted = await meetAs(trustees[0])
    expect(voted.processing.meet.quorum_passed, 'кворум собран').toBe(true)
    expect(voted.processing.isVoted).toBe(true)

    // Голосование закрылось — секретарь и председатель собрания подписывают протокол.
    await waitFor(async () => (Date.now() > closeAt + 2_000 ? true : null), { timeoutMs: VOTING_MS + 60_000, intervalMs: 500, label: 'закрытие голосования' })
    const secretaryToken = await tokenOf(secretary)
    const decisionDoc = (await gql<any>(secretaryToken, `mutation($d:AnnualGeneralMeetingDecisionGenerateDocumentInput!){
      generateAnnualGeneralMeetDecisionDocument(data:$d){ ${GENERATED} } }`, {
      d: { coopname: COOP, username: secretary.account, meet_hash: meetHash },
    })).generateAnnualGeneralMeetDecisionDocument
    decisionHtmlBeforeClose = decisionDoc.html
    await gql(secretaryToken, 'mutation($d:SignBySecretaryOnAnnualGeneralMeetInput!){ signBySecretaryOnAnnualGeneralMeet(data:$d){ hash } }', {
      d: { coopname: COOP, hash: meetHash, username: secretary.account, secretary_decision: await signDocument(secretary.wif, decisionDoc, secretary.account, 1) },
    })
    const first = await waitFor(async () => (await meetAs(presider)).processing?.meet?.decision1 ?? null,
      { timeoutMs: 60_000, intervalMs: 1_000, label: 'протокол с подписью секретаря' })
    await gql(chairToken, 'mutation($d:SignByPresiderOnAnnualGeneralMeetInput!){ signByPresiderOnAnnualGeneralMeet(data:$d){ hash } }', {
      d: { coopname: COOP, hash: meetHash, username: presider.account, presider_decision: await signDocument(presider.wif, first.rawDocument, presider.account, 2, [first.document]) },
    })

    // Цепь стирает закрытое собрание.
    await waitFor(async () => {
      const rows = await tableRows<any>('meet', COOP, 'meets')
      return rows.some(r => String(r.hash).toLowerCase() === meetHash.toLowerCase()) ? null : true
    }, { timeoutMs: 90_000, intervalMs: 1_500, label: 'закрытое собрание стёрто из цепи' })
    closedForVoter = await waitFor(async () => {
      const m = await meetAs(trustees[0])
      return m.processing?.extendedStatus === 'CLOSED' ? m : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'закрытое собрание читается из журнала изменений' })
    closedForOutsider = await meetAs(ROLES.member())
  }, 600_000)

  it(caseName('meet.texts.side.02', 'собрание закрыто и стёрто из цепи — стол показывает статус, вопросы по порядку с текстами и отметку «голосовал»'), async () => {
    expect(closedForVoter.processing.extendedStatus).toBe('CLOSED')
    const questions = closedForVoter.processing.questions as any[]
    expect(questions.map(q => Number(q.number))).toEqual([1, 2])
    expect(questions.map(q => [q.title, q.context, q.decision])).toEqual(agenda.map(q => [q.title, q.context, q.decision]))
    expect(questions.every(q => Number(q.counter_votes_for) === 3 && Number(q.counter_votes_against) === 0)).toBe(true)
    expect(closedForVoter.processing.isVoted, 'голосовавший уполномоченный отмечен').toBe(true)
    expect(closedForOutsider.processing.isVoted, 'не голосовавший пайщик не отмечен').toBe(false)
    expect(closedForOutsider.processing.questions.map((q: any) => q.title)).toEqual(agenda.map(q => q.title))

    const list = (await gql<any>(chairToken, LIST, { d: { coopname: COOP } })).getMeets as any[]
    const same = list.filter(m => String(m.hash).toLowerCase() === meetHash.toLowerCase())
    expect(same, 'в списке собрание одно').toHaveLength(1)
    expect(same[0].processing.extendedStatus).toBe('CLOSED')
  })

  it(caseName('meet.texts.side.05', 'документ собрания после закрытия собирается по журналу изменений — в нём тексты формулировок, а не хеши'), async () => {
    const secretaryToken = await tokenOf(secretary)
    const doc = (await gql<any>(secretaryToken, `mutation($d:AnnualGeneralMeetingDecisionGenerateDocumentInput!){
      generateAnnualGeneralMeetDecisionDocument(data:$d){ ${GENERATED} } }`, {
      d: { coopname: COOP, username: secretary.account, meet_hash: meetHash },
    })).generateAnnualGeneralMeetDecisionDocument
    for (const html of [decisionHtmlBeforeClose, doc.html]) {
      for (const q of agenda) {
        expect(html).toContain(q.title)
        expect(html).toContain(q.decision)
        expect(html).not.toContain(digest(q.title))
        expect(html).not.toContain(digest(q.decision))
      }
    }
  })
})

/**
 * Кооперативный участок снаружи: собрания пайщиков участка (ku_decisions,
 * ku_decision_questions) и заявки доверенных лиц (ku_trust_requests).
 *
 * Действия уходят в контракт branch подписью кооператива, таблицы узла
 * заполняет разбор дельт цепи; мутация отвечает после разбора своего блока,
 * поэтому чтение сразу после неё видит новое состояние.
 *
 * Участники — свежие пайщики: собрание заводится и отменяется, заявка в
 * доверенные отклоняется и одобряется на участке odn (председатель chairodn).
 * Доверенное лицо, принятое тестом, — свежий пайщик и больше нигде не
 * участвует; участок krg фикстур Стола заказов не трогается.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, ROLES, authorizeDecisionOnChain, awaitDecision, caseName, decisionByHash, expectAuthDenied, expectCode, freshMember, gql, gqlError, login, randomAccount, randomHash, signDocument, toChainDoc, tokenOf, voteOnDecision, waitFor } from '../core'



const DOC = 'full_title html hash meta binary'
const SIGNED = 'version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta }'
const TX = '{ __typename }'

const GEN_PROPOSAL = `mutation($d:BranchMeetingProposalGenerateDocumentInput!){ kuGenerateMeetingProposal(data:$d){ ${DOC} } }`
const GEN_ANY = `mutation($i:GenerateAnyDocumentInput!){ generateDocument(input:$i){ ${DOC} } }`
const CREATE = `mutation($d:CreateKuDecisionInput!){ kuCreateDecision(data:$d)${TX} }`
const JOIN = `mutation($d:JoinKuDecisionInput!){ kuJoinDecision(data:$d)${TX} }`
const START = `mutation($d:StartKuDecisionInput!){ kuStartDecision(data:$d)${TX} }`
const CANCEL = `mutation($d:CancelKuDecisionInput!){ kuCancelDecision(data:$d)${TX} }`
const DECISION = `query($h:String!){ kuDecision(hash:$h){ hash id coopname type status initiator chairman participants present meet_place meet_at braname
  questions{ id number title decision context decision_id counter_votes_for } } }`
const DECISIONS = `query($f:KuDecisionFilterInput,$o:PaginationInput){ kuDecisions(filter:$f, options:$o){ totalCount items{ hash status initiator present } } }`

const REQUEST = `mutation($d:RequestKuTrustedInput!){ kuRequestTrusted(data:$d)${TX} }`
const APPROVE = `mutation($d:ApproveKuTrustedInput!){ kuApproveTrusted(data:$d)${TX} }`
const DECLINE = `mutation($d:DeclineKuTrustedInput!){ kuDeclineTrusted(data:$d)${TX} }`
const REQUESTS = `query($f:KuTrustRequestFilterInput,$o:PaginationInput){ kuTrustRequests(filter:$f, options:$o){ totalCount items{
  hash username braname present coopname
  document{ hash rawDocument{ ${DOC} } document{ ${SIGNED} } }
  authority_document{ hash rawDocument{ ${DOC} } document{ ${SIGNED} } } } } }`
const BRANCH = 'query($d:GetBranchesInput!){ getBranches(data:$d){ braname trustee{ username } trusted_certificates{ username } } }'

/** Участок, где тест принимает доверенное лицо, и его председатель. */
const BRANCH_ODN = 'odn'

const agenda = [
  { title: 'Выбрать место выдачи', decision: 'Выдавать заказы по субботам', context: 'Предложение инициатора' },
  { title: 'Утвердить график', decision: 'Утвердить график дежурств', context: '' },
]

let initiator: Who
let joiner: Who
let applicant: Who
let approvedApplicant: Who
let initiatorToken: string
let joinerToken: string
let applicantToken: string
let approvedApplicantToken: string
let outsiderToken: string
let branchChairToken: string
let foreignChairToken: string
let branchChair: Who

async function decision(token: string, hash: string): Promise<any> {
  return (await gql<any>(token, DECISION, { h: hash })).kuDecision
}

/** Заявки участка odn глазами вызывающего — так их запрашивает экран участка. */
async function trustRequest(token: string, username: string, hash: string): Promise<any> {
  const d = (await gql<any>(token, REQUESTS, { f: { coopname: COOP, braname: BRANCH_ODN, username }, o: { page: 1, limit: 50, sortOrder: 'DESC' } })).kuTrustRequests
  return d.items.find((r: any) => r.hash.toLowerCase() === hash.toLowerCase()) ?? null
}

async function trustedOf(token: string, braname: string): Promise<string[]> {
  const list = (await gql<any>(token, BRANCH, { d: { coopname: COOP, braname } })).getBranches
  expect(list, `участок ${braname}`).toHaveLength(1)
  return (list[0].trusted_certificates ?? []).map((t: any) => t.username)
}

/** Пакет заявки доверенного: договор матответственности (327) и доверенность (330). */
async function signedTrustPackage(who: Who, token: string, hash: string): Promise<{ application: any, authority: any }> {
  const base = { coopname: COOP, username: who.account, hash, branch_name: `Участок ${BRANCH_ODN}`, trustee: branchChair.account }
  const app = (await gql<any>(token, GEN_ANY, { i: { data: { ...base, registry_id: 327 } } })).generateDocument
  const auth = (await gql<any>(token, GEN_ANY, { i: { data: { ...base, registry_id: 330 } } })).generateDocument
  return {
    application: await signDocument(who.wif, app, who.account, 1),
    authority: await signDocument(who.wif, auth, who.account, 1),
  }
}

beforeAll(async () => {
  initiator = freshMember({ prefix: 'kui' })
  joiner = freshMember({ prefix: 'kuj' })
  applicant = freshMember({ prefix: 'kut' })
  approvedApplicant = freshMember({ prefix: 'kua' })
  initiatorToken = await login(initiator)
  joinerToken = await login(joiner)
  applicantToken = await login(applicant)
  approvedApplicantToken = await login(approvedApplicant)
  outsiderToken = await tokenOf(ROLES.member())
  branchChair = ROLES.foreignBranchChairman()
  branchChairToken = await tokenOf(branchChair)
  foreignChairToken = await tokenOf(ROLES.branchChairman())
})

describe('собрание пайщиков участка', () => {
  const hash = randomHash()
  const meetAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString()
  const meetPlace = `Красногорск, ул. Тестовая, ${hash.slice(0, 6)}`

  it(caseName('ku.dec.side.01', 'объявить собрание за другого пайщика нельзя'), async () => {
    const generated = (await gql<any>(joinerToken, GEN_PROPOSAL, {
      d: { coopname: COOP, username: joiner.account, hash, type: 'free', questions: agenda.map((q, i) => ({ number: String(i + 1), ...q })) },
    })).kuGenerateMeetingProposal
    const proposal = await signDocument(joiner.wif, generated, joiner.account, 1)
    expectCode(await gqlError(joinerToken, CREATE, {
      d: { coopname: COOP, hash, type: 'FREE', initiator: initiator.account, braname: '', agenda, proposal, meet_place: meetPlace, meet_at: meetAt },
    }), 'KU_ACTION_SELF_ONLY')
    expectCode(await gqlError(joinerToken, DECISION, { h: hash }), 'KU_DECISION_NOT_FOUND')
  })

  it(caseName('ku.dec.happy.01', 'пайщик объявляет собрание — участок видит его с повесткой, местом и временем'), async () => {
    const generated = (await gql<any>(initiatorToken, GEN_PROPOSAL, {
      d: { coopname: COOP, username: initiator.account, hash, type: 'free', questions: agenda.map((q, i) => ({ number: String(i + 1), ...q })) },
    })).kuGenerateMeetingProposal
    const proposal = await signDocument(initiator.wif, generated, initiator.account, 1)
    await gql(initiatorToken, CREATE, {
      d: { coopname: COOP, hash, type: 'FREE', initiator: initiator.account, braname: '', agenda, proposal, meet_place: meetPlace, meet_at: meetAt },
    })

    const d = await decision(joinerToken, hash)
    expect(d).toMatchObject({ type: 'FREE', status: 'OPENED', initiator: initiator.account, present: true, meet_place: meetPlace, participants: [initiator.account] })
    expect(new Date(d.meet_at).toISOString()).toBe(meetAt)
    expect(d.questions.map((q: any) => [q.number, q.title, q.decision, q.context]))
      .toEqual(agenda.map((q, i) => [i + 1, q.title, q.decision, q.context]))
    expect(d.questions.every((q: any) => q.decision_id === d.id && q.counter_votes_for === 0)).toBe(true)

    const list = (await gql<any>(outsiderToken, DECISIONS, { f: { initiator: initiator.account }, o: { page: 1, limit: 20, sortOrder: 'DESC' } })).kuDecisions
    expect(list.items.map((i: any) => i.hash.toLowerCase())).toContain(hash.toLowerCase())
    expect(list.items.every((i: any) => i.initiator === initiator.account)).toBe(true)
  })

  it(caseName('ku.dec.happy.02', 'пайщик присоединяется к собранию; за другого — отказ'), async () => {
    expectCode(await gqlError(joinerToken, JOIN, { d: { coopname: COOP, hash, username: initiator.account } }), 'KU_ACTION_SELF_ONLY')
    await gql(joinerToken, JOIN, { d: { coopname: COOP, hash, username: joiner.account } })
    expect((await decision(initiatorToken, hash)).participants).toEqual([initiator.account, joiner.account])
  })

  it(caseName('ku.dec.side.02', 'открыть голосование и отменить собрание может только организатор; председатель — из участников'), async () => {
    const start = { d: { coopname: COOP, hash, chairman: joiner.account } }
    expectCode(await gqlError(joinerToken, START, start), 'KU_ACTION_INITIATOR_ONLY')
    expectCode(await gqlError(joinerToken, CANCEL, { d: { coopname: COOP, hash, reason: 'не организатор' } }), 'KU_ACTION_INITIATOR_ONLY')
    expectCode(await gqlError(initiatorToken, START, { d: { coopname: COOP, hash, chairman: ROLES.member().account } }), 'KU_CHAIRMAN_MUST_BE_PARTICIPANT')
    expect((await decision(initiatorToken, hash)).status).toBe('OPENED')
    expectAuthDenied(await gqlError(null, DECISIONS, {}))
    expectAuthDenied(await gqlError(null, DECISION, { h: hash }))
  })

  /** Повтор отвергается осмысленным кодом (отказ цепи либо правило узла), а не внутренней ошибкой. */
  function expectRefusedWithCode(err: { code: string | null, message: string } | null, what: string): void {
    expect(err, `${what}: ожидался отказ`).not.toBeNull()
    expect(['500', 'INTERNAL_SERVER_ERROR', 'null'], `${what}: ${JSON.stringify(err)}`).not.toContain(String(err!.code))
  }

  it(caseName('ku.dec.happy.03', 'организатор отменяет собрание — оно остаётся в истории отменённым'), async () => {
    // ku.dec.side.03: повторное присоединение уже присоединившегося — отказ, состав прежний.
    expectRefusedWithCode(await gqlError(joinerToken, JOIN, { d: { coopname: COOP, hash, username: joiner.account } }), 'повторное присоединение')
    expect((await decision(initiatorToken, hash)).participants).toEqual([initiator.account, joiner.account])

    await gql(initiatorToken, CANCEL, { d: { coopname: COOP, hash, reason: 'Проверка отмены' } })
    const d = await decision(joinerToken, hash)
    expect(d).toMatchObject({ status: 'CANCELLED', present: false })
    expect(d.questions).toEqual([])
  })

  it(caseName('ku.dec.side.03', 'повторная отмена собрания и присоединение к отменённому — отказ с кодом, собрание остаётся отменённым'), async () => {
    expectRefusedWithCode(await gqlError(initiatorToken, CANCEL, { d: { coopname: COOP, hash, reason: 'Повторная отмена' } }), 'повторная отмена')
    expectRefusedWithCode(await gqlError(joinerToken, JOIN, { d: { coopname: COOP, hash, username: joiner.account } }), 'присоединение к отменённому')
    expect(await decision(joinerToken, hash)).toMatchObject({ status: 'CANCELLED', present: false })
  })
})

const GEN_BALLOT = `mutation($d:BranchMeetingBallotGenerateDocumentInput!){ kuGenerateMeetingBallot(data:$d){ ${DOC} } }`
const GEN_PROTOCOL = `mutation($d:BranchMeetingDecisionGenerateDocumentInput!){ kuGenerateMeetingDecision(data:$d){ ${DOC} } }`
const VOTE = `mutation($d:VoteOnKuDecisionInput!){ kuVoteOnDecision(data:$d)${TX} }`
const CLOSE = `mutation($d:CloseKuDecisionInput!){ kuCloseDecision(data:$d)${TX} }`
const VOTING = `query($h:String!){ kuDecision(hash:$h){ hash type status chairman present participants signed_ballots open_at close_at braname address branch_name branch_email branch_phone
  protocol_document{ hash } authorization_document{ hash }
  questions{ id number title decision context counter_votes_for counter_votes_against counter_votes_abstained voters_for voters_against voters_abstained } } }`

async function votingOf(token: string, hash: string): Promise<any> {
  return (await gql<any>(token, VOTING, { h: hash })).kuDecision
}

function byNumber(questions: any[]): any[] {
  return [...questions].sort((a, b) => a.number - b.number)
}

/** Бюллетень участника: документ со всеми вопросами и его ответами, подписанный им самим. */
async function ballotOf(hash: string, questions: any[], who: Who, token: string, answers: string[]) {
  const generated = (await gql<any>(token, GEN_BALLOT, {
    d: {
      coopname: COOP,
      username: who.account,
      hash,
      questions: questions.map(q => ({ id: String(q.id), number: String(q.number), title: q.title, decision: q.decision, context: q.context ?? '' })),
      answers: questions.map((q, i) => ({ id: String(q.id), number: String(q.number), vote: answers[i] })),
    },
  })).kuGenerateMeetingBallot
  return {
    d: {
      coopname: COOP,
      hash,
      username: who.account,
      ballot: await signDocument(who.wif, generated, who.account, 1),
      votes: questions.map((q, i) => ({ question_id: q.id, vote: answers[i] })),
    },
  }
}

/** Протокол собрания по итогам голосования, подписанный председателем собрания. */
async function protocolOf(hash: string, chair: Who, token: string, voted: any, voters: number) {
  const generated = (await gql<any>(token, GEN_PROTOCOL, {
    d: {
      coopname: COOP,
      username: chair.account,
      hash,
      chairman: chair.account,
      open_at_datetime: String(voted.open_at),
      close_at_datetime: String(voted.close_at),
      current_quorum_percent: 100,
      protocol_number: '1',
      questions: byNumber(voted.questions).map((q: any) => ({
        number: String(q.number),
        title: q.title,
        decision: q.decision,
        context: q.context ?? '',
        counter_votes_for: String(q.counter_votes_for),
        counter_votes_against: String(q.counter_votes_against),
        counter_votes_abstained: String(q.counter_votes_abstained),
        is_accepted: q.counter_votes_for > q.counter_votes_against,
        votes_for_percent: Math.round(q.counter_votes_for / voters * 100),
        votes_against_percent: Math.round(q.counter_votes_against / voters * 100),
        votes_abstained_percent: Math.round(q.counter_votes_abstained / voters * 100),
      })),
    },
  })).kuGenerateMeetingDecision
  return signDocument(chair.wif, generated, chair.account, 1)
}

describe('собрание пайщиков участка: голосование и протокол', () => {
  const hash = randomHash()
  let third: Who
  let thirdToken = ''
  let questions: any[] = []

  const voting = (token: string) => votingOf(token, hash)
  const ballot = (who: Who, token: string, answers: string[]) => ballotOf(hash, questions, who, token, answers)

  beforeAll(async () => {
    third = freshMember({ prefix: 'kuv' })
    thirdToken = await login(third)
    const generated = (await gql<any>(initiatorToken, GEN_PROPOSAL, {
      d: { coopname: COOP, username: initiator.account, hash, type: 'free', questions: agenda.map((q, i) => ({ number: String(i + 1), ...q })) },
    })).kuGenerateMeetingProposal
    const proposal = await signDocument(initiator.wif, generated, initiator.account, 1)
    await gql(initiatorToken, CREATE, {
      d: {
        coopname: COOP,
        hash,
        type: 'FREE',
        initiator: initiator.account,
        braname: '',
        agenda,
        proposal,
        meet_place: 'Красногорск, зал собраний',
        meet_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
      },
    })
    await gql(joinerToken, JOIN, { d: { coopname: COOP, hash, username: joiner.account } })
  }, 300_000)

  it(caseName('ku.dec.side.04', 'голосование не открыть, пока участников меньше трёх'), async () => {
    const err = await gqlError(initiatorToken, START, { d: { coopname: COOP, hash, chairman: initiator.account } })
    expect(err, 'двоих участников для голосования мало').not.toBeNull()
    expect((await voting(initiatorToken)).status).toBe('OPENED')
  })

  it(caseName('ku.dec.happy.05', 'организатор открывает голосование — собрание в голосовании, окно отмерено, председатель назначен'), async () => {
    await gql(thirdToken, JOIN, { d: { coopname: COOP, hash, username: third.account } })
    await gql(initiatorToken, START, { d: { coopname: COOP, hash, chairman: initiator.account } })

    const d = await voting(joinerToken)
    expect(d).toMatchObject({ status: 'VOTING', chairman: initiator.account, present: true, signed_ballots: 0 })
    expect(d.participants).toEqual([initiator.account, joiner.account, third.account])
    expect(d.open_at).toBeTruthy()
    expect(new Date(d.close_at).getTime()).toBeGreaterThan(new Date(d.open_at).getTime())
    questions = [...d.questions].sort((a, b) => a.number - b.number)
    expect(questions.map(q => q.title)).toEqual(agenda.map(q => q.title))

    // К начатому голосованию присоединиться уже нельзя.
    const late = freshMember({ prefix: 'kul' })
    expect(await gqlError(await login(late), JOIN, { d: { coopname: COOP, hash, username: late.account } })).not.toBeNull()
  }, 300_000)

  it(caseName('ku.dec.happy.06', 'участники подают бюллетени — голоса считаются по каждому вопросу; повторный и чужой бюллетень не принимается'), async () => {
    await gql(initiatorToken, VOTE, await ballot(initiator, initiatorToken, ['for', 'for']))
    await gql(joinerToken, VOTE, await ballot(joiner, joinerToken, ['for', 'against']))

    // Повторный бюллетень того же участника и бюллетень за другого — отказ.
    expect(await gqlError(joinerToken, VOTE, await ballot(joiner, joinerToken, ['against', 'against'])), 'повторный бюллетень').not.toBeNull()
    const foreign = await ballot(third, joinerToken, ['for', 'for']).catch(() => null)
    if (foreign)
      expectCode(await gqlError(joinerToken, VOTE, foreign), 'KU_ACTION_SELF_ONLY')
    // Пайщик вне собрания не голосует.
    const outsider = ROLES.member()
    expect(await gqlError(outsiderToken, VOTE, {
      d: { coopname: COOP, hash, username: outsider.account, ballot: (await ballot(initiator, initiatorToken, ['for', 'for'])).d.ballot, votes: questions.map(q => ({ question_id: q.id, vote: 'for' })) },
    }), 'пайщик вне собрания').not.toBeNull()

    await gql(thirdToken, VOTE, await ballot(third, thirdToken, ['abstained', 'for']))

    const d = await voting(initiatorToken)
    expect(d.signed_ballots).toBe(3)
    const [first, second] = [...d.questions].sort((a: any, b: any) => a.number - b.number)
    expect([first.counter_votes_for, first.counter_votes_against, first.counter_votes_abstained]).toEqual([2, 0, 1])
    expect([second.counter_votes_for, second.counter_votes_against, second.counter_votes_abstained]).toEqual([2, 1, 0])
    expect(first.voters_abstained).toEqual([third.account])
    expect(second.voters_against).toEqual([joiner.account])
  })

  it(caseName('ku.dec.happy.07', 'председатель собрания утверждает протокол — собрание завершено; не организатор закрыть не может'), async () => {
    const protocol = await protocolOf(hash, initiator, initiatorToken, await voting(initiatorToken), 3)

    expectCode(await gqlError(joinerToken, CLOSE, { d: { coopname: COOP, hash, protocol } }), 'KU_ACTION_INITIATOR_ONLY')
    expect((await voting(initiatorToken)).status).toBe('VOTING')

    await gql(initiatorToken, CLOSE, { d: { coopname: COOP, hash, protocol } })
    const closed = await decision(joinerToken, hash)
    expect(closed).toMatchObject({ status: 'COMPLETED', present: false })

    // Завершённое собрание повторно не закрывается и бюллетени не принимает.
    expect(await gqlError(initiatorToken, CLOSE, { d: { coopname: COOP, hash, protocol } })).not.toBeNull()
    expect((await decision(joinerToken, hash)).status).toBe('COMPLETED')
  })
})

describe('собрание об учреждении участка', () => {
  const GEN_PETITION = `mutation($d:BranchEstablishmentPetitionGenerateDocumentInput!){ kuGenerateEstablishmentPetition(data:$d){ ${DOC} } }`
  const GEN_LIABILITY = `mutation($d:BranchTrusteeLiabilityAgreementGenerateDocumentInput!){ kuGenerateTrusteeLiabilityAgreement(data:$d){ ${DOC} } }`
  const GEN_AUTHORITY = `mutation($d:BranchTrusteePowerOfAttorneyGenerateDocumentInput!){ kuGenerateTrusteePowerOfAttorney(data:$d){ ${DOC} } }`
  const EXEC = `mutation($d:ExecKuDecisionInput!){ kuExecDecision(data:$d)${TX} }`
  const GEN_COUNCIL_DECISION = `mutation($d:BranchEstablishmentDecisionGenerateDocumentInput!){ kuGenerateEstablishmentDecision(data:$d){ ${DOC} } }`
  const NEW_BRANCH = 'query($d:GetBranchesInput!){ getBranches(data:$d){ braname short_name full_name fact_address trustee{ username } } }'

  const hash = randomHash()
  const braname = randomAccount('ku')
  const branchName = `Тестовый ${braname.slice(-5)}`
  const address = `Московская область, г. Красногорск, ул. Учредительная, д. ${hash.slice(0, 3)}`
  const contacts = { branch_email: `${braname}@example.com`, branch_phone: '+79990001122' }
  const founding = [
    { title: 'Учредить кооперативный участок', decision: `Учредить кооперативный участок «${branchName}»`, context: '' },
    { title: 'Избрать председателя участка', decision: 'Избрать председателем участка организатора собрания', context: '' },
  ]

  // Учредитель созывает собрание и избирается председателем нового участка:
  // свежий пайщик, который больше нигде не участвует.
  let founder: Who
  let founderToken = ''
  let questions: any[] = []
  /** Протокол совета об учреждении, которым председатель утвердил решение. */
  let councilDecision: any = null

  const voting = (token: string) => votingOf(token, hash)

  /** Пакет председателя участка в совет: заявление, договор матответственности, доверенность. */
  async function execPackage(who: Who, token: string) {
    const base = { coopname: COOP, username: who.account, hash, branch_name: branchName }
    const petition = (await gql<any>(token, GEN_PETITION, { d: { ...base, address, chairman: founder.account } })).kuGenerateEstablishmentPetition
    const liability = (await gql<any>(token, GEN_LIABILITY, { d: base })).kuGenerateTrusteeLiabilityAgreement
    const authority = (await gql<any>(token, GEN_AUTHORITY, { d: { ...base, branch_address: address } })).kuGenerateTrusteePowerOfAttorney
    return {
      petition: await signDocument(who.wif, petition, who.account, 1),
      liability: await signDocument(who.wif, liability, who.account, 1),
      authority: await signDocument(who.wif, authority, who.account, 1),
    }
  }

  beforeAll(async () => {
    founder = freshMember({ prefix: 'kuf' })
    founderToken = await login(founder)
    const generated = (await gql<any>(founderToken, GEN_PROPOSAL, {
      d: { coopname: COOP, username: founder.account, hash, type: 'createbranch', braname, questions: founding.map((q, i) => ({ number: String(i + 1), ...q })) },
    })).kuGenerateMeetingProposal
    const proposal = await signDocument(founder.wif, generated, founder.account, 1)
    await gql(founderToken, CREATE, {
      d: {
        coopname: COOP,
        hash,
        type: 'CREATEBRANCH',
        initiator: founder.account,
        braname,
        agenda: founding,
        proposal,
        meet_place: 'Красногорск, зал собраний',
        meet_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
      },
    })
    await gql(initiatorToken, JOIN, { d: { coopname: COOP, hash, username: initiator.account } })
    await gql(joinerToken, JOIN, { d: { coopname: COOP, hash, username: joiner.account } })
  }, 300_000)

  it(caseName('ku.dec.side.05', 'голосование об учреждении не открыть без наименования и контактов участка'), async () => {
    const start = { coopname: COOP, hash, chairman: founder.account, address }
    expectCode(await gqlError(founderToken, START, { d: start }), 'KU_BRANCH_NAME_REQUIRED')
    expectCode(await gqlError(founderToken, START, { d: { ...start, branch_name: branchName } }), 'KU_BRANCH_CONTACTS_REQUIRED')
    expectCode(await gqlError(founderToken, START, { d: { ...start, branch_name: branchName, branch_email: contacts.branch_email } }), 'KU_BRANCH_CONTACTS_REQUIRED')
    expect(await voting(founderToken)).toMatchObject({ status: 'OPENED', type: 'CREATEBRANCH', braname })
  })

  it(caseName('ku.dec.happy.04', 'собрание об учреждении голосует и утверждает протокол — собрание ждёт заявления в совет, протокол на странице собрания'), async () => {
    await gql(founderToken, START, { d: { coopname: COOP, hash, chairman: founder.account, address, branch_name: branchName, ...contacts } })
    const started = await voting(joinerToken)
    expect(started).toMatchObject({ status: 'VOTING', chairman: founder.account, address, branch_name: branchName, ...contacts })
    questions = byNumber(started.questions)
    expect(questions.map(q => q.title)).toEqual(founding.map(q => q.title))

    await gql(founderToken, VOTE, await ballotOf(hash, questions, founder, founderToken, ['for', 'for']))
    await gql(initiatorToken, VOTE, await ballotOf(hash, questions, initiator, initiatorToken, ['for', 'for']))
    await gql(joinerToken, VOTE, await ballotOf(hash, questions, joiner, joinerToken, ['for', 'abstained']))

    const voted = await voting(founderToken)
    expect(voted.signed_ballots).toBe(3)
    const [first, second] = byNumber(voted.questions)
    expect([first.counter_votes_for, first.counter_votes_against, first.counter_votes_abstained]).toEqual([3, 0, 0])
    expect([second.counter_votes_for, second.counter_votes_against, second.counter_votes_abstained]).toEqual([2, 0, 1])

    const protocol = await protocolOf(hash, founder, founderToken, voted, 3)
    await gql(founderToken, CLOSE, { d: { coopname: COOP, hash, protocol } })

    // Собрание об учреждении протоколом не заканчивается: оно ждёт заявления в совет.
    const approved = await voting(joinerToken)
    expect(approved).toMatchObject({ status: 'APPROVED', present: true })
    expect([protocol.hash, protocol.doc_hash].map(h => String(h).toLowerCase()), 'протокол на странице собрания').toContain(String(approved.protocol_document?.hash).toLowerCase())
    expect(byNumber(approved.questions).map((q: any) => q.counter_votes_for), 'счётчики голосов остались в вопросах').toEqual([3, 2])
  }, 300_000)

  it(caseName('ku.dec.side.06', 'заявление в совет подаёт только избранный председатель участка'), async () => {
    const foreign = await execPackage(joiner, joinerToken)
    expectCode(await gqlError(joinerToken, EXEC, { d: { coopname: COOP, hash, ...foreign } }), 'KU_ACTION_CHAIRMAN_ONLY')
    expectAuthDenied(await gqlError(null, EXEC, { d: { coopname: COOP, hash, ...foreign } }))
    expect((await voting(founderToken)).status).toBe('APPROVED')
    expect(await decisionByHash(hash), 'вопрос в совет не ушёл').toBeUndefined()
  })

  it(caseName('ku.dec.happy.08', 'председатель участка подаёт заявление — вопрос об учреждении уходит в совет; совет утверждает — участок появляется с карточкой и председателем'), async () => {
    await gql(founderToken, EXEC, { d: { coopname: COOP, hash, ...await execPackage(founder, founderToken) } })
    expect((await voting(joinerToken)).status).toBe('ONAPPROVAL')
    // Повторная подача заявления по тому же собранию — отказ.
    expect(await gqlError(founderToken, EXEC, { d: { coopname: COOP, hash, ...await execPackage(founder, founderToken) } }), 'повторное заявление').not.toBeNull()

    const item = await awaitDecision(hash, 'вопрос совета об учреждении участка')
    expect(String(item.type)).toBe('branchdec')
    expect(String(item.username)).toBe(founder.account)
    await voteOnDecision(Number(item.id), 'for')
    // Председатель совета утверждает решение своим протоколом об учреждении участка.
    const chairmanToken = await tokenOf(CHAIRMAN)
    // Протокол собирается по голосам из журнала действий узла — ждём их разбора.
    const generated = (await waitFor(() => gql<any>(chairmanToken, GEN_COUNCIL_DECISION, {
      d: { coopname: COOP, username: CHAIRMAN.account, decision_id: Number(item.id), branch_name: branchName, address, chairman: founder.account },
    }), { timeoutMs: 30_000, intervalMs: 1_500, label: 'протокол решения совета об учреждении' })).kuGenerateEstablishmentDecision
    councilDecision = await signDocument(CHAIRMAN.wif, generated, CHAIRMAN.account, 1)
    await authorizeDecisionOnChain(Number(item.id), toChainDoc(councilDecision))

    // Карточку участка узел заводит по событию решения совета.
    const branch = await waitFor(async () => {
      const list = (await gql<any>(founderToken, NEW_BRANCH, { d: { coopname: COOP, braname } })).getBranches as any[]
      return list[0] ?? null
    }, { timeoutMs: 90_000, intervalMs: 2_000, label: `участок ${braname} с карточкой` })
    expect(branch.trustee.username).toBe(founder.account)
    expect(branch.fact_address).toBe(address)
    expect(branch.short_name).toContain(branchName)
    expect(branch.full_name).toContain(branchName)

    expect(await voting(joinerToken)).toMatchObject({ status: 'COMPLETED', present: false })
    // Учреждённое собрание не отменить и повторно в совет не подать.
    expect(await gqlError(founderToken, CANCEL, { d: { coopname: COOP, hash, reason: 'после учреждения' } })).not.toBeNull()
  }, 300_000)

  it(caseName('ku.dec.happy.09', 'после учреждения протокол собрания остаётся на его странице'), async () => {
    expect((await voting(joinerToken)).protocol_document?.hash, 'протокол собрания остался на странице').toBeTruthy()
  })

  // До 02.10.2026 решения совета на странице не было: действие совета стирает запись собрания,
  // не записав в неё документ решения (C28-85, находка 66). Теперь его сохраняет узел.
  it(caseName('ku.dec.happy.10', 'решение совета об учреждении видно на странице собрания'), async () => {
    expect(councilDecision, 'решение совета принято предыдущим шагом').toBeTruthy()
    const shown = await waitFor(async () => (await voting(joinerToken)).authorization_document ?? null,
      { timeoutMs: 60_000, intervalMs: 1_500, label: 'решение совета на странице собрания' })
    expect([councilDecision.hash, councilDecision.doc_hash].map(h => String(h).toLowerCase())).toContain(String(shown.hash).toLowerCase())
  })
})

describe('заявки доверенных лиц участка', () => {
  const declinedHash = randomHash()
  const approvedHash = randomHash()

  it(caseName('ku.trust.side.01', 'подать заявку за другого пайщика нельзя'), async () => {
    const pkg = await signedTrustPackage(joiner, joinerToken, declinedHash)
    expectCode(await gqlError(joinerToken, REQUEST, {
      d: { coopname: COOP, braname: BRANCH_ODN, username: applicant.account, hash: declinedHash, ...pkg },
    }), 'KU_ACTION_SELF_ONLY')
    expect(await trustRequest(branchChairToken, applicant.account, declinedHash)).toBeNull()
  })

  it(caseName('ku.trust.happy.01', 'пайщик подаёт заявку в доверенные — председатель участка видит её с подписанными документами'), async () => {
    const pkg = await signedTrustPackage(applicant, applicantToken, declinedHash)
    await gql(applicantToken, REQUEST, { d: { coopname: COOP, braname: BRANCH_ODN, username: applicant.account, hash: declinedHash, ...pkg } })

    const r = await trustRequest(branchChairToken, applicant.account, declinedHash)
    expect(r, 'заявка в списке председателя участка').toBeTruthy()
    expect(r).toMatchObject({ username: applicant.account, braname: BRANCH_ODN, present: true, coopname: COOP })
    expect(r.document.rawDocument.hash.toLowerCase()).toBe(pkg.application.doc_hash.toLowerCase())
    expect(r.document.document.signatures.map((s: any) => s.signer)).toEqual([applicant.account])
    expect(r.authority_document.document.signatures.map((s: any) => s.signer)).toEqual([applicant.account])
  })

  it(caseName('ku.trust.side.02', 'решать по заявке может только председатель своего участка'), async () => {
    expectCode(await gqlError(foreignChairToken, DECLINE, { d: { coopname: COOP, hash: declinedHash, reason: 'чужой участок' } }), 'KU_ACTION_BRANCH_CHAIRMAN_ONLY')
    expectCode(await gqlError(applicantToken, DECLINE, { d: { coopname: COOP, hash: declinedHash, reason: 'сам себе' } }), 'KU_ACTION_BRANCH_CHAIRMAN_ONLY')
    expectCode(await gqlError(branchChairToken, DECLINE, { d: { coopname: COOP, hash: randomHash(), reason: 'нет такой' } }), 'KU_TRUST_REQUEST_NOT_FOUND')
    expectAuthDenied(await gqlError(null, DECLINE, { d: { coopname: COOP, hash: declinedHash, reason: 'гость' } }))
    expect((await trustRequest(branchChairToken, applicant.account, declinedHash)).present).toBe(true)
  })

  it(caseName('ku.trust.happy.02', 'председатель участка отклоняет заявку — заявка закрыта, доверенным пайщик не стал'), async () => {
    await gql(branchChairToken, DECLINE, { d: { coopname: COOP, hash: declinedHash, reason: 'Проверка отказа' } })
    expect((await trustRequest(branchChairToken, applicant.account, declinedHash)).present).toBe(false)
    expect(await trustedOf(branchChairToken, BRANCH_ODN)).not.toContain(applicant.account)

    // ku.dec.side.03: повторное отклонение уже закрытой заявки — отказ с кодом, не внутренняя ошибка.
    const again = await gqlError(branchChairToken, DECLINE, { d: { coopname: COOP, hash: declinedHash, reason: 'Повторный отказ' } })
    expect(again, 'повторное отклонение отвергнуто').not.toBeNull()
    expect(['500', 'INTERNAL_SERVER_ERROR', 'null'], JSON.stringify(again)).not.toContain(String(again!.code))
    expect((await trustRequest(branchChairToken, applicant.account, declinedHash)).present).toBe(false)
  })

  it(caseName('ku.trust.happy.03', 'заявка одобряется встречной подписью председателя участка — пайщик в доверенных лицах'), async () => {
    // Отдельный заявитель: одинаковый пакет того же пайщика в ту же минуту даёт
    // тот же хеш документа (см. отчёт), а проверяется здесь одобрение.
    const pkg = await signedTrustPackage(approvedApplicant, approvedApplicantToken, approvedHash)
    await gql(approvedApplicantToken, REQUEST, { d: { coopname: COOP, braname: BRANCH_ODN, username: approvedApplicant.account, hash: approvedHash, ...pkg } })
    const r = await trustRequest(branchChairToken, approvedApplicant.account, approvedHash)
    expect(r?.present).toBe(true)

    const countersigned = await signDocument(branchChair.wif, r.document.rawDocument, branchChair.account, 2, [r.document.document])
    const countersignedAuthority = await signDocument(branchChair.wif, r.authority_document.rawDocument, branchChair.account, 2, [r.authority_document.document])
    await gql(branchChairToken, APPROVE, { d: { coopname: COOP, hash: approvedHash, countersigned, countersigned_authority: countersignedAuthority } })

    expect((await trustRequest(branchChairToken, approvedApplicant.account, approvedHash)).present).toBe(false)
    expect(await trustedOf(branchChairToken, BRANCH_ODN)).toContain(approvedApplicant.account)
  })

  it(caseName('ku.trust.side.05', 'два пакета одного пайщика подряд, подана первая заявка — встречная подпись ложится на её документ'), async () => {
    // До 25.09.2026 тело договора и блок у двух генераций совпадали, вторая
    // версия черновика затирала первую, и встречная подпись первой заявки
    // падала «Хэш метаданных не совпадает» (C28-80).
    const twice = freshMember({ prefix: 'kuw' })
    const twiceToken = await login(twice)
    const firstHash = randomHash()
    const first = await signedTrustPackage(twice, twiceToken, firstHash)
    await signedTrustPackage(twice, twiceToken, randomHash())
    await gql(twiceToken, REQUEST, { d: { coopname: COOP, braname: BRANCH_ODN, username: twice.account, hash: firstHash, ...first } })

    const r = await trustRequest(branchChairToken, twice.account, firstHash)
    const countersigned = await signDocument(branchChair.wif, r.document.rawDocument, branchChair.account, 2, [r.document.document])
    const countersignedAuthority = await signDocument(branchChair.wif, r.authority_document.rawDocument, branchChair.account, 2, [r.authority_document.document])
    await gql(branchChairToken, APPROVE, { d: { coopname: COOP, hash: firstHash, countersigned, countersigned_authority: countersignedAuthority } })
    expect(await trustedOf(branchChairToken, BRANCH_ODN)).toContain(twice.account)
  })

  it(caseName('ku.trust.side.03', 'список заявок гостю закрыт'), async () => {
    expectAuthDenied(await gqlError(null, REQUESTS, { f: { username: applicant.account } }))
  })

  it(caseName('ku.trust.side.04', 'посторонний пайщик не видит чужие заявки с договором и доверенностью, заявитель видит свою'), async () => {
    // Договор и доверенность несут паспорт, адрес и телефон заявителя.
    expect(await trustRequest(outsiderToken, applicant.account, declinedHash)).toBeNull()
    expect(await trustRequest(foreignChairToken, applicant.account, declinedHash)).toBeNull()
    const own = await trustRequest(applicantToken, applicant.account, declinedHash)
    expect(own?.username).toBe(applicant.account)
  })
})

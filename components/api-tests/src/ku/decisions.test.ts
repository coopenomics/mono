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
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COOP, ROLES, caseName, freshMember, gql, gqlError, login, signDocument, tokenOf } from '../core'
import type { GqlError } from '../core'

const AUTH_CODES = ['401', 'UNAUTHENTICATED', 'KIT_USER_NOT_AUTHORIZED', 'KIT_SESSION_ENDED']
function expectAuthDenied(err: GqlError | null): void {
  expect(err, 'ожидался отказ входа').not.toBeNull()
  expect(AUTH_CODES, JSON.stringify(err)).toContain(String(err!.code))
}
function expectCode(err: GqlError | null, code: string): void {
  expect(err, `ожидался отказ ${code}`).not.toBeNull()
  expect(String(err!.code), JSON.stringify(err)).toBe(code)
}

const newHash = (): string => crypto.randomBytes(32).toString('hex')

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
  const hash = newHash()
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

  it(caseName('ku.dec.happy.03', 'организатор отменяет собрание — оно остаётся в истории отменённым'), async () => {
    await gql(initiatorToken, CANCEL, { d: { coopname: COOP, hash, reason: 'Проверка отмены' } })
    const d = await decision(joinerToken, hash)
    expect(d).toMatchObject({ status: 'CANCELLED', present: false })
    expect(d.questions).toEqual([])
  })
})

describe('заявки доверенных лиц участка', () => {
  const declinedHash = newHash()
  const approvedHash = newHash()

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
    expectCode(await gqlError(branchChairToken, DECLINE, { d: { coopname: COOP, hash: newHash(), reason: 'нет такой' } }), 'KU_TRUST_REQUEST_NOT_FOUND')
    expectAuthDenied(await gqlError(null, DECLINE, { d: { coopname: COOP, hash: declinedHash, reason: 'гость' } }))
    expect((await trustRequest(branchChairToken, applicant.account, declinedHash)).present).toBe(true)
  })

  it(caseName('ku.trust.happy.02', 'председатель участка отклоняет заявку — заявка закрыта, доверенным пайщик не стал'), async () => {
    await gql(branchChairToken, DECLINE, { d: { coopname: COOP, hash: declinedHash, reason: 'Проверка отказа' } })
    expect((await trustRequest(branchChairToken, applicant.account, declinedHash)).present).toBe(false)
    expect(await trustedOf(branchChairToken, BRANCH_ODN)).not.toContain(applicant.account)
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
    const firstHash = newHash()
    const first = await signedTrustPackage(twice, twiceToken, firstHash)
    await signedTrustPackage(twice, twiceToken, newHash())
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

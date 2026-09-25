/**
 * Одобрения председателя снаружи (chairman_approvals).
 *
 * Одобрение заводит контракт: пайщик регистрируется в Благоросте
 * (capital::regcontrib), и договор УХД уходит председателю на одобрение
 * (soviet::createapprv). Таблицу узла заполняет разбор дельт цепи; мутация
 * регистрации отвечает после разбора своего блока, так что одобрение видно
 * сразу. Председатель одобряет встречной подписью того же документа или
 * отклоняет с причиной.
 *
 * Заявители — свежие пайщики: их договоры больше нигде не участвуют.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COUNCIL, caseName, freshMember, gql, gqlError, login, signDocument, tokenOf } from '../core'
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

const DOC = 'full_title html hash meta binary'
const SIGNED = 'version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta }'
const APPROVAL = `_id id coopname username approval_hash status callback_contract callback_action_approve callback_action_decline present
  document{ hash rawDocument{ ${DOC} } document{ ${SIGNED} } }
  approved_document{ hash document{ ${SIGNED} } }`

const GEN_REG = `mutation($d:GenerateCapitalRegistrationDocumentsInputDTO!){ capitalGenerateRegistrationDocuments(data:$d){
  generation_contract{ ${DOC} } storage_agreement{ ${DOC} } blagorost_agreement{ ${DOC} } generator_offer{ ${DOC} } } }`
const COMPLETE_REG = 'mutation($d:CompleteCapitalRegistrationInputDTO!){ capitalCompleteRegistration(data:$d){ __typename } }'
const LIST = `query($f:ApprovalFilter,$o:PaginationInput){ chairmanApprovals(filter:$f, options:$o){ totalCount items{ ${APPROVAL} } } }`
const ONE = `query($id:String!){ chairmanApproval(id:$id){ ${APPROVAL} } }`
const CONFIRM = `mutation($d:ConfirmApproveInput!){ chairmanConfirmApprove(data:$d){ ${APPROVAL} } }`
const DECLINE = `mutation($d:DeclineApproveInput!){ chairmanDeclineApprove(data:$d){ ${APPROVAL} } }`

const PAGE = { page: 1, limit: 50, sortOrder: 'DESC' }

/** Регистрация пайщика в Благоросте тем же путём, что страница регистрации рабочего стола. */
async function registerInCapital(who: Who, token: string): Promise<void> {
  const docs = (await gql<any>(token, GEN_REG, { d: { coopname: COOP, username: who.account } })).capitalGenerateRegistrationDocuments
  expect(docs.storage_agreement, 'соглашение о хранении сгенерировано').toBeTruthy()
  const sign = async (d: any) => d ? signDocument(who.wif, d, who.account, 1) : undefined
  await gql(token, COMPLETE_REG, {
    d: {
      coopname: COOP,
      username: who.account,
      generation_contract: await sign(docs.generation_contract),
      storage_agreement: await sign(docs.storage_agreement),
      blagorost_agreement: await sign(docs.blagorost_agreement),
      generator_offer: await sign(docs.generator_offer),
    },
  })
}

async function approvalsOf(token: string, username: string, statuses?: string[]): Promise<any[]> {
  const d = (await gql<any>(token, LIST, { f: { coopname: COOP, username, ...(statuses ? { statuses } : {}) }, o: PAGE })).chairmanApprovals
  return d.items
}

let approvedWho: Who
let declinedWho: Who
let approvedToken: string
let declinedToken: string
let chairToken: string
let councilToken: string
let pendingApproval: any
let declinedApproval: any

beforeAll(async () => {
  approvedWho = freshMember({ prefix: 'apa' })
  declinedWho = freshMember({ prefix: 'apd' })
  approvedToken = await login(approvedWho)
  declinedToken = await login(declinedWho)
  chairToken = await tokenOf(CHAIRMAN)
  councilToken = await tokenOf(COUNCIL)
})

describe('одобрения председателя', () => {
  it(caseName('chair.appr.happy.01', 'регистрация в Благоросте заводит одобрение — председатель видит его с подписанным договором'), async () => {
    await registerInCapital(approvedWho, approvedToken)
    const [a] = await approvalsOf(chairToken, approvedWho.account, ['PENDING'])
    expect(a, 'одобрение по договору пайщика').toBeTruthy()
    expect(a).toMatchObject({ coopname: COOP, username: approvedWho.account, status: 'PENDING', present: true, callback_contract: 'capital' })
    expect(a.document.rawDocument, 'исходник документа для встречной подписи').toBeTruthy()
    expect(a.document.document.signatures.map((s: any) => s.signer)).toEqual([approvedWho.account])
    expect(a.approved_document).toBeNull()
    pendingApproval = a

    const byId = (await gql<any>(chairToken, ONE, { id: a._id })).chairmanApproval
    expect(byId).toMatchObject({ _id: a._id, approval_hash: a.approval_hash, status: 'PENDING' })
  })

  it(caseName('chair.appr.side.01', 'список одобрений: совету открыт, пайщику — только свои, гостю закрыт'), async () => {
    expect((await approvalsOf(councilToken, approvedWho.account)).map(a => a._id)).toContain(pendingApproval._id)
    expect((await approvalsOf(approvedToken, approvedWho.account)).map(a => a._id)).toEqual([pendingApproval._id])
    expectCode(await gqlError(declinedToken, LIST, { f: { coopname: COOP, username: approvedWho.account }, o: PAGE }), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(declinedToken, LIST, { f: { coopname: COOP }, o: PAGE }), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(declinedToken, ONE, { id: pendingApproval._id }), 'KIT_INSUFFICIENT_RIGHTS')
    expectAuthDenied(await gqlError(null, LIST, { f: { coopname: COOP }, o: PAGE }))
  })

  it(caseName('chair.appr.side.02', 'решение по одобрению принимает только председатель; неизвестное одобрение — отказ'), async () => {
    const d = { d: { coopname: COOP, approval_hash: pendingApproval.approval_hash, reason: 'не председатель' } }
    expectCode(await gqlError(councilToken, DECLINE, d), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(approvedToken, DECLINE, d), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(councilToken, CONFIRM, { d: { coopname: COOP, approval_hash: pendingApproval.approval_hash } }), 'KIT_INSUFFICIENT_RIGHTS')
    expectAuthDenied(await gqlError(null, CONFIRM, { d: { coopname: COOP, approval_hash: pendingApproval.approval_hash } }))
    expectCode(await gqlError(chairToken, CONFIRM, { d: { coopname: COOP, approval_hash: crypto.randomBytes(32).toString('hex') } }), 'CHAIRMAN_APPROVAL_NOT_FOUND')
    expect((await approvalsOf(chairToken, approvedWho.account))[0].status).toBe('PENDING')
  })

  it(caseName('chair.appr.happy.02', 'председатель одобряет встречной подписью — одобрение закрыто'), async () => {
    const approved_document = await signDocument(CHAIRMAN.wif, pendingApproval.document.rawDocument, CHAIRMAN.account, 2, [pendingApproval.document.document])
    const r = (await gql<any>(chairToken, CONFIRM, {
      d: { coopname: COOP, approval_hash: pendingApproval.approval_hash.toLowerCase(), approved_document },
    })).chairmanConfirmApprove
    expect(r).toMatchObject({ _id: pendingApproval._id, status: 'APPROVED' })

    const [a] = await approvalsOf(chairToken, approvedWho.account, ['APPROVED'])
    expect(a?._id).toBe(pendingApproval._id)
    expect(await approvalsOf(chairToken, approvedWho.account, ['PENDING'])).toEqual([])
  })

  it(caseName('chair.appr.side.05', 'одобрение подтверждено — одобренный документ с двумя подписями отдаётся'), async () => {
    const [a] = await approvalsOf(chairToken, approvedWho.account, ['APPROVED'])
    expect(a.approved_document).not.toBeNull()
    expect(a.approved_document.document.signatures).toHaveLength(2)
  })

  it(caseName('chair.appr.side.06', 'одобрение закрыто — строки в цепи больше нет, признак «в цепи» снят'), async () => {
    const [a] = await approvalsOf(chairToken, approvedWho.account, ['APPROVED'])
    expect(a.present).toBe(false)
  })

  it(caseName('chair.appr.happy.03', 'председатель отклоняет одобрение с причиной — статус отклонён'), async () => {
    await registerInCapital(declinedWho, declinedToken)
    const [a] = await approvalsOf(chairToken, declinedWho.account, ['PENDING'])
    expect(a, 'одобрение второго пайщика').toBeTruthy()
    declinedApproval = a
    const r = (await gql<any>(chairToken, DECLINE, { d: { coopname: COOP, approval_hash: a.approval_hash.toLowerCase(), reason: 'Проверка отклонения' } })).chairmanDeclineApprove
    expect(r).toMatchObject({ _id: a._id, status: 'DECLINED' })
    const [after] = await approvalsOf(chairToken, declinedWho.account, ['DECLINED'])
    expect(after?._id).toBe(a._id)
    expect(after.present).toBe(false)
  })

  it(caseName('chair.appr.side.04', 'фильтр по статусу отдаёт только этот статус'), async () => {
    const declined = await approvalsOf(chairToken, declinedWho.account, ['DECLINED'])
    expect(declined.map(a => a._id)).toEqual([declinedApproval._id])
    expect(await approvalsOf(chairToken, declinedWho.account, ['APPROVED', 'PENDING'])).toEqual([])
  })
})

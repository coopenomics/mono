/**
 * Договор преподавателя «Образования» снаружи, вторая часть
 * (test-registry/edubridge.teacher.yaml): отказ председателя, просмотр
 * договора, прекращение по соглашению сторон и новый договор.
 *
 * Преподаватель — свежий пайщик: его договор отклоняется, подписывается
 * заново, действует и прекращается в одном прогоне.
 */
import { Cooperative } from 'cooptypes'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COUNCIL, caseName, expectCode, freshMember, gql, gqlError, login, tokenOf, waitFor } from '../core'
import { blank, templates } from '../documents/docs-reports.helpers'
import {
  CLOSE_ASSIGNMENT,
  CREATE_ASSIGNMENT,
  EXTENSION,
  MY_CONTRACT,
  MY_PROFILE,
  NO_RIGHTS,
  SAVE_PROFILE,
  SET_TEACHER_RATE,
  SIGN_CONTRACT,
  TEACHERS,
  approveContract,
  createSection,
  dayFromNow,
  deskGrants,
  educationOff,
  educationOn,
  pendingContractApproval,
  publishCourse,
  signOffer,
  signedContract,
} from './edubridge.helpers'

const CONTRACT_DOC = 'hash document{ hash signatures{ id signer } }'
const MY_CONTRACT_DOCUMENT = `query{ edubridgeMyContractDocument{ ${CONTRACT_DOC} } }`
const TEACHER_CONTRACT_DOCUMENT = `query($u:String!){ edubridgeTeacherContractDocument(username:$u){ ${CONTRACT_DOC} } }`
const TEACHER_OPTIONS = 'query{ edubridgeTeacherOptions{ username display_name contract_number } }'
const TERMINATE = 'mutation($u:String!,$r:String!){ edubridgeTerminateContract(username:$u, reason:$r){ contract_number status } }'
const DECLINE_APPROVAL = 'mutation($d:DeclineApproveInput!){ chairmanDeclineApprove(data:$d){ _id status } }'
const GENERATE = 'mutation($i:GenerateAnyDocumentInput!){ generateDocument(input:$i){ full_title html hash } }'

const R = Cooperative.Registry
const RATE = '900.0000 RUB'

describe('Образование: договор преподавателя — отказ, просмотр, прекращение', () => {
  let chairman = ''
  let section = ''
  let teacher: Who
  let token = ''
  let plain: Who
  let contract: any

  const contractOf = async () => (await gql<any>(token, MY_CONTRACT)).edubridgeMyContract
  const sign = async () => {
    const { document, contract_number } = await signedContract(teacher, token)
    return (await gql<any>(token, SIGN_CONTRACT, { d: { document, contract_number } })).edubridgeSignContract
  }
  const rowOf = async () => ((await gql<any>(chairman, TEACHERS)).edubridgeTeachers as any[]).find(t => t.username === teacher.account)

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    section = await createSection(chairman)
    teacher = freshMember({ prefix: 'edux' })
    token = await login(teacher)
    plain = freshMember({ prefix: 'eduz' })
    await gql(token, SAVE_PROFILE, { d: { about: 'Веду химию' } })
    await signOffer(teacher, token, 'TEACHER')
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  it(caseName('edu.teach.side.23', 'председатель отклоняет договор преподавателя: договор отклонён с причиной и подписывается заново'), async () => {
    const first = await sign()
    expect(first.status).toBe('PENDING_APPROVAL')
    const approval = await waitFor(() => pendingContractApproval(teacher.account),
      { timeoutMs: 60_000, intervalMs: 1_000, label: 'договор на столе одобрений председателя' })
    await gql(chairman, DECLINE_APPROVAL, { d: { coopname: COOP, approval_hash: String(approval.approval_hash).toLowerCase(), reason: 'Не указан опыт преподавания' } })

    const declined = await waitFor(async () => {
      const c = await contractOf()
      return c?.status === 'DECLINED' && c.decline_reason ? c : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'договор отклонён председателем' })
    expect(declined).toMatchObject({ contract_number: first.contract_number, decline_reason: 'Не указан опыт преподавания', approved_at: null })
    // Отклонённый договор стол преподавателя не открывает.
    expect(await deskGrants(token)).toContain('Onboarding:teacher')

    // Договор подписывается заново и на этот раз подписан председателем.
    const second = await sign()
    expect(second).toMatchObject({ status: 'PENDING_APPROVAL', decline_reason: '', hourly_rate: '0.0000 RUB' })
    // Ставку за час назначает администратор при приёме преподавателя.
    await gql(chairman, SET_TEACHER_RATE, { d: { username: teacher.account, hourly_rate: RATE } })
    expect(second.contract_hash).not.toBe(first.contract_hash)
    await approveContract(await waitFor(() => pendingContractApproval(teacher.account), { timeoutMs: 60_000, intervalMs: 1_000, label: 'новый договор на столе одобрений' }))
    contract = await waitFor(async () => {
      const c = await contractOf()
      return c?.status === 'ACTIVE' ? c : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'новый договор действует' })
    expect(contract.contract_hash).toBe(second.contract_hash)
  }, 480_000)

  it(caseName('edu.teach.side.22', 'просмотр договора: после подписи председателя в нём две подписи; у пайщика без договора документа нет'), async () => {
    const own = (await gql<any>(token, MY_CONTRACT_DOCUMENT)).edubridgeMyContractDocument
    expect(String(own.hash).toLowerCase()).toBe(contract.contract_hash)
    expect(own.document.signatures.map((s: any) => s.signer)).toEqual([teacher.account, CHAIRMAN.account])

    const forAdmin = (await gql<any>(await tokenOf(COUNCIL), TEACHER_CONTRACT_DOCUMENT, { u: teacher.account })).edubridgeTeacherContractDocument
    expect(forAdmin.hash).toBe(own.hash)
    expect((await gql<any>(chairman, TEACHER_CONTRACT_DOCUMENT, { u: plain.account })).edubridgeTeacherContractDocument).toBeNull()
    // Чужой договор преподаватель не читает.
    expectCode(await gqlError(token, TEACHER_CONTRACT_DOCUMENT, { u: teacher.account }), NO_RIGHTS)
  })

  let course: any
  let assignment: any

  it(caseName('edu.teach.side.06', 'список преподавателей: снятый допуск в действующие не идёт, пайщика без договора в списке нет'), async () => {
    course = await publishCourse(chairman, section, 30)
    assignment = (await gql<any>(chairman, CREATE_ASSIGNMENT, {
      d: { teacher_username: teacher.account, course_id: course.id, period_from: dayFromNow(0), period_to: dayFromNow(90) },
    })).edubridgeCreateAssignment
    expect(await rowOf()).toMatchObject({ assignments_total: 1, assignments_active: 1, contract_status: 'ACTIVE' })

    const list = (await gql<any>(chairman, TEACHERS)).edubridgeTeachers as any[]
    expect(list.map(t => t.username)).not.toContain(plain.account)
    const options = (await gql<any>(chairman, TEACHER_OPTIONS)).edubridgeTeacherOptions as any[]
    expect(options.find(o => o.username === teacher.account)).toMatchObject({ contract_number: contract.contract_number })
    expect(options.map(o => o.username)).not.toContain(plain.account)
  })

  it(caseName('edu.teach.side.profile-01', 'список преподавателей несёт рассказ о себе; ставка — из договора и закреплена'), async () => {
    expect(await rowOf()).toMatchObject({ about: 'Веду химию', hourly_rate: RATE })
    expect((await gql<any>(token, MY_PROFILE)).edubridgeMyTeacherProfile).toEqual({ about: 'Веду химию', hourly_rate: RATE, rate_locked: true })
    // Рассказ правится и при закреплённой ставке.
    await gql(token, SAVE_PROFILE, { d: { about: 'Веду химию и биологию' } })
    expect((await rowOf()).about).toBe('Веду химию и биологию')
  })

  it(caseName('edu.teach.side.15', 'договор не прекращается при действующем допуске к курсу и без основания'), async () => {
    expectCode(await gqlError(chairman, TERMINATE, { u: teacher.account, r: '   ' }), 'EDUBRIDGE_CONTRACT_TERMINATION_REASON_REQUIRED')
    expectCode(await gqlError(chairman, TERMINATE, { u: teacher.account, r: 'Соглашение сторон' }), 'EDUBRIDGE_TEACHER_HAS_OPEN_ASSIGNMENTS')
    expectCode(await gqlError(token, TERMINATE, { u: teacher.account, r: 'Сам' }), NO_RIGHTS)
    expect((await contractOf()).status).toBe('ACTIVE')
    // У пайщика без договора прекращать нечего.
    expect((await gql<any>(chairman, TERMINATE, { u: plain.account, r: 'Соглашение сторон' })).edubridgeTerminateContract).toBeNull()
  })

  it(caseName('edu.teach.happy.11', 'прекращение договора по соглашению сторон; новый договор подписывается без ставки — её назначают заново'), async () => {
    await gql(chairman, CLOSE_ASSIGNMENT, { id: assignment.id })
    expect(await rowOf()).toMatchObject({ assignments_total: 1, assignments_active: 0 })

    const ended = (await gql<any>(chairman, TERMINATE, { u: teacher.account, r: 'Соглашение сторон' })).edubridgeTerminateContract
    expect(ended).toMatchObject({ contract_number: contract.contract_number, status: 'TERMINATED' })
    expect((await contractOf()).status).toBe('TERMINATED')
    // Повторное прекращение ничего не меняет.
    expect((await gql<any>(chairman, TERMINATE, { u: teacher.account, r: 'Ещё раз' })).edubridgeTerminateContract.status).toBe('TERMINATED')
    // Прекращённый договор стол преподавателя закрывает и ставку не держит.
    expect(await deskGrants(token)).toContain('Onboarding:teacher')
    expect((await gql<any>(token, MY_PROFILE)).edubridgeMyTeacherProfile.rate_locked).toBe(false)

    // Новый договор — ставка назначается заново: названная преподавателем не принимается.
    await gql(token, SAVE_PROFILE, { d: { about: 'Веду химию и биологию', hourly_rate: '950.0000 RUB' } })
    const again = await sign()
    expect(again).toMatchObject({ status: 'PENDING_APPROVAL', hourly_rate: '0.0000 RUB' })
    expect(again.contract_hash).not.toBe(contract.contract_hash)
  })

  it(caseName('edu.teacher.doc.01', 'бланк договора для совета и экземпляр преподавателя: один текст, в экземпляре — номер и пайщик, в бланке — прочерки'), async () => {
    const template = await blank(chairman, R.EducationParticipationContract.registry_id, 'Approved')
    const number = 'A1B2C3D4E5F60718'
    const instance = (await gql<any>(token, GENERATE, {
      i: { data: { registry_id: R.EducationParticipationContract.registry_id, coopname: COOP, username: teacher.account, contract_number: number, contract_created_at: '06.10.2026' } },
    })).generateDocument
    expect(template.html).toContain('______')
    expect(instance.html).toContain(number)
    expect(instance.html).not.toMatch(/undefined|\[object Object\]|\{\{|\}\}/)
    expect(template.html).not.toMatch(/undefined|\[object Object\]|\{\{|\}\}/)
    // Экземпляр длиннее бланка не более чем на подставленные сведения: текст разделов один.
    expect(Math.abs(instance.html.length - template.html.length)).toBeLessThan(template.html.length * 0.2)
    expect(instance.hash).toMatch(/^[0-9a-fA-F]{64}$/)
  })

  it(caseName('edu.teach.happy.wth-02', 'заявление о трансляции паевого взноса объявлено бланком в связке форм образования и утверждено советом'), async () => {
    const id = R.EducationShareWithdrawStatement.registry_id
    const declared = (await templates(chairman)).filter(t => t.extension_name === EXTENSION)
    const statement = declared.find(t => t.registry_id === id)
    expect(statement, `заявление ${id} в реестре шаблонов`).toMatchObject({ kind: 'Form', approval: 'Required', state: 'Approved' })
    const forms = declared.filter(t => t.kind === 'Form')
    expect(forms.every(f => f.bundle === statement!.bundle), 'все бланки образования — в одной связке').toBe(true)
    expect((await blank(chairman, id, 'Approved')).html).not.toMatch(/undefined|\[object Object\]/)
  })
})

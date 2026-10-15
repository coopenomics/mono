/**
 * Связки «Образования» с ядром снаружи (test-registry/chairman.approvals.yaml,
 * documents.approvals.yaml, realtime.chain-changes.yaml,
 * sync.write-wait-delta.yaml): одобрение договора преподавателя у
 * председателя, дата протокола совета в документах, лента изменений столов.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, caseName, freshMember, gql, login, tokenOf, waitFor } from '../core'
import { inbox } from '../documents/docs-reports.helpers'
import { chainChangesOf, quietWindow, settleSubscriptions, signalsOf, waitSignal, wsAs } from '../platform/platform-a.helpers'
import {
  EXTENSION,
  MY_CONTRACT,
  SAVE_PROFILE,
  SIGN_CONTRACT,
  addLearner,
  approveContract,
  createSection,
  educationOff,
  educationOn,
  pendingContractApproval,
  publishCourse,
  signOffer,
  signedContract,
} from './edubridge.helpers'

const GENERATE = 'mutation($i:GenerateAnyDocumentInput!){ generateDocument(input:$i){ full_title html hash } }'

describe('Образование: связки с ядром — одобрения, протоколы, лента изменений', () => {
  let chairman = ''
  let teacher: Who
  let token = ''
  let approval: any

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    teacher = freshMember({ prefix: 'edulk' })
    token = await login(teacher)
    await gql(token, SAVE_PROFILE, { d: { about: 'Веду историю' } })
    await signOffer(teacher, token, 'TEACHER')
    const { document, contract_number } = await signedContract(teacher, token)
    await gql(token, SIGN_CONTRACT, { d: { document, contract_number } })
    approval = await waitFor(() => pendingContractApproval(teacher.account),
      { timeoutMs: 60_000, intervalMs: 1_000, label: 'договор преподавателя на столе одобрений' })
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  it(caseName('chair.appr.side.08', 'в уведомлении председателю об одобрении договора преподавателя назван сам договор'), async () => {
    expect(approval).toMatchObject({ callback_contract: EXTENSION, username: teacher.account, status: 'PENDING' })
    const note = await waitFor(async () => {
      const items = await inbox(chairman, 100)
      return items.find(i => JSON.stringify(i.payload ?? {}).toLowerCase().includes(String(approval.approval_hash).toLowerCase())) ?? null
    }, { timeoutMs: 90_000, intervalMs: 3_000, label: 'уведомление председателю об одобрении договора преподавателя' })
    expect(note.body).toContain('Договор УХД преподавателя')
    expect(note.body).not.toContain('Новый запрос на одобрение')
  }, 180_000)

  it(caseName('sync.wwd.happy.03', 'после подписи председателя договор действует сразу: ответ уже видит дату подписи из цепи'), async () => {
    await approveContract(approval)
    // Без ожидания: подпись председателя отвечает после разбора своего блока.
    const contract = (await gql<any>(token, MY_CONTRACT)).edubridgeMyContract
    expect(contract.status).toBe('ACTIVE')
    expect(contract.approved_at, 'дата подписи председателя').toBeTruthy()
    expect(Math.abs(Date.parse(contract.approved_at) - Date.now())).toBeLessThan(5 * 60_000)
    expect(await pendingContractApproval(teacher.account)).toBeUndefined()
  })

  it(caseName('doc.appr.side.22', 'дата протокола совета в документах — в виде для человека, без сырой отметки времени'), async () => {
    const doc = (await gql<any>(token, GENERATE, {
      i: { data: { registry_id: 3006, coopname: COOP, username: teacher.account, contract_number: 'A1B2C3D4E5F60718', contract_created_at: '06.10.2026' } },
    })).generateDocument
    expect(doc.html, 'сырой отметки времени в документе нет').not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
    expect(doc.html).toMatch(/\d{2}\.\d{2}\.\d{4}/)
    expect(doc.html).not.toMatch(/undefined|Invalid Date/)
  })

  it(caseName('rt.cc.side.06', 'лента изменений столов образования: каталог — всем, личные таблицы — владельцу и совету'), async () => {
    const learner = freshMember({ prefix: 'edull' })
    const learnerToken = await login(learner)
    await signOffer(learner, learnerToken, 'PARENT')
    const section = await createSection(chairman)

    const COURSES = { code: EXTENSION, table: 'edubridge_courses' }
    const LEARNERS = { code: EXTENSION, table: 'edubridge_learners' }
    const conns = [await wsAs(learnerToken), await wsAs(token), await wsAs(chairman)]
    try {
      const [own, stranger, staff] = conns.map(c => chainChangesOf(c, [COURSES, LEARNERS]))
      await settleSubscriptions()

      // Каталог открыт всем: новый курс видят и ученик, и преподаватель.
      await publishCourse(chairman, section, 30)
      await waitSignal(own, COURSES)
      await waitSignal(stranger, COURSES)

      // Обучающийся — личная запись пайщика: сигнал получает он и совет.
      await addLearner(learnerToken, 'Ученик ленты', true)
      const signal = await waitSignal(own, LEARNERS)
      expect(signal).toMatchObject({ ...LEARNERS, scope: COOP })
      await waitSignal(staff, LEARNERS)
      await quietWindow()
      expect(signalsOf(stranger, LEARNERS), 'чужая личная запись постороннему не приходит').toEqual([])
    }
    finally {
      for (const c of conns) c.close()
    }
  }, 300_000)
})

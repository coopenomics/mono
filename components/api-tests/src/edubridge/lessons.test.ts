/**
 * Занятия и взносы преподавателя результатами снаружи
 * (test-registry/edubridge.teacher.yaml).
 *
 * Преподаватель отчитывается о занятии материалами. Взнос считает контракт:
 * ставка преподавателя за проведённое время по каждой подписке с оплаченным
 * доступом на дату занятия. Занятия группы идут по порядку: следующее
 * отчитывается после передачи материалов предыдущего на ответственное
 * хранение. Материалы хранятся гарантийный срок курса, по его истечении
 * заявление уходит совету. Совет принял решение — преподаватель подписывает
 * акт, председатель ставит вторую подпись в запросах одобрений, и результат
 * зачисляется паевым взносом по программе.
 *
 * Два курса идут третий день: у первого гарантийного срока нет — заявление
 * уходит совету сразу; у второго срок идёт — заявление держится.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COUNCIL, amount, caseName, expectCode, freshMember, gql, gqlError, login, signDocument, tokenOf, waitFor } from '../core'
import { exitReturnPreview } from '../membership/exit-documents.helpers'
import { addSbpMethod } from '../payments/payments.helpers'
import {
  ALL_CONTRIBUTIONS,
  CLOSE_ASSIGNMENT,
  CREATE_ASSIGNMENT,
  CREATE_COURSE,
  DECLINE_CONTRIBUTION,
  HOLD_CONTRIBUTION,
  MY_LESSONS,
  NO_RIGHTS,
  REPORT_LESSON,
  REVOKE_CONTRIBUTION,
  RID_ACT,
  RID_STATEMENT,
  RID_STORAGE_ACT,
  SETTLEMENT,
  SET_COURSE_STATUS,
  SUBMIT_CONTRIBUTION,
  UPDATE_COURSE,
  addLearner,
  agendaWith,
  approveAct,
  contributionOf,
  councilDeclines,
  councilGrants,
  courseInput,
  createSection,
  dayFromNow,
  educationOff,
  educationOn,
  fundShare,
  holdMaterials,
  onboardTeacher,
  pendingActApproval,
  reportLesson,
  signOffer,
  signTransferAct,
  submitStatement,
  subscribe,
} from './edubridge.helpers'

const WITHDRAW_STATEMENT = 'mutation($d:EduShareWithdrawStatementInput!){ edubridgeShareWithdrawStatement(data:$d){ full_title html hash meta binary } }'
const REQUEST_RETURN = 'mutation($d:EduRequestShareReturnInput!){ edubridgeRequestShareReturn(data:$d){ accepted_total program_share available last_accepted_at } }'
const RETURN_STATEMENT = 'mutation($d:ReturnByMoneyGenerateDocumentInput!){ generateReturnByMoneyStatementDocument(data:$d){ full_title html hash meta binary } }'

/** Ставка преподавателя: час занятия одного обучающегося стоит столько. */
const RATE = '900.0000 RUB'
/** Взнос преподавателя за часовое занятие: в группе один обучающийся. */
const LESSON_COST = 900
const DAY_MS = 24 * 60 * 60 * 1000

describe('Образование: занятия и взносы преподавателя результатами', () => {
  let chairman = ''
  let section = ''
  let teacher: Who
  let token = ''
  /** Курс без гарантийного срока: заявление уходит совету сразу. */
  let now: any
  let nowAssignment: any
  /** Курс с идущим гарантийным сроком: заявление держится. */
  let held: any
  let heldInput: Record<string, unknown>
  let heldAssignment: any

  const admit = async (courseId: string, who: Who = teacher) =>
    (await gql<any>(chairman, CREATE_ASSIGNMENT, {
      d: { teacher_username: who.account, course_id: courseId, period_from: dayFromNow(-10), period_to: dayFromNow(120) },
    })).edubridgeCreateAssignment
  const mine = (id: string) => contributionOf(token, id)

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    section = await createSection(chairman)

    heldInput = courseInput(section, { starts_at: dayFromNow(-3), guarantee_days: 14 })
    const created = (await gql<any>(chairman, CREATE_COURSE, { d: heldInput })).edubridgeCreateCourse
    held = (await gql<any>(chairman, SET_COURSE_STATUS, { d: { id: created.id, status: 'PUBLISHED' } })).edubridgeSetCourseStatus
    const nowCreated = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section, { starts_at: dayFromNow(-3), guarantee_days: 0 }) })).edubridgeCreateCourse
    now = (await gql<any>(chairman, SET_COURSE_STATUS, { d: { id: nowCreated.id, status: 'PUBLISHED' } })).edubridgeSetCourseStatus

    teacher = freshMember({ prefix: 'eduk' })
    token = await login(teacher)
    await onboardTeacher(teacher, token, RATE)
    nowAssignment = await admit(now.id)
    heldAssignment = await admit(held.id)

    // Занятия оплачены учеником до отчётов: расчёт занятия контракт ведёт по
    // подпискам, оплаченным на дату занятия. Месяц — восемь часовых занятий.
    const learner = freshMember({ prefix: 'edun' })
    const learnerToken = await login(learner)
    await signOffer(learner, learnerToken, 'PARENT')
    const self = await addLearner(learnerToken, 'Ученик двух курсов', true)
    await fundShare(learner, learnerToken, amount(now.fee_month) * 3)
    await subscribe(learner, learnerToken, self.id, now.id)
    await subscribe(learner, learnerToken, self.id, held.id)
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  describe('курс без гарантийного срока: от отчёта до паевого взноса', () => {
    let first: any
    let second: any

    it(caseName('edu.teach.happy.07', 'отчёт о занятии: взнос равен часам занятия по ставке преподавателя за каждого обучающегося'), async () => {
      const r = await reportLesson(token, nowAssignment.id, 1)
      expect(r.lesson).toMatchObject({ course_id: now.id, course_title: now.title, lesson_number: 1, duration_minutes: 60, topic: 'Тема занятия 1', materials: ['https://example.org/lesson-1'] })
      first = r.contribution
      expect(first).toMatchObject({ teacher_username: teacher.account, assignment_id: nowAssignment.id, status: 'DRAFT', rid_type: 'LESSON_RECORDING', links: ['https://example.org/lesson-1'] })
      // Сумму посчитал контракт: ставка преподавателя за час на одного обучающегося с оплаченным доступом.
      expect(amount(first.amount)).toBe(LESSON_COST)
      expect(((await gql<any>(token, MY_LESSONS)).edubridgeMyLessons as any[]).map(l => l.id)).toContain(r.lesson.id)
    })

    it(caseName('edu.teach.break.04', 'занятие вне программы курса и повторный отчёт по тому же занятию отклоняются'), async () => {
      const report = (n: number) => gqlError(token, REPORT_LESSON, { d: { assignment_id: nowAssignment.id, lesson_number: n, materials: ['https://example.org/x'] } })
      expectCode(await report(now.lessons_total + 1), 'EDUBRIDGE_LESSON_OUT_OF_PLAN')
      expectCode(await report(1), 'EDUBRIDGE_LESSON_REPORT_ALREADY_SUBMITTED')
      // Занятия отчитываются по порядку: следующее — после передачи материалов предыдущего на хранение.
      expectCode(await report(2), 'EDUBRIDGE_LESSON_PREVIOUS_NOT_CLOSED')
      expect(((await gql<any>(token, MY_LESSONS)).edubridgeMyLessons as any[]).filter(l => l.course_id === now.id)).toHaveLength(1)
    })

    it(caseName('edu.teach.break.07', 'дата занятия в будущем либо раньше периода допуска и длительность больше сдвоенного занятия отклоняются'), async () => {
      const report = (over: Record<string, unknown>) =>
        gqlError(token, REPORT_LESSON, { d: { assignment_id: nowAssignment.id, lesson_number: 9, materials: ['https://example.org/x'], ...over } })
      expectCode(await report({ held_at: new Date(Date.now() + DAY_MS).toISOString() }), 'EDUBRIDGE_LESSON_REPORT_TOO_EARLY')
      expectCode(await report({ held_at: new Date(Date.now() - 30 * DAY_MS).toISOString() }), 'EDUBRIDGE_LESSON_BEFORE_ASSIGNMENT_PERIOD')
      expectCode(await report({ duration_minutes: 121 }), 'EDUBRIDGE_LESSON_DURATION_TOO_LONG')
      expect(((await gql<any>(token, MY_LESSONS)).edubridgeMyLessons as any[]).map(l => l.lesson_number)).not.toContain(9)
    })

    it(caseName('edu.teach.happy.09', 'акт передачи материалов на ответственное хранение называет курс, занятие и материалы'), async () => {
      const act = (await gql<any>(token, RID_STORAGE_ACT, { id: first.id })).edubridgeRidStorageAct
      expect(act.html).toContain(now.title)
      expect(act.html).toContain('Тема занятия 1')
      expect(act.html).toContain('https://example.org/lesson-1')
      expect(act.html).not.toMatch(/undefined|\[object Object\]/)
      // Чужой преподаватель и председатель акт за преподавателя не формируют.
      expect(await gqlError(chairman, RID_STORAGE_ACT, { id: first.id })).not.toBeNull()
    })

    it(caseName('edu.teach.break.05', 'заявление по материалам, не принятым на хранение, и повторная передача тех же материалов отклоняются'), async () => {
      const statement = (await gql<any>(token, RID_STATEMENT, { id: first.id })).edubridgeRidStatement
      const document = await signDocument(teacher.wif, statement, teacher.account, 1)
      expectCode(await gqlError(token, SUBMIT_CONTRIBUTION, { d: { contribution_id: first.id, document } }), 'EDUBRIDGE_CONTRIBUTION_NOT_HELD')

      const kept = await holdMaterials(teacher, token, first.id)
      expect(kept.status).toBe('HELD')
      expectCode(await gqlError(token, RID_STORAGE_ACT, { id: first.id }), 'EDUBRIDGE_CONTRIBUTION_ALREADY_HELD')
      const again = await signDocument(teacher.wif, statement, teacher.account, 1)
      expectCode(await gqlError(token, HOLD_CONTRIBUTION, { d: { contribution_id: first.id, document: again } }), 'EDUBRIDGE_CONTRIBUTION_ALREADY_HELD')
    })

    it(caseName('edu.teach.happy.08', 'материалы приняты на ответственное хранение: взнос «на хранении», акт сохранён, срок хранения назван'), async () => {
      const kept = await mine(first.id)
      expect(kept.status).toBe('HELD')
      expect(kept.storage_act_hash, 'акт хранения сохранён').toMatch(/^[0-9a-f]{64}$/)
      expect(kept.hold_until, 'срок хранения назван').toBeTruthy()
      expect(kept.statement_hash).toBeNull()

      // Расчёт первого занятия завершён — открывается следующее. Сдвоенное занятие стоит вдвое дороже.
      const double = await reportLesson(token, nowAssignment.id, 2, { duration_minutes: 120 })
      second = double.contribution
      expect(double.lesson.duration_minutes).toBe(120)
      expect(amount(second.amount)).toBe(LESSON_COST * 2)
    })

    it(caseName('edu.teach.happy.01', 'подача взноса: заявление уходит совету, вопрос появляется в повестке'), async () => {
      const submitted = await submitStatement(teacher, token, first.id)
      expect(submitted.status).toBe('SUBMITTED')
      expect(submitted.statement_hash).toMatch(/^[0-9a-f]{64}$/)
      const agenda = await agendaWith(first.rid_hash)
      expect(agenda.id).toBeGreaterThan(0)
      // Второй раз заявление по тому же взносу не подаётся.
      const statement = (await gql<any>(token, RID_STATEMENT, { id: first.id })).edubridgeRidStatement
      const document = await signDocument(teacher.wif, statement, teacher.account, 1)
      expectCode(await gqlError(token, SUBMIT_CONTRIBUTION, { d: { contribution_id: first.id, document } }), 'EDUBRIDGE_CONTRIBUTION_ALREADY_SUBMITTED')
    })

    it(caseName('edu.teach.side.10', 'курс без гарантийного срока: срок хранения уже истёк, заявление уходит совету сразу'), async () => {
      const kept = await holdMaterials(teacher, token, second.id)
      expect(Date.parse(kept.hold_until), 'срок хранения уже в прошлом').toBeLessThan(Date.now())
      const submitted = await submitStatement(teacher, token, second.id)
      expect(submitted.status).toBe('SUBMITTED')
      expect((await agendaWith(second.rid_hash)).id).toBeGreaterThan(0)
    })

    it(caseName('edu.teach.happy.02', 'совет принял решение — преподаватель подписывает акт; до решения акт недоступен'), async () => {
      expectCode(await gqlError(token, RID_ACT, { id: second.id }), 'EDUBRIDGE_ACT_BEFORE_COUNCIL_DECISION')
      expect(await pendingActApproval(teacher.account), 'до подписи преподавателя председателю одобрять нечего').toBeUndefined()

      await councilGrants(await agendaWith(first.rid_hash))
      const approved = await waitFor(async () => {
        const c = await mine(first.id)
        return c?.status === 'COUNCIL_APPROVED' ? c : null
      }, { timeoutMs: 120_000, intervalMs: 1_500, label: 'решение совета по взносу дошло до расширения' })
      expect(approved.council_decision_id, 'номер решения совета').toBeTruthy()
      expect(approved.decided_at).toBeTruthy()
      // Чужое решение взнос не трогает.
      expect((await mine(second.id)).status).toBe('SUBMITTED')

      const signed = await signTransferAct(teacher, token, first.id)
      expect(signed.status).toBe('ACT_SIGNED')
      expect(signed.act_hash).toMatch(/^[0-9a-f]{64}$/)
    }, 480_000)

    it(caseName('edu.teach.side.01', 'акт двухподписный: председатель ставит вторую подпись на том же документе в запросах одобрений — результат принят'), async () => {
      const signedByTeacher = await mine(first.id)
      const approval = await waitFor(() => pendingActApproval(teacher.account),
        { timeoutMs: 120_000, intervalMs: 1_500, label: 'акт преподавателя появился в запросах одобрений председателя' })
      expect(String(approval.document.document.hash).toLowerCase(), 'тот же акт, что подписал преподаватель').toBe(signedByTeacher.act_hash)
      expect(approval.document.document.signatures.map((s: any) => s.signer)).toEqual([teacher.account])

      await approveAct(approval)
      const accepted = await waitFor(async () => {
        const c = await mine(first.id)
        return c?.status === 'ACCEPTED' ? c : null
      }, { timeoutMs: 120_000, intervalMs: 1_500, label: 'результат принят после второй подписи председателя' })
      expect(accepted.decision_hash, 'протокол совета опубликован').toMatch(/^[0-9a-f]{64}$/)
      expect(accepted.act_hash).toBe(signedByTeacher.act_hash)
      expect(await pendingActApproval(teacher.account), 'запрос одобрения закрыт').toBeUndefined()
    }, 480_000)

    it(caseName('edu.teach.happy.04', 'расчёт преподавателя: принятый результат стал паевым взносом по программе'), async () => {
      const s = (await gql<any>(token, SETTLEMENT)).edubridgeMySettlement
      expect(amount(s.accepted_total)).toBe(LESSON_COST)
      expect(amount(s.program_share)).toBe(LESSON_COST)
      expect(s.last_accepted_at).toBeTruthy()
      // У преподавателя без принятых результатов расчёт нулевой.
      const fresh = freshMember({ prefix: 'edum' })
      const freshToken = await login(fresh)
      await onboardTeacher(fresh, freshToken, RATE)
      const empty = (await gql<any>(freshToken, SETTLEMENT)).edubridgeMySettlement
      expect(amount(empty.accepted_total)).toBe(0)
      expect(amount(empty.program_share)).toBe(0)
      expect(empty.last_accepted_at).toBeNull()
    })

    it(caseName('edu.teach.break.wth-01', 'трансляция паевого взноса на неверную сумму отклоняется'), async () => {
      const statement = (a: string) => gqlError(token, WITHDRAW_STATEMENT, { d: { amount: a } })
      expectCode(await statement('901.0000 RUB'), 'EDUBRIDGE_SHARE_WITHDRAW_INSUFFICIENT')
      for (const bad of ['0.0000 RUB', '-5.0000 RUB', 'сто рублей', '10.0000 USD'])
        expectCode(await statement(bad), 'EDUBRIDGE_SHARE_WITHDRAW_AMOUNT_INVALID')
      expect(await statement(''), 'пустая сумма отклонена').not.toBeNull()
      expect(amount((await gql<any>(token, SETTLEMENT)).edubridgeMySettlement.program_share)).toBe(LESSON_COST)
    })

    /** Возврат паевого взноса: заявление о трансляции (3015) и заявление о возврате деньгами (900) подписаны на сумму и поданы разом. */
    const returnRequest = async (transferAmount: string, returnAmount: string, methodId: string) => {
      const payment_hash = crypto.randomBytes(32).toString('hex')
      const transfer = (await gql<any>(token, WITHDRAW_STATEMENT, { d: { amount: transferAmount } })).edubridgeShareWithdrawStatement
      const [quantity, currency] = returnAmount.split(' ')
      const ret = (await gql<any>(token, RETURN_STATEMENT, {
        d: { coopname: COOP, username: teacher.account, method_id: methodId, quantity, currency, payment_hash },
      })).generateReturnByMoneyStatementDocument
      return {
        transfer,
        payment_hash,
        method_id: methodId,
        transfer_statement: await signDocument(teacher.wif, transfer, teacher.account, 1),
        return_statement: await signDocument(teacher.wif, ret, teacher.account, 1),
      }
    }
    let methodId = ''

    it(caseName('edu.teach.break.wth-02', 'заявления о трансляции и о возврате, подписанные на другую сумму, не принимаются'), async () => {
      methodId = String((await addSbpMethod(token, teacher.account)).method_id)
      const send = async (amountAsked: string, transferAmount: string, returnAmount: string) => {
        const { transfer: _transfer, ...d } = await returnRequest(transferAmount, returnAmount, methodId)
        return gqlError(token, REQUEST_RETURN, { d: { amount: amountAsked, ...d } })
      }
      expectCode(await send('200.0000 RUB', '100.0000 RUB', '200.0000 RUB'), 'EDUBRIDGE_SHARE_WITHDRAW_STATEMENT_STALE')
      expectCode(await send('200.0000 RUB', '200.0000 RUB', '100.0000 RUB'), 'EDUBRIDGE_SHARE_RETURN_STATEMENT_STALE')
      expect(amount((await gql<any>(token, SETTLEMENT)).edubridgeMySettlement.program_share)).toBe(LESSON_COST)
    })

    it(caseName('edu.teach.happy.wth-01', 'преподаватель возвращает часть паевого взноса: трансляция в Цифровой Кошелёк и заявка на возврат поданы разом'), async () => {
      const { transfer, ...d } = await returnRequest('400.0000 RUB', '400.0000 RUB', methodId)
      expect(transfer.html).not.toMatch(/undefined|\[object Object\]/)
      expect(transfer.html, 'в заявлении названа сумма').toContain('400')
      const after = (await gql<any>(token, REQUEST_RETURN, { d: { amount: '400.0000 RUB', ...d } })).edubridgeRequestShareReturn
      expect(amount(after.program_share), 'паевой взнос по программе уменьшился на сумму трансляции').toBe(LESSON_COST - 400)
      expect(amount(after.accepted_total), 'принятое остаётся в истории расчёта').toBe(LESSON_COST)
      // Та же пара заявлений второй раз не проходит: трансляция уже состоялась.
      expect(await gqlError(token, REQUEST_RETURN, { d: { amount: '400.0000 RUB', ...d } })).not.toBeNull()
      expect(amount((await gql<any>(token, SETTLEMENT)).edubridgeMySettlement.program_share)).toBe(LESSON_COST - 400)
    })

    it(caseName('edu.teach.side.11', 'совет решения не принял — председатель отказывает в приёме, материалы сняты с хранения'), async () => {
      expectCode(await gqlError(chairman, DECLINE_CONTRIBUTION, { d: { contribution_id: second.id, reason: '   ' } }), 'EDUBRIDGE_CONTRIBUTION_DECLINE_REASON_REQUIRED')
      expectCode(await gqlError(token, DECLINE_CONTRIBUTION, { d: { contribution_id: second.id, reason: 'сам себе' } }), NO_RIGHTS)
      const declined = (await gql<any>(chairman, DECLINE_CONTRIBUTION, { d: { contribution_id: second.id, reason: 'Материалы неполные' } })).edubridgeDeclineContribution
      expect(declined).toMatchObject({ status: 'DECLINED', decline_reason: 'Материалы неполные', council_decision_id: null, decision_hash: null })
      expectCode(await gqlError(chairman, DECLINE_CONTRIBUTION, { d: { contribution_id: second.id, reason: 'повторно' } }), 'EDUBRIDGE_CONTRIBUTION_DECLINE_NOT_SUBMITTED')
    })

    it(caseName('edu.teach.side.14', 'материалы сняты с хранения — занятие отчитывается заново: строка журнала та же, взнос новый'), async () => {
      const lessonBefore = ((await gql<any>(token, MY_LESSONS)).edubridgeMyLessons as any[]).find(l => l.course_id === now.id && l.lesson_number === 2)
      const again = await reportLesson(token, nowAssignment.id, 2, { topic: 'Занятие проведено заново' })
      expect(again.lesson.id).toBe(lessonBefore.id)
      expect(again.lesson.topic).toBe('Занятие проведено заново')
      expect(again.contribution.id).not.toBe(second.id)
      expect(again.contribution.rid_hash).not.toBe(second.rid_hash)
      expect(again.contribution.status).toBe('DRAFT')
      expect(amount(again.contribution.amount), 'расчёт занятия проведён заново — по часу').toBe(LESSON_COST)
      expect((await mine(second.id)).status, 'прежний взнос остался отклонённым').toBe('DECLINED')
      // Материалы повторного занятия переданы на хранение — журнал курса открыт для следующего занятия.
      expect((await holdMaterials(teacher, token, again.contribution.id)).status).toBe('HELD')
    })

    it(caseName('edu.teach.side.12', 'решение совета есть, приём не состоялся — председатель закрывает заявление протоколом'), async () => {
      const third = (await reportLesson(token, nowAssignment.id, 3)).contribution
      await holdMaterials(teacher, token, third.id)
      await submitStatement(teacher, token, third.id)
      await councilGrants(await agendaWith(third.rid_hash))
      await waitFor(async () => ((await mine(third.id))?.status === 'COUNCIL_APPROVED' ? true : null),
        { timeoutMs: 120_000, intervalMs: 1_500, label: 'решение совета по третьему взносу' })

      const declined = (await gql<any>(chairman, DECLINE_CONTRIBUTION, { d: { contribution_id: third.id, reason: 'Преподаватель отозвал материалы' } })).edubridgeDeclineContribution
      expect(declined).toMatchObject({ status: 'DECLINED', decline_reason: 'Преподаватель отозвал материалы' })
      expect(declined.council_decision_id, 'решение совета названо').toBeTruthy()
      expect(declined.decision_hash, 'протокол совета опубликован').toMatch(/^[0-9a-f]{64}$/)
      expectCode(await gqlError(token, RID_ACT, { id: third.id }), 'EDUBRIDGE_ACT_BEFORE_COUNCIL_DECISION')
    }, 480_000)

    it(caseName('edu.teach.side.19', 'совет отклонил вопрос о приёме — заявление помечено исходом совета и остаётся на рассмотрении'), async () => {
      const fourth = (await reportLesson(token, nowAssignment.id, 4)).contribution
      await holdMaterials(teacher, token, fourth.id)
      await submitStatement(teacher, token, fourth.id)
      await councilDeclines(await agendaWith(fourth.rid_hash))

      const marked = await waitFor(async () => {
        const c = await mine(fourth.id)
        return c?.council_outcome ? c : null
      }, { timeoutMs: 120_000, intervalMs: 1_500, label: 'исход совета отмечен у заявления' })
      expect(marked).toMatchObject({ status: 'SUBMITTED', council_outcome: 'DECLINED', council_decision_id: null })
      // Материалы снимает председатель.
      const declined = (await gql<any>(chairman, DECLINE_CONTRIBUTION, { d: { contribution_id: fourth.id, reason: 'Совет отклонил вопрос' } })).edubridgeDeclineContribution
      expect(declined.status).toBe('DECLINED')
      // Администратор видит взносы всех преподавателей, преподаватель — только свои.
      const all = (await gql<any>(await tokenOf(COUNCIL), ALL_CONTRIBUTIONS)).edubridgeContributions as any[]
      expect(all.map(c => c.id)).toContain(fourth.id)
      expectCode(await gqlError(token, ALL_CONTRIBUTIONS), NO_RIGHTS)
    }, 480_000)
  })

  describe('курс с идущим гарантийным сроком: заявление держится', () => {
    let keptOne: any

    it(caseName('edu.teach.side.21', 'гарантийный срок — один на курс, от даты начала занятий, и не зависит от дня занятия'), async () => {
      const end = Date.parse(`${dayFromNow(-3)}T00:00:00.000Z`) + 14 * DAY_MS
      const early = await reportLesson(token, heldAssignment.id, 1)
      expect(Math.abs(Date.parse(early.contribution.hold_until) - end), 'срок хранения — начало занятий плюс срок курса').toBeLessThan(DAY_MS)

      keptOne = await holdMaterials(teacher, token, early.contribution.id)
      expect(keptOne.status).toBe('HELD')
      expect(Math.abs(Date.parse(keptOne.hold_until) - end)).toBeLessThan(DAY_MS)
      expect(Date.parse(keptOne.hold_until)).toBeGreaterThan(Date.now())

      // Второе занятие — тот же срок: он идёт от начала занятий курса.
      const next = await reportLesson(token, heldAssignment.id, 2)
      expect(Math.abs(Date.parse(next.contribution.hold_until) - end)).toBeLessThan(DAY_MS)
    })

    it(caseName('edu.teach.side.17', 'материалы на хранении без подписанного заявления держат выход преподавателя'), async () => {
      const blockers = (await exitReturnPreview(token, teacher.account)).blockers as string[]
      // Два курса ведёт, по одному занятию материалы на хранении без заявления.
      expect(blockers.length).toBeGreaterThanOrEqual(3)
      expect(blockers.filter(b => b.includes(held.title) || b.includes(now.title))).toHaveLength(2)
      expect(blockers.some(b => !b.includes(held.title) && !b.includes(now.title)), 'причина про материалы без заявления').toBe(true)
    })

    it(caseName('edu.teach.side.07', 'подписанное заявление в гарантийный срок совету не уходит, держится до конца срока'), async () => {
      const kept = await submitStatement(teacher, token, keptOne.id)
      expect(kept.status).toBe('HELD')
      expect(kept.statement_hash).toMatch(/^[0-9a-f]{64}$/)
      expect(kept.council_decision_id).toBeNull()
      // Заявление подписывается один раз.
      const statement = (await gql<any>(token, RID_STATEMENT, { id: keptOne.id })).edubridgeRidStatement
      const document = await signDocument(teacher.wif, statement, teacher.account, 1)
      expectCode(await gqlError(token, SUBMIT_CONTRIBUTION, { d: { contribution_id: keptOne.id, document } }), 'EDUBRIDGE_STATEMENT_ALREADY_SIGNED')
    })

    it(caseName('edu.teach.side.08', 'подтверждённая рекламация в гарантийный срок: материалы сняты с хранения, заявление закрыто с причиной'), async () => {
      expectCode(await gqlError(token, REVOKE_CONTRIBUTION, { d: { contribution_id: keptOne.id, reason: 'сам' } }), NO_RIGHTS)
      const revoked = (await gql<any>(chairman, REVOKE_CONTRIBUTION, { d: { contribution_id: keptOne.id, reason: 'Рекламация ученика подтверждена' } })).edubridgeRevokeContribution
      expect(revoked).toMatchObject({ status: 'DECLINED', decline_reason: 'Рекламация ученика подтверждена' })
      expectCode(await gqlError(chairman, REVOKE_CONTRIBUTION, { d: { contribution_id: keptOne.id, reason: 'повторно' } }), 'EDUBRIDGE_STATEMENT_ALREADY_IN_COUNCIL')
    })

    it(caseName('edu.teach.side.09', 'рекламация по занятию с проведённым расчётом принимается после передачи материалов на хранение'), async () => {
      const draft = ((await gql<any>(token, MY_LESSONS)).edubridgeMyLessons as any[]).find(l => l.course_id === held.id && l.lesson_number === 2)
      const before = await mine(draft.contribution_id)
      expect(before).toMatchObject({ status: 'DRAFT', storage_act_hash: null })
      // Расчёт занятия с обучающимися открыт в цепи: он завершается приёмом материалов на хранение.
      expectCode(await gqlError(chairman, REVOKE_CONTRIBUTION, { d: { contribution_id: before.id, reason: 'Занятие не состоялось' } }), 'EDUBRIDGE_CONTRIBUTION_NOT_HELD')
      expect((await mine(before.id)).status, 'взнос остался черновиком').toBe('DRAFT')

      await holdMaterials(teacher, token, before.id)
      const revoked = (await gql<any>(chairman, REVOKE_CONTRIBUTION, { d: { contribution_id: before.id, reason: 'Занятие не состоялось' } })).edubridgeRevokeContribution
      expect(revoked).toMatchObject({ status: 'DECLINED', decline_reason: 'Занятие не состоялось' })
    })

    it(caseName('edu.teach.side.13', 'перенос начала занятий курса идущую группу не затрагивает: срок хранения её материалов прежний'), async () => {
      const c = (await reportLesson(token, heldAssignment.id, 3)).contribution
      const act = (await gql<any>(token, RID_STORAGE_ACT, { id: c.id })).edubridgeRidStorageAct
      const document = await signDocument(teacher.wif, act, teacher.account, 1)

      // Дата начала в карточке курса — условие новых групп; у группы с проведёнными занятиями она закреплена.
      await gql(chairman, UPDATE_COURSE, { d: { ...heldInput, id: held.id, starts_at: dayFromNow(0), teacher_usernames: [teacher.account] } })

      const kept = (await gql<any>(token, HOLD_CONTRIBUTION, { d: { contribution_id: c.id, document } })).edubridgeHoldContribution
      const end = Date.parse(`${dayFromNow(-3)}T00:00:00.000Z`) + 14 * DAY_MS
      expect(kept.status).toBe('HELD')
      expect(Math.abs(Date.parse(kept.hold_until) - end), 'акт и хранение называют прежнюю дату').toBeLessThan(DAY_MS)
    })
  })

  it(caseName('edu.teach.break.01', 'отчёт о занятии не принимается без действующего договора и при снятом допуске к курсу'), async () => {
    // Договор на подписи у председателя: допуск есть, отчитываться рано.
    const pending = freshMember({ prefix: 'edui' })
    const pendingToken = await login(pending)
    await onboardTeacher(pending, pendingToken, RATE, { approve: false })
    const early = await admit(now.id, pending)
    const report = (t: string, assignmentId: string) =>
      gqlError(t, REPORT_LESSON, { d: { assignment_id: assignmentId, lesson_number: 7, materials: ['https://example.org/x'] } })
    expectCode(await report(pendingToken, early.id), 'EDUBRIDGE_CONTRACT_NOT_APPROVED')

    // Чужое назначение и снятый допуск.
    expectCode(await report(token, early.id), 'EDUBRIDGE_ASSIGNMENT_NOT_FOUND')
    await gql(chairman, CLOSE_ASSIGNMENT, { id: early.id })
    await gql(chairman, CLOSE_ASSIGNMENT, { id: heldAssignment.id })
    expectCode(await report(token, heldAssignment.id), 'EDUBRIDGE_ASSIGNMENT_NOT_ACTIVE')
    // Пайщик без оферты преподавателя к отчётам не допущен вовсе.
    const plain = freshMember({ prefix: 'eduj' })
    expectCode(await report(await login(plain), nowAssignment.id), NO_RIGHTS)
  })
})

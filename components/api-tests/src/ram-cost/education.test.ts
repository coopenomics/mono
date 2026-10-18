/**
 * Оперативная память цепи: «Образование» от подписки ученика до выплаты
 * преподавателю.
 *
 * Путь столов: пайщик оформляет подписку ученика на курс (заявление о
 * переводе паевого взноса в программу и подписка); преподаватель отчитывается
 * о занятии, передаёт материалы на ответственное хранение и подаёт заявление о
 * взносе результатом; совет принимает взнос; преподаватель и председатель
 * подписывают акт — результат принят и стал паевым взносом преподавателя;
 * преподаватель просит вернуть паевой взнос деньгами; совет утверждает возврат,
 * кассир выплачивает.
 *
 * Подключение «Образования», раздел, курс и преподаватель с договором заводятся
 * до снимка «до процесса»: это разовая настройка кооператива, а не процесс.
 * Курс — без гарантийного срока, поэтому заявление уходит совету сразу; в
 * работе материалы лежат на хранении весь гарантийный срок, и этот срок задают
 * сутки этапа «материалы на хранении». Байты от его длины не зависят.
 */
import crypto from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, amount, authorizeDecisionOnChain, freshMember, gql, login, signDocument, tokenOf, voteOnDecision, waitFor } from '../core'
import { addSbpMethod, listPayments } from '../payments/payments.helpers'
import { cashierPaid } from '../documents/docs-reports.helpers'
import {
  CREATE_ASSIGNMENT,
  CREATE_COURSE,
  REQUEST_RETURN,
  RETURN_STATEMENT,
  SET_COURSE_STATUS,
  WITHDRAW_STATEMENT,
  addLearner,
  agendaWith,
  approveAct,
  contributionOf,
  councilGrantsRid,
  courseInput,
  createSection,
  dayFromNow,
  educationOn,
  fundShare,
  holdMaterials,
  onboardTeacher,
  pendingActApproval,
  reopenEnrollment,
  reportLesson,
  signOffer,
  signTransferAct,
  submitStatement,
  subscribe,
} from '../edubridge/edubridge.helpers'
import { ProcessMeter, RAM_COST_ON } from './ram-cost.helpers'

/** Ставка преподавателя: час занятия одного обучающегося. */
const RATE = '900.0000 RUB'
/** Сколько из принятого взноса преподаватель просит вернуть деньгами. */
const RETURN = '400.0000 RUB'

const pm = new ProcessMeter('education', '«Образование»: от подписки ученика до выплаты преподавателю', {
  subscribed: { title: 'Ученик подписан на курс, взнос переведён в программу', awaits: 'занятия' },
  reported: { title: 'Преподаватель отчитался о занятии', awaits: 'передачи материалов на хранение' },
  held: { title: 'Материалы на ответственном хранении', awaits: 'конца гарантийного срока и заявления о взносе' },
  submitted: { title: 'Заявление о взносе результатом на повестке совета', awaits: 'решения совета' },
  granted: { title: 'Совет принял взнос', awaits: 'подписи акта преподавателем' },
  act_signed: { title: 'Преподаватель подписал акт', awaits: 'второй подписи председателя' },
  accepted: { title: 'Результат принят — паевой взнос преподавателя', awaits: 'заявления о возврате' },
  return_requested: { title: 'Заявление о возврате паевого взноса на повестке совета', awaits: 'решения совета' },
  return_authorized: { title: 'Совет утвердил возврат', awaits: 'выплаты кассиром' },
  paid: { title: 'Кассир выплатил возврат', awaits: '—' },
}, {
  // Допущения: занятие через неделю после подписки, гарантийный срок 14 суток,
  // повестка совета — неделя, подписи акта — по суткам, выплата — три дня.
  subscribed: 7,
  held: 14,
  submitted: 7,
  granted: 1,
  act_signed: 1,
  accepted: 7,
  return_requested: 7,
  return_authorized: 3,
})

describe.runIf(RAM_COST_ON)('оперативная память: «Образование»', () => {
  afterAll(() => pm.finish(), 120_000)

  it('путь ученика и преподавателя до выплаты, память снимается на каждом этапе', async () => {
    // Разовая настройка кооператива и участники — до снимка «до процесса».
    await educationOn()
    const chairman = await tokenOf(CHAIRMAN)
    const section = await createSection(chairman)
    const created = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section, { starts_at: dayFromNow(-3), guarantee_days: 0 }) })).edubridgeCreateCourse
    await reopenEnrollment(chairman, created.id)
    const course = (await gql<any>(chairman, SET_COURSE_STATUS, { d: { id: created.id, status: 'PUBLISHED' } })).edubridgeSetCourseStatus

    const teacher = freshMember({ prefix: 'ramtc' })
    const teacherToken = await login(teacher)
    await onboardTeacher(teacher, teacherToken, RATE)
    const assignment = (await gql<any>(chairman, CREATE_ASSIGNMENT, {
      d: { teacher_username: teacher.account, course_id: course.id, period_from: dayFromNow(-10), period_to: dayFromNow(120) },
    })).edubridgeCreateAssignment
    const methodId = String((await addSbpMethod(teacherToken, teacher.account)).method_id)

    const learner = freshMember({ prefix: 'ramln' })
    const learnerToken = await login(learner)
    await signOffer(learner, learnerToken, 'PARENT')
    const self = await addLearner(learnerToken, 'Ученик замера памяти', true)
    await fundShare(learner, learnerToken, amount(course.fee_month) * 3)
    await pm.start()

    await subscribe(learner, learnerToken, self.id, course.id)
    await pm.mark('subscribed')

    // Доступ по подписке оплачен с момента оформления, а помощник по умолчанию
    // ставит занятие на два часа назад — до оплаты. Занятие ставим на «только
    // что»: длина занятия на стенде идёт в масштабе суток (30 с), и оно уже
    // закончилось к отчёту.
    const { contribution } = await reportLesson(teacherToken, assignment.id, 1, { held_at: new Date(Date.now() - 3_000).toISOString() })
    await pm.mark('reported')

    await holdMaterials(teacher, teacherToken, contribution.id)
    await pm.mark('held')

    await submitStatement(teacher, teacherToken, contribution.id)
    const agenda = await agendaWith(contribution.rid_hash)
    await pm.mark('submitted')

    await councilGrantsRid(agenda, contribution)
    await waitFor(async () => ((await contributionOf(teacherToken, contribution.id))?.status === 'COUNCIL_APPROVED' ? true : null),
      { timeoutMs: 120_000, intervalMs: 1_500, label: 'решение совета по взносу дошло до расширения' })
    await pm.mark('granted')

    await signTransferAct(teacher, teacherToken, contribution.id)
    await pm.mark('act_signed')

    const approval = await waitFor(() => pendingActApproval(teacher.account), { timeoutMs: 120_000, intervalMs: 1_500, label: 'акт в запросах одобрений председателя' })
    await approveAct(approval)
    await waitFor(async () => ((await contributionOf(teacherToken, contribution.id))?.status === 'ACCEPTED' ? true : null),
      { timeoutMs: 120_000, intervalMs: 1_500, label: 'результат принят' })
    await pm.mark('accepted')

    const payment_hash = crypto.randomBytes(32).toString('hex')
    const transfer = (await gql<any>(teacherToken, WITHDRAW_STATEMENT, { d: { amount: RETURN } })).edubridgeShareWithdrawStatement
    const [quantity, currency] = RETURN.split(' ')
    const ret = (await gql<any>(teacherToken, RETURN_STATEMENT, {
      d: { coopname: COOP, username: teacher.account, method_id: methodId, quantity, currency, payment_hash },
    })).generateReturnByMoneyStatementDocument
    await gql(teacherToken, REQUEST_RETURN, {
      d: {
        amount: RETURN,
        payment_hash,
        method_id: methodId,
        transfer_statement: await signDocument(teacher.wif, transfer, teacher.account, 1),
        return_statement: await signDocument(teacher.wif, ret, teacher.account, 1),
      },
    })
    const returnAgenda = await agendaWith(payment_hash)
    await pm.mark('return_requested')

    await voteOnDecision(returnAgenda.id, 'for')
    await authorizeDecisionOnChain(returnAgenda.id)
    const pending = await waitFor(async () => (await listPayments(chairman, { username: teacher.account, direction: 'OUTGOING' }))
      .find(p => String(p.hash).toLowerCase() === payment_hash && p.status === 'PENDING') ?? null,
    { timeoutMs: 120_000, intervalMs: 2_000, label: 'платёж возврата ждёт кассира' })
    await pm.mark('return_authorized')

    await cashierPaid(String(pending.id))
    await waitFor(async () => (await listPayments(chairman, { username: teacher.account, direction: 'OUTGOING' }))
      .find(p => String(p.hash).toLowerCase() === payment_hash && p.is_final && p.status !== 'PENDING') ?? null,
    { timeoutMs: 120_000, intervalMs: 2_000, label: 'возврат выплачен' })
    await pm.mark('paid')

    expect(pm.passed()).toEqual(['before', ...Object.keys(pm.stages)])
  }, 1_800_000)
})

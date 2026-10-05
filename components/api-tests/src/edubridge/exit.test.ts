/**
 * Программа «Образование» при выходе пайщика из кооператива снаружи
 * (test-registry/edubridge.enrollment.yaml, edubridge.access.yaml,
 * edubridge.teacher.yaml).
 *
 * Ученика действующие подписки не держат: они закрываются при подаче
 * заявления на выход с расчётом возврата по Положению ЦПП, возврат ложится на
 * кошелёк программы и входит в сумму, которую кооператив вернёт при выходе.
 * Преподавателя держит действующий допуск к курсу: пока он ведёт курс,
 * заявление на выход не принимается.
 *
 * Выходят свежие пайщики. Заявление ученика подтверждается по ссылке из письма
 * (почту стенда перехватывает Mailpit) и уходит в цепь; заявление преподавателя
 * принимается только после снятия допуска и прекращает его договор.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, amount, caseName, docMeta, expectCode, freshMember, gql, gqlError, latestMail, login, signDocument, tokenOf, waitFor } from '../core'
import { addSbpMethod } from '../payments/payments.helpers'
import {
  CLOSE_ASSIGNMENT,
  CREATE_ASSIGNMENT,
  MY_ASSIGNMENTS,
  MY_CONTRACT,
  PLANNED_RATE,
  PROGRAM_WALLET,
  REFUND_PREVIEW,
  RETURN_BALANCE,
  addLearner,
  createSection,
  dayFromNow,
  educationOff,
  educationOn,
  enrollmentOf,
  fundShare,
  onboardTeacher,
  publishCourse,
  signOffer,
  subscribe,
  walletOf,
} from './edubridge.helpers'

const GENERATE_APPLICATION = `mutation($d:MembershipExitApplicationGenerateDocumentInput!){
  generateMembershipExitApplication(data:$d){ full_title html hash meta binary }
}`
const CREATE_EXIT = 'mutation($d:CreateMembershipExitInput!){ createMembershipExit(data:$d){ exit_hash status } }'
const CONFIRM_EXIT = 'mutation($t:String!){ confirmMembershipExit(token:$t){ exit_hash status } }'
const GENERATE_ANNULMENT = `mutation($d:ProgramAgreementsAnnulmentGenerateDocumentInput!,$o:GenerateDocumentOptionsInput){
  generateProgramAgreementsAnnulment(data:$d, options:$o){ full_title html hash meta binary }
}`
const RETURN_PREVIEW = `query($c:String!,$u:String!){ membershipExitReturnPreview(coopname:$c, username:$u){
  total blockers programs{ program_id title agreement_signed_at agreement_hash refund wallets{ wallet_name human_name balance returns policy } }
} }`

/** Поля мета заявления, которые принимает вход подачи (MembershipExitApplicationSignedMetaDocumentInput). */
const STATEMENT_META_KEYS = ['block_num', 'coopname', 'created_at', 'generator', 'lang', 'links', 'registry_id', 'skip_save', 'timezone', 'title', 'username', 'version']

/** Поля мета заявления об аннулировании соглашений (ProgramAgreementsAnnulmentSignedMetaDocumentInput). */
const ANNULMENT_META_KEYS = [...STATEMENT_META_KEYS, 'exit_hash', 'programs', 'total_refund']

function withMeta(signed: any, keys: string[]): any {
  const meta = docMeta(signed.meta)
  return { ...signed, meta: Object.fromEntries(keys.filter(k => k in meta).map(k => [k, meta[k]])) }
}

/**
 * Документы выхода под общим хэшем, как их собирает рабочий стол: заявление
 * на выход и заявление об аннулировании соглашений об участии в программах —
 * в нём названо, что вернётся по каждой программе.
 */
async function exitInput(who: Who, token: string): Promise<{ d: Record<string, unknown> }> {
  const exit_hash = crypto.randomBytes(32).toString('hex')
  const g = await gql<any>(token, GENERATE_APPLICATION, { d: { coopname: COOP, username: who.account, skip_save: false } })
  const statement = withMeta(await signDocument(who.wif, g.generateMembershipExitApplication, who.account, 1), STATEMENT_META_KEYS)

  const preview = await exitPreview(token, who.account)
  const programs = (preview.programs as any[])
    .filter(p => Boolean(p.agreement_hash) && p.program_id > 0)
    .map(p => ({
      program_id: p.program_id,
      title: p.title,
      agreement_signed_at: p.agreement_signed_at ?? '',
      agreement_hash: p.agreement_hash ?? '',
      refund: p.refund,
      wallets: (p.wallets as any[]).map(w => ({ wallet_name: w.wallet_name, human_name: w.human_name, balance: w.balance, returns: w.returns })),
    }))
  if (!programs.length)
    return { d: { coopname: COOP, username: who.account, exit_hash, statement } }
  const a = await gql<any>(token, GENERATE_ANNULMENT, {
    d: { coopname: COOP, username: who.account, skip_save: false, exit_hash, programs, total_refund: preview.total },
    o: { lang: 'ru' },
  })
  const annulment = withMeta(await signDocument(who.wif, a.generateProgramAgreementsAnnulment, who.account, 1), ANNULMENT_META_KEYS)
  return { d: { coopname: COOP, username: who.account, exit_hash, statement, annulment } }
}

async function exitPreview(token: string, username: string): Promise<any> {
  return (await gql<any>(token, RETURN_PREVIEW, { c: COOP, u: username })).membershipExitReturnPreview
}

/** Пайщик подтверждает выход по ссылке из письма — заявление уходит в цепь. */
async function confirmExitByMail(who: Who): Promise<void> {
  const mail = await latestMail(who.email, 'membership-exit/confirm?token=', 120_000)
  const confirmToken = /membership-exit\/confirm\?token=([\w.-]+)/.exec(`${mail.text}\n${mail.html}`)?.[1]
  expect(confirmToken, 'в письме есть ссылка подтверждения').toBeTruthy()
  expect((await gql<any>(null, CONFIRM_EXIT, { t: confirmToken })).confirmMembershipExit.status).toBe('PENDING')
}

describe('Образование: выход из кооператива ученика и преподавателя', () => {
  let chairman = ''
  let section = ''
  let running: any

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    section = await createSection(chairman)
    // Занятия идут: закрытие подписки возвращает половину остаточной стоимости.
    running = await publishCourse(chairman, section, -3)
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  describe('ученик с действующей подпиской', () => {
    let learner: Who
    let token = ''
    let enrollment: any
    let fee = 0
    let refund = 0
    let totalBefore = 0

    beforeAll(async () => {
      learner = freshMember({ prefix: 'edux' })
      token = await login(learner)
      await signOffer(learner, token, 'PARENT')
      const self = await addLearner(token, 'Выходит сам', true)
      fee = amount(running.fee_month)
      await fundShare(learner, token, fee * 2)
      totalBefore = amount((await exitPreview(token, learner.account)).total)
      enrollment = await subscribe(learner, token, self.id, running.id)
      refund = amount((await gql<any>(token, REFUND_PREVIEW, { id: enrollment.id })).edubridgeRefundPreview.refund)
    }, 600_000)

    it(caseName('edu.enroll.side.14', 'кошелёк программы показывает, сколько вернётся в паевой при выходе сегодня'), async () => {
      expect(refund).toBeCloseTo(fee / 2, 4)
      const balance = (await gql<any>(token, RETURN_BALANCE)).edubridgeReturnBalance
      expect(balance.subscriptions).toBe(1)
      expect(amount(balance.available)).toBe(0)
      expect(amount(balance.refunds)).toBeCloseTo(refund, 4)
      expect(amount(balance.total)).toBeCloseTo(refund, 4)
    })

    it(caseName('edu.enroll.side.20', 'действующая подписка выход не держит, возврат по ней входит в сумму выхода'), async () => {
      const preview = await exitPreview(token, learner.account)
      expect(preview.blockers, 'препятствий выходу у ученика нет').toEqual([])
      // Взнос ушёл с паевого, возврат по подписке вернётся при выходе.
      expect(amount(preview.total)).toBeCloseTo(totalBefore - fee + refund, 4)
      const pending = (preview.programs as any[]).flatMap(p => p.wallets as any[]).filter(w => w.wallet_name === PROGRAM_WALLET && amount(w.balance) > 0)
      expect(pending, 'возврат по подписке — строкой кошелька программы').toHaveLength(1)
      expect(pending[0]).toMatchObject({ returns: true, policy: 'RETURN_TO_MAIN' })
      expect(amount(pending[0].balance)).toBeCloseTo(refund, 4)
    })

    it(caseName('edu.access.happy.10', 'заявление на выход подано — подписка закрыта с возвратом на кошелёк программы'), async () => {
      await addSbpMethod(token, learner.account)
      const created = (await gql<any>(token, CREATE_EXIT, await exitInput(learner, token))).createMembershipExit
      expect(created.status, 'заявление принято, подписка его не задержала').toBe('AWAITING_CONFIRMATION')
      // До подтверждения выхода подписка действует.
      expect((await enrollmentOf(token, enrollment.id))?.status).toBe('ACTIVE')

      await confirmExitByMail(learner)

      // Подписки закрывает слушатель заявления в цепи — после разбора его блока.
      const closed = await waitFor(async () => {
        const e = await enrollmentOf(token, enrollment.id)
        return e?.status === 'CANCELLED' ? e : null
      }, { timeoutMs: 90_000, intervalMs: 1_500, label: 'подписка выходящего пайщика закрыта' })
      expect(closed.refund_reason).toBe('refusal')
      expect(amount(closed.refunded_amount)).toBeCloseTo(refund, 4)
      expect(closed.close_pending).toBe(false)

      expect(await walletOf(token, learner.account, PROGRAM_WALLET), 'возврат лёг на кошелёк программы').toBeCloseTo(refund, 4)
      const balance = (await gql<any>(token, RETURN_BALANCE)).edubridgeReturnBalance
      expect(balance.subscriptions).toBe(0)
      expect(amount(balance.total)).toBeCloseTo(refund, 4)
      // Сумма выхода прежняя: возврат из ожидаемого стал остатком кошелька программы.
      expect(amount((await exitPreview(token, learner.account)).total)).toBeCloseTo(totalBefore - fee + refund, 4)
    }, 480_000)
  })

  describe('преподаватель с действующим допуском к курсу', () => {
    let teacher: Who
    let token = ''
    let assignment: any

    beforeAll(async () => {
      teacher = freshMember({ prefix: 'eduy' })
      token = await login(teacher)
      // Договор остаётся на подписи у председателя: его подпись отклоняет цепь
      // (находка 2 отчёта первого прогона), а допуску и препятствию выходу это не мешает.
      await onboardTeacher(teacher, token, PLANNED_RATE, { approve: false })
      const led = await publishCourse(chairman, section, 30)
      assignment = (await gql<any>(chairman, CREATE_ASSIGNMENT, {
        d: { teacher_username: teacher.account, course_id: led.id, period_from: dayFromNow(0), period_to: dayFromNow(90) },
      })).edubridgeCreateAssignment
      await addSbpMethod(token, teacher.account)
    }, 600_000)

    it(caseName('edu.access.break.05', 'действующий допуск к курсу держит выход преподавателя: заявление не принимается'), async () => {
      const preview = await exitPreview(token, teacher.account)
      expect(preview.blockers, 'препятствие выходу названо').toHaveLength(1)
      expect(preview.blockers[0]).toContain(assignment.course_title)

      expectCode(await gqlError(token, CREATE_EXIT, await exitInput(teacher, token)), 'MEMBERSHIP_EXIT_BLOCKED')
      expect((await gql<any>(token, MY_CONTRACT)).edubridgeMyContract.status, 'договор не прекращён').toBe('PENDING_APPROVAL')
    })

    // Находка 2: председатель не может подписать договор чужого преподавателя, действующего
    // договора на стенде не получить — прекращать нечего. Включить после починки контракта.
    it.skip(caseName('edu.teach.side.16', 'допуск снят — заявление на выход принимается, с ним прекращается договор преподавателя'), async () => {
      const closed = (await gql<any>(chairman, CLOSE_ASSIGNMENT, { id: assignment.id })).edubridgeCloseAssignment
      expect(closed.status).toBe('CLOSED')
      expect(((await gql<any>(token, MY_ASSIGNMENTS)).edubridgeMyAssignments as any[]).filter(a => a.status === 'ACTIVE')).toEqual([])
      expect((await exitPreview(token, teacher.account)).blockers).toEqual([])

      const created = (await gql<any>(token, CREATE_EXIT, await exitInput(teacher, token))).createMembershipExit
      expect(created.status).toBe('AWAITING_CONFIRMATION')
      expect((await gql<any>(token, MY_CONTRACT)).edubridgeMyContract.status, 'до подтверждения выхода договор действует').toBe('ACTIVE')

      await confirmExitByMail(teacher)
      // Договор прекращает слушатель заявления в цепи — после разбора его блока.
      const terminated = await waitFor(async () => {
        const c = (await gql<any>(token, MY_CONTRACT)).edubridgeMyContract
        return c?.status === 'TERMINATED' ? c : null
      }, { timeoutMs: 90_000, intervalMs: 1_500, label: 'договор вышедшего преподавателя прекращён' })
      expect(terminated.status).toBe('TERMINATED')
    }, 480_000)
  })
})

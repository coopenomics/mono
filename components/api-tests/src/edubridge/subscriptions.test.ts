/**
 * Подписки «Образования» снаружи, вторая часть
 * (test-registry/edubridge.enrollment.yaml): продление, взнос за весь курс
 * разом, зачёт остатка кошелька программы, удержание взноса, отмена курса по
 * недобору, курс, снятый с публикации.
 *
 * Взнос удерживается целиком, пока участник вправе потребовать его назад:
 * удержанное лежит на отдельном кошельке программы и на расходы не идёт. Что
 * происходит с удержанным со временем (конец гарантийного срока, прошедшие
 * занятия), снаружи не проверить — время на стенде не перематывается.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, amount, caseName, docMeta, expectCode, freshMember, gql, gqlError, login, signDocument, tokenOf } from '../core'
import { exitReturnPreview } from '../membership/exit-documents.helpers'
import {
  CANCEL_ENROLLMENT,
  CATALOG_COURSE,
  COURSE,
  PROGRAM_WALLET,
  QUOTE,
  REFUND_PREVIEW,
  SET_COURSE_STATUS,
  SHARE_WALLET,
  SUBSCRIBE,
  addLearner,
  createSection,
  educationOff,
  educationOn,
  enrollmentOf,
  fundShare,
  publishCourse,
  quoteOf,
  signOffer,
  signedConvertStatement,
  subscribe,
  walletOf,
} from './edubridge.helpers'

const FUND = 'query{ edubridgeProgramFund{ fund_balance wallets{ id available } } }'
const CANCEL_UNDERFILLED = 'mutation($id:ID!){ edubridgeCancelCourseUnderfilled(course_id:$id) }'
const RETRY_CLOSE = 'mutation($d:EduRetryEnrollmentCloseInput!){ edubridgeRetryEnrollmentClose(data:$d){ id status } }'
const CONVERT_STATEMENT = 'mutation($d:EduQuoteInput!){ edubridgeConvertStatement(data:$d){ full_title html hash meta binary } }'
const GENERATE_ANNULMENT = `mutation($d:ProgramAgreementsAnnulmentGenerateDocumentInput!,$o:GenerateDocumentOptionsInput){
  generateProgramAgreementsAnnulment(data:$d, options:$o){ full_title html hash meta }
}`

/** Кошелёк программы, где лежат удержанные взносы. */
const ESCROW_WALLET = 'w.edu.escrow'
const DAY_MS = 24 * 60 * 60 * 1000
/** Взнос за курс разом: восемь месяцев программы, скидка 10%. */
const COURSE_PAYMENT = { lessons_per_month: 8, lessons_total: 64, course_payment_enabled: true, course_discount_percent: 10 }

describe('Образование: подписки — продление, взнос за курс, удержание, недобор', () => {
  let chairman = ''
  let section = ''
  let learner: Who
  let token = ''
  let self: any
  let child: any
  let second: Who
  let secondToken = ''
  let secondSelf: any

  const wallet = (name: string) => walletOf(token, learner.account, name)
  const input = (learnerId: string, courseId: string, period = 'MONTH') => ({ d: { learner_id: learnerId, course_id: courseId, period } })
  const quote = async (learnerId: string, courseId: string, period = 'MONTH') => (await gql<any>(token, QUOTE, input(learnerId, courseId, period))).edubridgeQuote
  const escrow = async (): Promise<number> => {
    const fund = (await gql<any>(chairman, FUND)).edubridgeProgramFund
    return amount((fund.wallets as any[]).find(w => w.id === ESCROW_WALLET)?.available)
  }
  const freeFund = async (): Promise<number> => amount((await gql<any>(chairman, FUND)).edubridgeProgramFund.fund_balance)
  /** Подписка с взносом за весь курс разом. */
  const subscribeCourse = async (learnerId: string, courseId: string) => {
    const d = input(learnerId, courseId, 'COURSE').d
    const statement = (await gql<any>(token, CONVERT_STATEMENT, { d })).edubridgeConvertStatement
    const document = await signDocument(learner.wif, statement, learner.account, 1)
    return (await gql<any>(token, SUBSCRIBE, { d: { ...d, document } })).edubridgeSubscribe
  }

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    section = await createSection(chairman)

    learner = freshMember({ prefix: 'edup' })
    token = await login(learner)
    await signOffer(learner, token, 'PARENT')
    self = await addLearner(token, 'Сам плательщик', true)
    child = await addLearner(token, 'Ребёнок плательщика')
    await fundShare(learner, token, 600_000)

    second = freshMember({ prefix: 'eduq' })
    secondToken = await login(second)
    await signOffer(second, secondToken, 'PARENT')
    secondSelf = await addLearner(secondToken, 'Второй участник', true)
    await fundShare(second, secondToken, 60_000)
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  describe('удержание взноса и продление', () => {
    let course: any
    let fee = 0
    let enrollment: any

    beforeAll(async () => {
      course = await publishCourse(chairman, section, 30)
      fee = amount(course.fee_month)
    }, 300_000)

    // Кошельки программы общие для стенда: остатки сравниваются вплотную к
    // действию, чтобы на них не попала работа очереди по чужим подпискам.
    it(caseName('edu.enroll.happy.18', 'взнос при оплате удерживается целиком: в свободные средства фонда он не попадает'), async () => {
      const [held, free] = [await escrow(), await freeFund()]
      enrollment = await subscribe(learner, token, self.id, course.id)
      expect(amount(enrollment.paid_amount)).toBeCloseTo(fee, 4)
      expect(await escrow(), 'удержан весь взнос').toBeCloseTo(held + fee, 4)
      expect(await freeFund(), 'свободные средства фонда не выросли').toBeCloseTo(free, 4)
      // Удержано не меньше того, что участник может потребовать назад.
      const refund = (await gql<any>(token, REFUND_PREVIEW, { id: enrollment.id })).edubridgeRefundPreview
      expect(amount(refund.refund)).toBeCloseTo(fee, 4)
    })

    it(caseName('edu.enr.happy.03', 'продление действующей подписки: срок прибавляется к оплаченному, подписка та же'), async () => {
      const q = await quote(self.id, course.id)
      expect(q.is_extension).toBe(true)
      expect(q.sub_hash).toBe(enrollment.sub_hash)
      const added = Date.parse(q.paid_until) - Date.parse(enrollment.paid_until)
      expect(added, 'продление — на месяц от конца оплаченного срока').toBeGreaterThanOrEqual(28 * DAY_MS)
      expect(added).toBeLessThanOrEqual(31 * DAY_MS + 60_000)

      const held = await escrow()
      const extended = await subscribe(learner, token, self.id, course.id)
      expect(extended).toMatchObject({ id: enrollment.id, status: 'ACTIVE', sub_hash: enrollment.sub_hash })
      expect(Date.parse(extended.paid_until)).toBe(Date.parse(q.paid_until))
      expect(amount(extended.paid_amount), 'взносы складываются').toBeCloseTo(fee * 2, 4)
      expect(await escrow(), 'второй взнос тоже удержан').toBeCloseTo(held + fee, 4)
      enrollment = extended
    })

    it(caseName('edu.enroll.side.08', 'после продления возврат считается от всего оплаченного'), async () => {
      const preview = (await gql<any>(token, REFUND_PREVIEW, { id: enrollment.id })).edubridgeRefundPreview
      expect(preview.reason).toBe('before_start')
      expect(amount(preview.refund)).toBeCloseTo(fee * 2, 4)
      const cancelled = (await gql<any>(token, CANCEL_ENROLLMENT, { id: enrollment.id })).edubridgeCancelEnrollment
      expect(cancelled.status).toBe('CANCELLED')
      expect(amount(cancelled.refunded_amount)).toBeCloseTo(fee * 2, 4)
      expect(await wallet(PROGRAM_WALLET)).toBeCloseTo(fee * 2, 4)
    })

    it(caseName('edu.enroll.side.18', 'отмена возвращает удержанное участнику: с кошелька удержанных взносов оно уходит, в фонд не попадает'), async () => {
      const another = await publishCourse(chairman, section, 30)
      const paid = await subscribe(learner, token, child.id, another.id)
      const [held, free, own] = [await escrow(), await freeFund(), await wallet(PROGRAM_WALLET)]
      await gql(token, CANCEL_ENROLLMENT, { id: paid.id })
      expect(await escrow()).toBeCloseTo(held - amount(paid.paid_amount), 4)
      expect(await freeFund()).toBeCloseTo(free, 4)
      expect(await wallet(PROGRAM_WALLET)).toBeCloseTo(own + amount(paid.paid_amount), 4)
    })

    it(caseName('edu.enroll.happy.11', 'остаток кошелька программы покрывает часть взноса — с паевого конвертируется только недостача'), async () => {
      const pricey = await publishCourse(chairman, section, 30, { planned_hourly_rate: '5000.0000 RUB' })
      const price = amount(pricey.fee_month)
      const onProgram = await wallet(PROGRAM_WALLET)
      expect(price, 'взнос дороже остатка кошелька программы').toBeGreaterThan(onProgram)
      const shareBefore = await wallet(SHARE_WALLET)

      const q = await quote(child.id, pricey.id)
      expect(amount(q.from_program)).toBeCloseTo(onProgram, 4)
      expect(amount(q.to_convert)).toBeCloseTo(price - onProgram, 4)
      expect(q.enough).toBe(true)

      // Заявление называет зачёт, конвертацию и полную стоимость.
      const document = await signedConvertStatement(learner, token, child.id, pricey.id)
      const meta = docMeta(document.meta)
      expect(meta).toMatchObject({ sub_hash: q.sub_hash, amount: q.to_convert, from_program: q.from_program, total: q.amount })

      const paid = (await gql<any>(token, SUBSCRIBE, { d: { ...input(child.id, pricey.id).d, document } })).edubridgeSubscribe
      expect(amount(paid.paid_amount)).toBeCloseTo(price, 4)
      expect(await wallet(PROGRAM_WALLET)).toBe(0)
      expect(await wallet(SHARE_WALLET)).toBeCloseTo(shareBefore - (price - onProgram), 4)
    })

    it(caseName('edu.enroll.break.04', 'заявление, подписанное по другой подписке, не принимается'), async () => {
      const other = await publishCourse(chairman, section, 30)
      const document = await signedConvertStatement(learner, token, self.id, other.id)
      // То же заявление — на другого обучающегося и на другой курс.
      expectCode(await gqlError(token, SUBSCRIBE, { d: { ...input(child.id, other.id).d, document } }), 'EDUBRIDGE_ENROLLMENT_STATEMENT_STALE')
      expectCode(await gqlError(token, SUBSCRIBE, { d: { ...input(self.id, course.id).d, document } }), 'EDUBRIDGE_ENROLLMENT_STATEMENT_STALE')
      expect(((await gql<any>(token, 'query{ edubridgeMyEnrollments{ course_id status } }')).edubridgeMyEnrollments as any[])
        .filter(e => e.course_id === other.id)).toEqual([])
    })
  })

  describe('взнос за весь курс разом', () => {
    let ahead: any
    let paid: any

    it(caseName('edu.enroll.happy.09', 'взнос за весь курс до начала занятий: сумма помесячных со скидкой, оплачено до конца программы'), async () => {
      ahead = await publishCourse(chairman, section, 30, COURSE_PAYMENT)
      const fee = amount(ahead.fee_month)
      const q = await quote(self.id, ahead.id, 'COURSE')
      expect(q.months).toBe(8)
      expect(amount(q.base_amount)).toBeCloseTo(fee * 8, 4)
      expect(amount(q.amount)).toBeCloseTo(fee * 8 * 0.9, 4)

      paid = await subscribeCourse(self.id, ahead.id)
      expect(paid).toMatchObject({ period: 'COURSE', status: 'ACTIVE' })
      expect(amount(paid.paid_amount)).toBeCloseTo(fee * 8 * 0.9, 4)
      expect(Date.parse(paid.paid_until)).toBe(Date.parse(q.paid_until))
      // До начала занятий возвращается всё внесённое.
      const refund = (await gql<any>(token, REFUND_PREVIEW, { id: paid.id })).edubridgeRefundPreview
      expect(amount(refund.refund)).toBeCloseTo(fee * 8 * 0.9, 4)
      expect(refund.lessons_paid).toBe(64)
    })

    it(caseName('edu.enroll.break.05', 'взнос за курс не принимается: курс оплачен до конца, кооператив принимает только помесячный, выбран год'), async () => {
      expectCode(await gqlError(token, QUOTE, input(self.id, ahead.id, 'COURSE')), 'EDUBRIDGE_ENROLLMENT_COURSE_FULLY_PAID')
      const monthly = await publishCourse(chairman, section, 30)
      expectCode(await gqlError(token, QUOTE, input(self.id, monthly.id, 'COURSE')), 'EDUBRIDGE_ENROLLMENT_COURSE_PAYMENT_DISABLED')
      expectCode(await gqlError(token, QUOTE, input(self.id, monthly.id, 'YEAR')), 'EDUBRIDGE_ENROLLMENT_YEAR_PERIOD_DISABLED')
      expectCode(await gqlError(token, QUOTE, input(child.id, ahead.id, 'YEAR')), 'EDUBRIDGE_ENROLLMENT_YEAR_PERIOD_DISABLED')
    })

    it(caseName('edu.enroll.side.06', 'пришедший в середине курса и перешедший с помесячного взноса платят за оставшиеся месяцы'), async () => {
      // Занятия идут третий месяц: взнос за оставшиеся шесть, срок — до конца курса.
      const running = await publishCourse(chairman, section, -70, COURSE_PAYMENT)
      const fee = amount(running.fee_month)
      const mid = await quote(child.id, running.id, 'COURSE')
      expect(mid.months).toBe(6)
      const joined = await subscribeCourse(child.id, running.id)
      expect(amount(joined.paid_amount)).toBeCloseTo(fee * 6 * 0.9, 4)
      expect(Date.parse(joined.paid_until)).toBe(Date.parse(mid.paid_until))

      // Курс начался сегодня. Помесячный взнос, затем взнос за курс: оплаченный месяц засчитан.
      const switched = await publishCourse(chairman, section, 0, COURSE_PAYMENT)
      const month = await subscribe(learner, token, child.id, switched.id)
      const rest = await quote(child.id, switched.id, 'COURSE')
      expect(rest.is_extension).toBe(true)
      expect(rest.months).toBe(7)
      expect(amount(rest.amount)).toBeCloseTo(amount(switched.fee_month) * 7 * 0.9, 4)
      const whole = await subscribeCourse(child.id, switched.id)
      expect(whole.id).toBe(month.id)
      expect(amount(whole.paid_amount)).toBeCloseTo(amount(switched.fee_month) * (1 + 7 * 0.9), 4)
      expect(Date.parse(whole.paid_until)).toBe(Date.parse(rest.paid_until))
    })
  })

  describe('курс снят с публикации либо отменён по недобору', () => {
    it(caseName('edu.enroll.side.10', 'снятый с публикации курс: действующая подписка продлевается, новая не открывается'), async () => {
      const course = await publishCourse(chairman, section, 30)
      const active = await subscribe(learner, token, self.id, course.id)
      await gql(chairman, SET_COURSE_STATUS, { d: { id: course.id, status: 'DRAFT' } })
      expectCode(await gqlError(null, CATALOG_COURSE, { id: course.id }), 'EDUBRIDGE_COURSE_NOT_FOUND')

      expectCode(await gqlError(secondToken, QUOTE, input(secondSelf.id, course.id)), 'EDUBRIDGE_COURSE_NOT_FOUND_OR_UNPUBLISHED')
      expectCode(await gqlError(token, QUOTE, input(child.id, course.id)), 'EDUBRIDGE_COURSE_NOT_FOUND_OR_UNPUBLISHED')

      const extended = await subscribe(learner, token, self.id, course.id)
      expect(extended.id).toBe(active.id)
      expect(Date.parse(extended.paid_until)).toBeGreaterThan(Date.parse(active.paid_until))
    })

    it(caseName('edu.enroll.happy.07', 'отмена курса по недобору: подписки закрыты, взносы возвращены участникам сразу на паевой'), async () => {
      const course = await publishCourse(chairman, section, 30)
      const fee = amount(course.fee_month)
      const mine = await subscribe(learner, token, self.id, course.id)
      await subscribe(learner, token, self.id, course.id) // продление: возвращаются оба взноса
      const theirs = await subscribe(second, secondToken, secondSelf.id, course.id)
      const shareBefore = await wallet(SHARE_WALLET)
      const programBefore = await wallet(PROGRAM_WALLET)
      const theirShare = await walletOf(secondToken, second.account, SHARE_WALLET)

      // Отменяет администратор, не участник.
      expect(await gqlError(token, CANCEL_UNDERFILLED, { id: course.id })).not.toBeNull()
      expect((await gql<any>(chairman, CANCEL_UNDERFILLED, { id: course.id })).edubridgeCancelCourseUnderfilled).toBe(2)

      const closed = await enrollmentOf(token, mine.id)
      expect(closed).toMatchObject({ status: 'CANCELLED', refund_reason: 'underfilled' })
      expect(amount(closed.refunded_amount)).toBeCloseTo(fee * 2, 4)
      expect(await wallet(SHARE_WALLET), 'возврат сразу на паевой').toBeCloseTo(shareBefore + fee * 2, 4)
      expect(await wallet(PROGRAM_WALLET), 'кошелёк программы не тронут').toBeCloseTo(programBefore, 4)
      expect((await enrollmentOf(secondToken, theirs.id))?.status).toBe('CANCELLED')
      expect(await walletOf(secondToken, second.account, SHARE_WALLET)).toBeCloseTo(theirShare + fee, 4)

      // Курс снят с витрины, подписаться на него больше нельзя.
      expect((await gql<any>(chairman, COURSE, { id: course.id })).edubridgeCourse.status).toBe('ARCHIVED')
      expectCode(await gqlError(secondToken, QUOTE, input(secondSelf.id, course.id)), 'EDUBRIDGE_COURSE_NOT_FOUND_OR_UNPUBLISHED')
    })

    it(caseName('edu.enroll.side.05', 'после начала занятий курс по недобору не отменяется — у участника остаётся отказ от подписки'), async () => {
      const running = await publishCourse(chairman, section, -3)
      const active = await subscribe(second, secondToken, secondSelf.id, running.id)
      expectCode(await gqlError(chairman, CANCEL_UNDERFILLED, { id: running.id }), 'EDUBRIDGE_UNDERFILL_CANCEL_COURSE_STARTED')
      expect((await enrollmentOf(secondToken, active.id))?.status).toBe('ACTIVE')
      expect((await gql<any>(chairman, COURSE, { id: running.id })).edubridgeCourse.status).toBe('PUBLISHED')
      // Повтор закрытия без отметки о несостоявшемся закрытии отклоняется.
      expectCode(await gqlError(chairman, RETRY_CLOSE, { d: { enrollment_id: active.id } }), 'EDUBRIDGE_SUBSCRIPTION_CLOSE_NOT_PENDING')
    })
  })

  it(caseName('edu.enroll.happy.15', 'заявление об аннулировании соглашения формируется по одной программе: в таблице она одна, итог — её возврат'), async () => {
    const preview = await exitReturnPreview(token, learner.account)
    const program = (preview.programs as any[]).find(p => Boolean(p.agreement_hash) && (p.wallets as any[]).some(w => w.wallet_name === PROGRAM_WALLET))
    expect(program, 'программа «Обучение» среди соглашений пайщика').toBeTruthy()
    const d = {
      coopname: COOP,
      username: learner.account,
      skip_save: true,
      programs: [{
        program_id: program.program_id,
        title: program.title,
        agreement_signed_at: program.agreement_signed_at ?? '',
        agreement_hash: program.agreement_hash,
        refund: program.refund,
        wallets: (program.wallets as any[]).map(w => ({ wallet_name: w.wallet_name, human_name: w.human_name, balance: w.balance, returns: w.returns })),
      }],
      total_refund: program.refund,
    }
    const doc = (await gql<any>(token, GENERATE_ANNULMENT, { d, o: { lang: 'ru' } })).generateProgramAgreementsAnnulment
    expect(doc.html).toContain(program.title)
    const meta = docMeta(doc.meta)
    expect(meta.programs).toHaveLength(1)
    expect(meta.programs[0].program_id).toBe(program.program_id)
    expect(meta.total_refund).toBe(program.refund)
    expect(doc.html).not.toMatch(/undefined|\[object Object\]/)
    // Чужое заявление пайщик не формирует.
    expect(await gqlError(secondToken, GENERATE_ANNULMENT, { d, o: { lang: 'ru' } })).not.toBeNull()
  })
})

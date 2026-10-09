import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import { Cooperative } from 'cooptypes';
import {
  DOCUMENT_PORT,
  LOGGER_PORT,
  USER_WALLET_PORT,
  type IDocumentPort,
  type ILoggerPort,
  type InnerGeneratedDocument,
  type ISignedDocument,
  type IUserWalletPort,
} from '@coopenomics/innercoop';
import { EduAccessState, EduCourseStatus, EduEnrollmentPeriod, EduEnrollmentStatus } from '../../domain/enums';
import { courseMonths, feeForMonths } from '../../domain/economy/course-fee.calculator';
import { addMonths, remainingCoursePeriod } from '../../domain/economy/course-period.calculator';
import { RefundReason, type RefundCalculation } from '../../domain/economy/refund.calculator';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import type { EdubridgeCourseRecord, EdubridgeEnrollmentRecord, EdubridgeLearnerRecord } from '../../infrastructure/entities';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeGuaranteeClaimKyselyRepository } from '../../infrastructure/repositories/edubridge-guarantee-claim.kysely-repository';
import { EduGuaranteeClaimStatus } from '../../domain/enums/guarantee-claim-status.enum';
import type { EduQuoteDTO } from '../dto/edu-enrollment.dto';
import {
  EDUBRIDGE_ENROLLMENT_CANCELLED_EVENT,
  EDUBRIDGE_ENROLLMENT_EXTENDED_EVENT,
  EDUBRIDGE_ENROLLMENT_OPENED_EVENT,
  type IEduEnrollmentEventPayload,
} from '../events/edubridge.events';
import { EdubridgeFundsService } from './edubridge-funds.service';
import { EdubridgeGroupService } from './edubridge-group.service';
import { EdubridgeLearnerService } from './edubridge-learner.service';
import { refundOf } from './edubridge-refund';
import { DomainError } from '@coopenomics/extension-kit';

/** Главный паевой кошелёк — источник конвертации. */
const SHARE_WALLET = 'w.wal.share';
/** Кошелёк членских взносов программы — из него взнос списывается в первую очередь. */
const MEMBER_WALLET = 'w.edu.member';
const PERIOD_CHAIN: Record<EduEnrollmentPeriod, string> = {
  [EduEnrollmentPeriod.MONTH]: 'month',
  [EduEnrollmentPeriod.COURSE]: 'course',
  [EduEnrollmentPeriod.YEAR]: 'year',
};
const BP_IN_PERCENT = 100;


/** Условия взноса за выбранный период: сколько месяцев, до какого дня и сколько вносить. */
interface PeriodTerms {
  months: number;
  paidUntil: Date;
  /** Сумма помесячных взносов за эти месяцы. */
  baseAmount: string;
  /** Скидка за взнос разом; при помесячном взносе — ноль. */
  discountAmount: string;
  amount: string;
}

/** Чем оплачивается подписка: остатком программы и конвертацией с паевого. */
interface PlanFunding {
  fromProgram: string;
  toConvert: string;
  available: string;
  enough: boolean;
  shortfall: string;
}

export interface EnrollmentPlan {
  learner: EdubridgeLearnerRecord;
  course: EdubridgeCourseRecord;
  /** Группа курса, в которую идёт взнос. */
  groupId: string;
  existing: EdubridgeEnrollmentRecord | null;
  period: EduEnrollmentPeriod;
  amount: string;
  /** Месяцев оплачивает взнос. */
  months: number;
  baseAmount: string;
  discountAmount: string;
  symbol: string;
  isExtension: boolean;
  paidUntil: Date;
  subHash: string;
}

/**
 * Путь «Получить доступ»: котировка → заявление о конвертации (3011) →
 * `convert` + `opensub|extendsub` одной транзакцией кооператива. Прямого
 * платежа как членского взноса нет: паевой пополняется средствами ядра.
 */
@Injectable()
export class EdubridgeEnrollmentService {
  constructor(
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly courses: EdubridgeCourseKyselyRepository,
    private readonly learnerService: EdubridgeLearnerService,
    private readonly funds: EdubridgeFundsService,
    private readonly guaranteeClaims: EdubridgeGuaranteeClaimKyselyRepository,
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort,
    @Inject(USER_WALLET_PORT) private readonly wallets: IUserWalletPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly events: EventEmitter2,
    private readonly groups: EdubridgeGroupService
  ) {
    this.logger.setContext(EdubridgeEnrollmentService.name);
  }

  async listMine(coopname: string, member: string): Promise<Array<{ enrollment: EdubridgeEnrollmentRecord; course: EdubridgeCourseRecord | null }>> {
    const rows = await this.enrollments.findByMember(coopname, member);
    const result: Array<{ enrollment: EdubridgeEnrollmentRecord; course: EdubridgeCourseRecord | null }> = [];
    for (const enrollment of rows) {
      result.push({ enrollment, course: await this.groups.courseOf(coopname, enrollment.course_id, enrollment.group_id) });
    }
    return result;
  }

  courseOf(enrollment: EdubridgeEnrollmentRecord): Promise<EdubridgeCourseRecord | null> {
    return this.groups.courseOf(enrollment.coopname, enrollment.course_id, enrollment.group_id);
  }

  /** Ключ подписки в цепи: детерминирован парой «обучающийся + курс». */
  static subHash(coopname: string, learnerRef: string, courseRef: string): string {
    return createHash('sha256').update(`${coopname}|${learnerRef}|${courseRef}`).digest('hex');
  }

  async plan(coopname: string, member: string, learnerId: string, courseId: string, period: EduEnrollmentPeriod, groupId?: string | null): Promise<EnrollmentPlan> {
    const learner = await this.learnerService.getOwned(coopname, member, learnerId);
    const program = await this.courses.findById(coopname, courseId);
    if (!program) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND_OR_UNPUBLISHED');
    // Действующая подписка живёт в цепи до закрытия, даже когда оплаченный срок
    // уже истёк, а очередь закрытия до неё ещё не дошла: новый взнос её
    // продлевает, а не открывает заново — иначе цепь ответит «уже существует».
    const running = (await this.enrollments.findByLearner(coopname, learnerId)).find(
      (e) => e.course_id === courseId && e.status === EduEnrollmentStatus.ACTIVE && Boolean(e.paid_until)
    );
    const isExtension = Boolean(running);
    // Снятый с публикации курс новых участников не принимает, но действующие
    // подписки на нём продлеваются.
    if (program.status !== EduCourseStatus.PUBLISHED && !isExtension) {
      throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND_OR_UNPUBLISHED');
    }
    // Продление идёт в группе подписки; новый участник записывается в группу с открытым набором.
    const group = running?.group_id ? await this.groups.get(coopname, running.group_id) : await this.groups.openFor(coopname, program, groupId);
    const existing = running ?? (await this.enrollments.findByLearnerAndGroup(coopname, learnerId, group.id));
    // Условия, дата начала и номер для цепи — группы: взнос и срок считаются по ним.
    const course = this.groups.viewOf(program, group);

    const symbol = course.fee_month.split(' ')[1] ?? '';
    const now = new Date();
    const paidUntil = isExtension ? (existing?.paid_until as Date) : null;
    const terms = this.termsOf(course, period, paidUntil && paidUntil > now ? paidUntil : now);

    return {
      learner,
      course,
      groupId: group.id,
      existing,
      period,
      amount: terms.amount,
      months: terms.months,
      baseAmount: terms.baseAmount,
      discountAmount: terms.discountAmount,
      symbol,
      isExtension,
      paidUntil: terms.paidUntil,
      subHash: EdubridgeEnrollmentService.subHash(coopname, learner.chain_ref, course.chain_ref),
    };
  }

  /**
   * Помесячный взнос оплачивает месяц. Взнос за весь курс разом — месяцы до
   * конца программы со скидкой курса: пришедший в середине вносит за остаток.
   */
  private termsOf(course: EdubridgeCourseRecord, period: EduEnrollmentPeriod, from: Date): PeriodTerms {
    if (period === EduEnrollmentPeriod.MONTH) {
      const fee = feeForMonths(course.fee_month, 1, 0);
      return { months: 1, paidUntil: addMonths(from, 1), baseAmount: fee.base, discountAmount: fee.discount, amount: fee.amount };
    }
    if (period !== EduEnrollmentPeriod.COURSE) {
      throw DomainError.badRequest('EDUBRIDGE_ENROLLMENT_YEAR_PERIOD_DISABLED');
    }
    const total = courseMonths(course.lessons_per_month, course.lessons_total);
    if (!course.course_payment_enabled || total === 0) {
      throw DomainError.badRequest('EDUBRIDGE_ENROLLMENT_COURSE_PAYMENT_DISABLED');
    }
    const rest = remainingCoursePeriod(course.starts_at ? new Date(course.starts_at) : null, total, from);
    if (!rest) throw DomainError.badRequest('EDUBRIDGE_ENROLLMENT_COURSE_FULLY_PAID');
    const fee = feeForMonths(course.fee_month, rest.months, course.course_discount_bp / BP_IN_PERCENT);
    return { months: rest.months, paidUntil: rest.paid_until, baseAmount: fee.base, discountAmount: fee.discount, amount: fee.amount };
  }

  async quote(coopname: string, member: string, learnerId: string, courseId: string, period: EduEnrollmentPeriod, groupId?: string | null): Promise<EduQuoteDTO> {
    const plan = await this.plan(coopname, member, learnerId, courseId, period, groupId);
    const funding = await this.planFunding(coopname, member, plan);
    return {
      amount: plan.amount,
      months: plan.months,
      base_amount: plan.baseAmount,
      discount_amount: plan.discountAmount,
      from_program: funding.fromProgram,
      to_convert: funding.toConvert,
      available: funding.available,
      enough: funding.enough,
      shortfall: funding.shortfall,
      is_extension: plan.isExtension,
      paid_until: plan.paidUntil,
      sub_hash: plan.subHash,
      group_id: plan.groupId,
    };
  }

  /**
   * Заявление о конвертации (3011) без подписи — пайщик подписывает его на
   * фронте. В заявлении названы обе части: что засчитывается с кошелька
   * программы и что конвертируется с паевого.
   */
  async statement(coopname: string, member: string, learnerId: string, courseId: string, period: EduEnrollmentPeriod, groupId?: string | null): Promise<InnerGeneratedDocument> {
    const plan = await this.plan(coopname, member, learnerId, courseId, period, groupId);
    const funding = await this.planFunding(coopname, member, plan);
    const action: Cooperative.Registry.EducationConvertStatement.Action = {
      registry_id: Cooperative.Registry.EducationConvertStatement.registry_id,
      coopname,
      username: member,
      lang: 'ru',
      sub_hash: plan.subHash,
      amount: funding.toConvert,
      from_program: funding.fromProgram,
      total: plan.amount,
      course_title: plan.course.title,
      period: PERIOD_CHAIN[period],
      skip_save: false,
    };
    return this.documents.generate({ data: action });
  }

  async subscribe(
    coopname: string,
    member: string,
    learnerId: string,
    courseId: string,
    period: EduEnrollmentPeriod,
    document: ISignedDocument,
    groupId?: string | null
  ): Promise<EdubridgeEnrollmentRecord> {
    const plan = await this.plan(coopname, member, learnerId, courseId, period, groupId);
    const funding = await this.planFunding(coopname, member, plan);
    this.assertStatementMatches(document, plan, funding);
    if (!funding.enough) {
      throw DomainError.badRequest('EDUBRIDGE_INSUFFICIENT_FUNDS', {
        amount: plan.amount,
        programBalance: funding.fromProgram,
        mainBalance: funding.available,
      });
    }

    const result = await this.sendPayment(coopname, member, plan, period, funding, document);
    const trxId = String((result as { transaction_id?: string })?.transaction_id ?? document.hash);
    this.logger.info(`[EDU.SUB] ${member}: ${plan.isExtension ? 'extendsub' : 'opensub'} ${plan.subHash} до ${plan.paidUntil.toISOString()} (trx ${trxId})`);

    const entity =
      plan.existing ??
      this.enrollments.create({
        coopname,
        member_username: member,
        learner_id: learnerId,
        course_id: courseId,
        group_id: plan.groupId,
        sub_hash: plan.subHash,
      });
    entity.group_id = entity.group_id ?? plan.groupId;
    entity.period = period;
    // Сумму, срок и удержание посчитал контракт — в запись идёт прочитанное из цепи.
    Object.assign(entity, await this.chainState(coopname, plan));
    entity.status = EduEnrollmentStatus.ACTIVE;
    entity.statement_hash = document.hash.toLowerCase();
    entity.expiry_notified_at = null;
    if (!plan.isExtension) {
      entity.access_state = EduAccessState.PENDING;
      // Ученик вписался в курс: от этого дня (не раньше начала занятий) идёт его гарантийный срок.
      entity.joined_at = new Date();
    }
    const saved = await this.enrollments.save(entity);

    const payload: IEduEnrollmentEventPayload = {
      coopname,
      enrollment_id: saved.id,
      learner_id: saved.learner_id,
      course_id: saved.course_id,
      member_username: member,
      trx_id: trxId,
    };
    this.events.emit(plan.isExtension ? EDUBRIDGE_ENROLLMENT_EXTENDED_EVENT : EDUBRIDGE_ENROLLMENT_OPENED_EVENT, payload);
    return saved;
  }

  /**
   * Отмена подписки учеником. До активации курса возвращается полная
   * стоимость, после — половина остатка за вычетом использованного: так
   * написано в Положении ЦПП, и граница проходит ровно по дате активации.
   * Возврат идёт на кошелёк ЦПП, откуда его можно пустить на другую подписку
   * или вернуть в паевой по заявлению.
   */
  async cancel(coopname: string, member: string, enrollmentId: string): Promise<EdubridgeEnrollmentRecord> {
    const enrollment = await this.enrollments.findById(coopname, enrollmentId);
    if (!enrollment || enrollment.member_username !== member) throw DomainError.notFound('EDUBRIDGE_SUBSCRIPTION_NOT_FOUND');
    // Заявление по гарантийным условиям у совета: обычный отказ сейчас дал бы второй возврат по той же подписке.
    const claim = await this.guaranteeClaims.findByEnrollment(coopname, enrollment.id);
    if (claim?.status === EduGuaranteeClaimStatus.SUBMITTED) throw DomainError.badRequest('EDUBRIDGE_SUBSCRIPTION_GUARANTEE_UNDER_REVIEW');
    return this.cancelOne(coopname, enrollment, false);
  }

  /**
   * Совет удовлетворил заявление по гарантийным условиям (п. 4.4.4 Положения):
   * подписка аннулируется, вся списанная стоимость возвращается сразу на
   * паевой, протокол совета публикуется той же транзакцией.
   */
  async cancelByGuarantee(
    coopname: string,
    enrollment: EdubridgeEnrollmentRecord,
    grant: { claim_hash: string; decision: ISignedDocument }
  ): Promise<EdubridgeEnrollmentRecord> {
    if (!isCancellable(enrollment)) throw DomainError.badRequest('EDUBRIDGE_SUBSCRIPTION_ALREADY_CLOSED');
    // Возврат — весь взнос по подписке; сумму берёт контракт, здесь она читается для записи.
    const chainSub = await this.chain.readSubscription(coopname, enrollment.sub_hash);
    const refund = chainSub?.charged ?? enrollment.paid_amount;
    await this.chain.grantGuarantee({
      coopname,
      username: enrollment.member_username,
      claim_hash: grant.claim_hash,
      sub_hash: enrollment.sub_hash,
      decision: grant.decision as never,
    });
    enrollment.status = EduEnrollmentStatus.CANCELLED;
    enrollment.cancelled_at = new Date();
    // Остаток по подписке контракт разнёс сам; учёт курса в записи сверяется с цепью.
    await this.funds.afterClosed(coopname, enrollment);
    enrollment.refunded_amount = refund;
    enrollment.refund_reason = RefundReason.GUARANTEE;
    enrollment.close_pending_since = null;
    enrollment.close_error = null;
    const saved = await this.enrollments.save(enrollment);
    const payload: IEduEnrollmentEventPayload = {
      coopname,
      enrollment_id: saved.id,
      learner_id: saved.learner_id,
      course_id: saved.course_id,
      member_username: saved.member_username,
      trx_id: saved.sub_hash,
    };
    this.events.emit(EDUBRIDGE_ENROLLMENT_CANCELLED_EVENT, payload);
    this.logger.info(`[EDU.SUB] подписка ${saved.sub_hash} аннулирована по гарантийным условиям: возврат ${refund} на паевой`);
    return saved;
  }

  /**
   * Отмена курса по недобору: кооператив не открыл группу и отменяет своё
   * решение, поэтому взнос возвращается целиком и сразу на паевой — заявления
   * от учеников это не требует. Пока занятия не начались: после первого
   * занятия отменять нечего, есть отказ от подписки.
   */
  async cancelCourse(coopname: string, courseId: string): Promise<EdubridgeEnrollmentRecord[]> {
    const course = await this.courses.findById(coopname, courseId);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');
    // Отмена по недобору — пока занятия не начались ни в одной группе курса.
    const now = new Date();
    if ((await this.groups.list(coopname, courseId)).some((g) => g.starts_at && new Date(g.starts_at) <= now)) {
      throw DomainError.badRequest('EDUBRIDGE_UNDERFILL_CANCEL_COURSE_STARTED');
    }
    // Курс снимается с публикации первым: пока идут возвраты, на отменённый
    // курс никто не должен успеть подписаться.
    if (course.status === EduCourseStatus.PUBLISHED) {
      course.status = EduCourseStatus.ARCHIVED;
      await this.courses.save(course);
    }
    const active = (await this.enrollments.findByCourse(coopname, courseId)).filter((e) => isCancellable(e));
    const cancelled: EdubridgeEnrollmentRecord[] = [];
    const failed: string[] = [];
    for (const enrollment of active) {
      try {
        cancelled.push(await this.cancelOne(coopname, enrollment, true));
      } catch (e) {
        failed.push(enrollment.id);
        this.logger.error(`[EDU.SUB] недобор по курсу ${courseId}: подписка ${enrollment.id} не отменена — ${(e as Error)?.message ?? e}`);
      }
    }
    this.logger.info(`[EDU.SUB] курс ${courseId} отменён по недобору: возвращено подписок ${cancelled.length}, с ошибкой ${failed.length}`);
    if (failed.length) {
      throw DomainError.badRequest('EDUBRIDGE_UNDERFILL_CANCEL_PARTIAL', { cancelled: cancelled.length, failed: failed.length });
    }
    return cancelled;
  }

  /**
   * Выход пайщика из кооператива: его подписки закрываются с расчётом возврата
   * по Положению — так же, как при отказе участника. Возврат ложится на
   * кошелёк программы и входит в сумму, которую кооператив вернёт при выходе
   * (решение владельца 20.09.2026). Ошибка по одной подписке выход не
   * останавливает: остальные всё равно закрываются.
   */
  async cancelAllForMember(coopname: string, member: string, reason: string): Promise<EdubridgeEnrollmentRecord[]> {
    const active = (await this.enrollments.findByMember(coopname, member)).filter((e) => isCancellable(e));
    const cancelled: EdubridgeEnrollmentRecord[] = [];
    for (const enrollment of active) {
      try {
        cancelled.push(await this.cancelOne(coopname, enrollment, false));
      } catch (e) {
        this.logger.warn(`[EDU.SUB] выход ${member} (${reason}): подписка ${enrollment.id} не закрыта — ${(e as Error)?.message ?? e}`);
        await this.markClosePending(enrollment, e);
      }
    }
    if (cancelled.length) {
      this.logger.info(`[EDU.SUB] выход ${member} (${reason}): закрыто подписок ${cancelled.length}`);
    }
    return cancelled;
  }

  /**
   * Подписка не закрылась при выходе пайщика: возврат по ней ещё не лёг на
   * кошелёк программы и в сумму выхода не войдёт. Отметка держит её на виду у
   * администратора, а закрытие повторяется само, пока не пройдёт.
   */
  private async markClosePending(enrollment: EdubridgeEnrollmentRecord, error: unknown): Promise<void> {
    enrollment.close_pending_since = enrollment.close_pending_since ?? new Date();
    enrollment.close_error = String((error as Error)?.message ?? error).slice(0, 500);
    await this.enrollments.save(enrollment);
  }

  /** Повтор закрытия подписок, которые не закрылись при выходе пайщика. Возвращает число закрытых. */
  async retryPendingClosures(coopname: string): Promise<number> {
    let closed = 0;
    for (const enrollment of await this.enrollments.findClosePending(coopname)) {
      if (await this.closePending(coopname, enrollment)) closed += 1;
    }
    return closed;
  }

  /** Повтор закрытия одной подписки по слову администратора; отказ цепи возвращается ему как есть. */
  async retryClose(coopname: string, enrollmentId: string): Promise<EdubridgeEnrollmentRecord> {
    const enrollment = await this.enrollments.findById(coopname, enrollmentId);
    if (!enrollment) throw DomainError.notFound('EDUBRIDGE_SUBSCRIPTION_NOT_FOUND');
    if (!enrollment.close_pending_since) throw DomainError.badRequest('EDUBRIDGE_SUBSCRIPTION_CLOSE_NOT_PENDING');
    if (!isCancellable(enrollment)) return this.clearClosePending(enrollment);
    try {
      return await this.cancelOne(coopname, enrollment, false);
    } catch (e) {
      await this.markClosePending(enrollment, e);
      throw e;
    }
  }

  private async closePending(coopname: string, enrollment: EdubridgeEnrollmentRecord): Promise<boolean> {
    // Подписка успела закрыться другим путём (истёк срок, отмена) — отметка больше не нужна.
    if (!isCancellable(enrollment)) {
      await this.clearClosePending(enrollment);
      return false;
    }
    try {
      await this.cancelOne(coopname, enrollment, false);
      this.logger.info(`[EDU.SUB] подписка ${enrollment.sub_hash} закрыта повтором после выхода пайщика`);
      return true;
    } catch (e) {
      await this.markClosePending(enrollment, e);
      return false;
    }
  }

  private clearClosePending(enrollment: EdubridgeEnrollmentRecord): Promise<EdubridgeEnrollmentRecord> {
    enrollment.close_pending_since = null;
    enrollment.close_error = null;
    return this.enrollments.save(enrollment);
  }

  /** Общая часть отмены: расчёт по Положению, движение в цепи, закрытие записи. */
  private async cancelOne(coopname: string, enrollment: EdubridgeEnrollmentRecord, underfilled: boolean): Promise<EdubridgeEnrollmentRecord> {
    if (!isCancellable(enrollment)) throw DomainError.badRequest('EDUBRIDGE_SUBSCRIPTION_ALREADY_CLOSED');
    const course = await this.groups.courseOf(coopname, enrollment.course_id, enrollment.group_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');

    // Основание и сумму возврата определяет контракт. Здесь то же правило
    // приложено к строке подписки из цепи — для записи итога.
    const refund = await this.refundFor(coopname, enrollment, course, underfilled);
    await this.chain.cancelSubscription({
      coopname,
      username: enrollment.member_username,
      sub_hash: enrollment.sub_hash,
      underfilled,
    });

    enrollment.status = EduEnrollmentStatus.CANCELLED;
    enrollment.cancelled_at = new Date();
    // Остаток по подписке контракт разнёс сам; учёт курса в записи сверяется с цепью.
    await this.funds.afterClosed(coopname, enrollment);
    enrollment.refunded_amount = refund.refund;
    enrollment.refund_reason = refund.reason;
    enrollment.close_pending_since = null;
    enrollment.close_error = null;
    const saved = await this.enrollments.save(enrollment);

    const payload: IEduEnrollmentEventPayload = {
      coopname,
      enrollment_id: saved.id,
      learner_id: saved.learner_id,
      course_id: saved.course_id,
      member_username: saved.member_username,
      trx_id: saved.sub_hash,
    };
    this.events.emit(EDUBRIDGE_ENROLLMENT_CANCELLED_EVENT, payload);
    this.logger.info(
      `[EDU.SUB] подписка ${saved.sub_hash} отменена (${refund.reason}): возврат ${refund.refund}, удержано ${refund.withheld}`
    );
    return saved;
  }

  /** Что вернут при отмене — стол показывает это до нажатия кнопки. */
  async refundPreview(coopname: string, member: string, enrollmentId: string): Promise<RefundCalculation> {
    const enrollment = await this.enrollments.findById(coopname, enrollmentId);
    if (!enrollment || enrollment.member_username !== member) throw DomainError.notFound('EDUBRIDGE_SUBSCRIPTION_NOT_FOUND');
    const course = await this.groups.courseOf(coopname, enrollment.course_id, enrollment.group_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');
    return this.refundFor(coopname, enrollment, course, false);
  }

  /** Сколько действующих подписок у пайщика и сколько вернут по ним сегодня — для прекращения участия в программе. */
  async refundsOnExit(coopname: string, member: string): Promise<{ subscriptions: number; refunds: number }> {
    const active = (await this.enrollments.findByMember(coopname, member)).filter((e) => isCancellable(e));
    let refunds = 0;
    for (const enrollment of active) {
      const course = await this.groups.courseOf(coopname, enrollment.course_id, enrollment.group_id);
      if (course) refunds += Number.parseFloat((await this.refundFor(coopname, enrollment, course, false)).refund) || 0;
    }
    return { subscriptions: active.length, refunds };
  }

  /** Предварительная сумма возврата по строке подписки из цепи — её же показывает стол до отмены. */
  async refundFor(coopname: string, enrollment: EdubridgeEnrollmentRecord, course: EdubridgeCourseRecord, underfilled: boolean): Promise<RefundCalculation> {
    return refundOf(enrollment, course, await this.chain.readSubscription(coopname, enrollment.sub_hash), underfilled);
  }

  /**
   * Что контракт записал по подписке после взноса: собрано, удержано, оплачено
   * до. Строка не прочиталась — в запись идёт предварительный расчёт, очередь
   * сверит его с цепью на следующем проходе.
   */
  private async chainState(coopname: string, plan: EnrollmentPlan): Promise<Partial<EdubridgeEnrollmentRecord>> {
    const sub = await this.chain.readSubscription(coopname, plan.subHash).catch(() => null);
    if (!sub?.plan) {
      return { paid_amount: plan.amount, paid_months: plan.months, paid_until: plan.paidUntil, locked_amount: plan.amount };
    }
    const locked = Number.parseFloat(sub.locked ?? '0') > 0 ? (sub.locked as string) : null;
    return {
      paid_amount: sub.charged ?? plan.amount,
      paid_months: (plan.existing?.paid_months ?? 0) + plan.months,
      paid_until: new Date(`${sub.paid_until}Z`),
      locked_amount: locked,
    };
  }

  /**
   * Транзакция оплаты. С главного паевого конвертируется только недостающая
   * часть: остаток кошелька программы засчитывается первым (решение владельца
   * 20.09.2026, тот же порядок, что в «Столе заказов»). Сумму взноса,
   * оплаченный срок, резерв преподавателям и удержание по гарантии считает
   * контракт; приложение называет период и сумму из подписанного заявления —
   * при расхождении с расчётом контракт взнос не примет.
   */
  private sendPayment(
    coopname: string,
    member: string,
    plan: EnrollmentPlan,
    period: EduEnrollmentPeriod,
    funding: PlanFunding,
    document: ISignedDocument
  ) {
    // Конвертация идёт под хэшем подписки — тем же, что взнос: в реестре процессов доступ к курсу один.
    const convert = parseFloat(funding.toConvert) > 0 ? { coopname, username: member, sub_hash: plan.subHash, amount: funding.toConvert, statement: document } : null;
    const open = plan.isExtension
      ? null
      : {
          coopname,
          username: member,
          sub_hash: plan.subHash,
          learner_id: Number(plan.learner.chain_ref),
          course_id: Number(plan.course.chain_ref),
          statement_hash: document.hash,
        };
    const charge = {
      coopname,
      username: member,
      sub_hash: plan.subHash,
      period: PERIOD_CHAIN[period],
      expected: plan.amount,
      statement_hash: document.hash,
    };
    return this.chain.convertAndSubscribe(convert as never, open, charge, {
      statement: convert ? undefined : { coopname, username: member, sub_hash: plan.subHash, statement: document as never },
    });
  }

  /**
   * Пайщик подписал заявление с конкретной раскладкой: сколько засчитывается с
   * кошелька программы и сколько конвертируется с паевого. Если к моменту
   * подписки остатки изменились (пришёл возврат, прошла другая оплата),
   * подписанное расходится с тем, что уйдёт в цепь, — заявление формируется заново.
   */
  private assertStatementMatches(document: ISignedDocument, plan: EnrollmentPlan, funding: PlanFunding): void {
    const raw = document.meta as unknown;
    let meta: Record<string, unknown> = {};
    try {
      meta = (typeof raw === 'string' ? JSON.parse(raw) : raw ?? {}) as Record<string, unknown>;
    } catch {
      meta = {};
    }
    const matches =
      String(meta.sub_hash ?? '').toLowerCase() === plan.subHash.toLowerCase() &&
      String(meta.total ?? '') === plan.amount &&
      String(meta.amount ?? '') === funding.toConvert;
    if (!matches) {
      throw DomainError.badRequest('EDUBRIDGE_ENROLLMENT_STATEMENT_STALE');
    }
  }

  private async availableShare(coopname: string, member: string, symbol: string): Promise<string> {
    return this.availableOn(coopname, member, SHARE_WALLET, symbol);
  }

  private async availableOn(coopname: string, member: string, wallet: string, symbol: string): Promise<string> {
    const row = await this.wallets.findByWalletAndUsername(coopname, wallet, member);
    const n = Number.parseFloat(row?.available ?? '0');
    return `${(Number.isNaN(n) ? 0 : n).toFixed(4)} ${symbol}`;
  }

  /**
   * Чем платится взнос: сначала остаток кошелька программы, с главного паевого —
   * только недостающая часть. Так участник тратит возвращённые ему взносы на
   * новые подписки, а не копит их мёртвым грузом (п. 4.2.5 Положения ЦПП).
   */
  private async planFunding(coopname: string, member: string, plan: EnrollmentPlan): Promise<PlanFunding> {
    const [programAvailable, shareAvailable] = await Promise.all([
      this.availableOn(coopname, member, MEMBER_WALLET, plan.symbol),
      this.availableOn(coopname, member, SHARE_WALLET, plan.symbol),
    ]);
    const need = parseFloat(plan.amount);
    const program = parseFloat(programAvailable);
    const share = parseFloat(shareAvailable);

    const fromProgram = Math.min(need, program);
    const toConvert = need - fromProgram;
    const shortfall = Math.max(0, toConvert - share);

    const asset = (value: number): string => `${value.toFixed(4)} ${plan.symbol}`;
    return {
      fromProgram: asset(fromProgram),
      toConvert: asset(toConvert),
      available: shareAvailable,
      enough: shortfall === 0,
      shortfall: asset(shortfall),
    };
  }
}

/** Отменить можно действующую подписку; истёкшую, отозванную и уже отменённую — нет. */
export function isCancellable(e: EdubridgeEnrollmentRecord): boolean {
  return e.status === EduEnrollmentStatus.ACTIVE || e.status === EduEnrollmentStatus.PENDING;
}

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
import { monthsOfPeriod, type RefundCalculation } from '../../domain/economy/refund.calculator';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import type { EdubridgeCourseEntity, EdubridgeEnrollmentEntity, EdubridgeLearnerEntity } from '../../infrastructure/entities';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeEnrollmentRepository } from '../../infrastructure/repositories/edubridge-enrollment.repository';
import type { EduQuoteDTO } from '../dto/edu-enrollment.dto';
import {
  EDUBRIDGE_ENROLLMENT_CANCELLED_EVENT,
  EDUBRIDGE_ENROLLMENT_EXTENDED_EVENT,
  EDUBRIDGE_ENROLLMENT_OPENED_EVENT,
  type IEduEnrollmentEventPayload,
} from '../events/edubridge.events';
import { EdubridgeFundsService } from './edubridge-funds.service';
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
  learner: EdubridgeLearnerEntity;
  course: EdubridgeCourseEntity;
  existing: EdubridgeEnrollmentEntity | null;
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
    private readonly enrollments: EdubridgeEnrollmentRepository,
    private readonly courses: EdubridgeCourseRepository,
    private readonly learnerService: EdubridgeLearnerService,
    private readonly funds: EdubridgeFundsService,
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort,
    @Inject(USER_WALLET_PORT) private readonly wallets: IUserWalletPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly events: EventEmitter2
  ) {
    this.logger.setContext(EdubridgeEnrollmentService.name);
  }

  async listMine(coopname: string, member: string): Promise<Array<{ enrollment: EdubridgeEnrollmentEntity; course: EdubridgeCourseEntity | null }>> {
    const rows = await this.enrollments.findByMember(coopname, member);
    const result: Array<{ enrollment: EdubridgeEnrollmentEntity; course: EdubridgeCourseEntity | null }> = [];
    for (const enrollment of rows) {
      result.push({ enrollment, course: await this.courses.findById(coopname, enrollment.course_id) });
    }
    return result;
  }

  courseOf(enrollment: EdubridgeEnrollmentEntity): Promise<EdubridgeCourseEntity | null> {
    return this.courses.findById(enrollment.coopname, enrollment.course_id);
  }

  /** Ключ подписки в цепи: детерминирован парой «обучающийся + курс». */
  static subHash(coopname: string, learnerRef: string, courseRef: string): string {
    return createHash('sha256').update(`${coopname}|${learnerRef}|${courseRef}`).digest('hex');
  }

  async plan(coopname: string, member: string, learnerId: string, courseId: string, period: EduEnrollmentPeriod): Promise<EnrollmentPlan> {
    const learner = await this.learnerService.getOwned(coopname, member, learnerId);
    const course = await this.courses.findById(coopname, courseId);
    const existing = await this.enrollments.findByPair(coopname, learnerId, courseId);
    // Действующая подписка живёт в цепи до закрытия, даже когда оплаченный срок
    // уже истёк, а очередь закрытия до неё ещё не дошла: новый взнос её
    // продлевает, а не открывает заново — иначе цепь ответит «уже существует».
    const isExtension = existing?.status === EduEnrollmentStatus.ACTIVE && Boolean(existing.paid_until);
    // Снятый с публикации курс новых участников не принимает, но действующие
    // подписки на нём продлеваются.
    if (!course || (course.status !== EduCourseStatus.PUBLISHED && !isExtension)) {
      throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND_OR_UNPUBLISHED');
    }

    const symbol = course.fee_month.split(' ')[1] ?? '';
    const now = new Date();
    const paidUntil = isExtension ? (existing?.paid_until as Date) : null;
    const terms = this.termsOf(course, period, paidUntil && paidUntil > now ? paidUntil : now);

    return {
      learner,
      course,
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
  private termsOf(course: EdubridgeCourseEntity, period: EduEnrollmentPeriod, from: Date): PeriodTerms {
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

  async quote(coopname: string, member: string, learnerId: string, courseId: string, period: EduEnrollmentPeriod): Promise<EduQuoteDTO> {
    const plan = await this.plan(coopname, member, learnerId, courseId, period);
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
    };
  }

  /**
   * Заявление о конвертации (3011) без подписи — пайщик подписывает его на
   * фронте. В заявлении названы обе части: что засчитывается с кошелька
   * программы и что конвертируется с паевого.
   */
  async statement(coopname: string, member: string, learnerId: string, courseId: string, period: EduEnrollmentPeriod): Promise<InnerGeneratedDocument> {
    const plan = await this.plan(coopname, member, learnerId, courseId, period);
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
    document: ISignedDocument
  ): Promise<EdubridgeEnrollmentEntity> {
    const plan = await this.plan(coopname, member, learnerId, courseId, period);
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
        sub_hash: plan.subHash,
      });
    Object.assign(entity, this.paidBase(plan));
    entity.period = period;
    entity.paid_until = plan.paidUntil;
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
  async cancel(coopname: string, member: string, enrollmentId: string): Promise<EdubridgeEnrollmentEntity> {
    const enrollment = await this.enrollments.findById(coopname, enrollmentId);
    if (!enrollment || enrollment.member_username !== member) throw DomainError.notFound('EDUBRIDGE_SUBSCRIPTION_NOT_FOUND');
    return this.cancelOne(coopname, enrollment, false);
  }

  /**
   * Отмена курса по недобору: кооператив не открыл группу и отменяет своё
   * решение, поэтому взнос возвращается целиком и сразу на паевой — заявления
   * от учеников это не требует. Пока занятия не начались: после первого
   * занятия отменять нечего, есть отказ от подписки.
   */
  async cancelCourse(coopname: string, courseId: string): Promise<EdubridgeEnrollmentEntity[]> {
    const course = await this.courses.findById(coopname, courseId);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');
    if (course.starts_at && new Date(course.starts_at) <= new Date()) {
      throw DomainError.badRequest('EDUBRIDGE_UNDERFILL_CANCEL_COURSE_STARTED');
    }
    // Курс снимается с публикации первым: пока идут возвраты, на отменённый
    // курс никто не должен успеть подписаться.
    if (course.status === EduCourseStatus.PUBLISHED) {
      course.status = EduCourseStatus.ARCHIVED;
      await this.courses.save(course);
    }
    const active = (await this.enrollments.findByCourse(coopname, courseId)).filter((e) => isCancellable(e));
    const cancelled: EdubridgeEnrollmentEntity[] = [];
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
  async cancelAllForMember(coopname: string, member: string, reason: string): Promise<EdubridgeEnrollmentEntity[]> {
    const active = (await this.enrollments.findByMember(coopname, member)).filter((e) => isCancellable(e));
    const cancelled: EdubridgeEnrollmentEntity[] = [];
    for (const enrollment of active) {
      try {
        cancelled.push(await this.cancelOne(coopname, enrollment, false));
      } catch (e) {
        this.logger.warn(`[EDU.SUB] выход ${member} (${reason}): подписка ${enrollment.id} не закрыта — ${(e as Error)?.message ?? e}`);
      }
    }
    if (cancelled.length) {
      this.logger.info(`[EDU.SUB] выход ${member} (${reason}): закрыто подписок ${cancelled.length}`);
    }
    return cancelled;
  }

  /** Общая часть отмены: расчёт по Положению, движение в цепи, закрытие записи. */
  private async cancelOne(coopname: string, enrollment: EdubridgeEnrollmentEntity, underfilled: boolean): Promise<EdubridgeEnrollmentEntity> {
    if (!isCancellable(enrollment)) throw DomainError.badRequest('EDUBRIDGE_SUBSCRIPTION_ALREADY_CLOSED');
    const course = await this.courses.findById(coopname, enrollment.course_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');

    const refund = this.refundFor(enrollment, course, underfilled);
    await this.chain.cancelSubscription({
      coopname,
      username: enrollment.member_username,
      sub_hash: enrollment.sub_hash,
      refund: refund.refund,
      to_share: refund.to_share,
    } as never);

    enrollment.status = EduEnrollmentStatus.CANCELLED;
    enrollment.cancelled_at = new Date();
    // Удержанное цепь вернула в фонд сама, вместе с отменой; резерв
    // преподавателям по курсу выравнивается под оставшихся участников.
    await this.funds.afterClosed(coopname, enrollment);
    enrollment.refunded_amount = refund.refund;
    enrollment.refund_reason = refund.reason;
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
    const course = await this.courses.findById(coopname, enrollment.course_id);
    if (!course) throw DomainError.notFound('EDUBRIDGE_COURSE_NOT_FOUND');
    return this.refundFor(enrollment, course, false);
  }

  /** Сколько действующих подписок у пайщика и сколько вернут по ним сегодня — для прекращения участия в программе. */
  async refundsOnExit(coopname: string, member: string): Promise<{ subscriptions: number; refunds: number }> {
    const active = (await this.enrollments.findByMember(coopname, member)).filter((e) => isCancellable(e));
    let refunds = 0;
    for (const enrollment of active) {
      const course = await this.courses.findById(coopname, enrollment.course_id);
      if (course) refunds += Number.parseFloat(this.refundFor(enrollment, course, false).refund) || 0;
    }
    return { subscriptions: active.length, refunds };
  }

  /** Сумма возврата по Положению ЦПП — её же показывает стол до отмены. */
  refundFor(enrollment: EdubridgeEnrollmentEntity, course: EdubridgeCourseEntity, underfilled: boolean): RefundCalculation {
    return refundOf(enrollment, course, underfilled);
  }

  /**
   * Пока прежний оплаченный срок не кончился, новый взнос складывается с
   * прежним: возврат по Положению считается от всего оплаченного, а не от
   * последнего платежа. Истёкший срок израсходован целиком — счёт с нуля.
   */
  private paidBase(plan: EnrollmentPlan): Partial<EdubridgeEnrollmentEntity> {
    const zero = zeroOf(plan.symbol);
    const base = priorBase(plan);
    return {
      paid_amount: sumAssets(base?.paid_amount ?? zero, plan.amount),
      paid_months: (base?.paid_months ?? 0) + plan.months,
      // Удержанное копится до освобождения независимо от того, кончился ли прежний оплаченный срок.
      locked_amount: sumAssets(plan.existing?.locked_amount ?? zero, plan.amount),
    };
  }

  /**
   * Транзакция оплаты. С главного паевого конвертируется только недостающая
   * часть: остаток кошелька программы засчитывается первым (решение владельца
   * 20.09.2026, тот же порядок, что в «Столе заказов»). Взнос уходит в фонд той
   * же транзакцией на полную сумму, независимо от того, сколько конвертировано
   * (Положение ЦПП, п. 4.2.2), и сразу удерживается целиком: пока участник
   * может потребовать взнос назад, на расходы он не идёт. Что вернуть уже
   * нельзя, очередь освободит сама.
   */
  private sendPayment(
    coopname: string,
    member: string,
    plan: EnrollmentPlan,
    period: EduEnrollmentPeriod,
    funding: PlanFunding,
    document: ISignedDocument
  ) {
    const convert = parseFloat(funding.toConvert) > 0 ? { coopname, username: member, amount: funding.toConvert, statement: document } : null;
    const subscribe = this.subscribeAction(coopname, member, plan, period, document);
    const charge = { coopname, username: member, sub_hash: plan.subHash, amount: plan.amount };
    return this.chain.convertAndSubscribe(convert as never, subscribe as never, charge as never, {
      lock: plan.amount,
      statement: convert ? undefined : { coopname, username: member, statement: document as never },
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

  /** `extendsub` для действующей связки, `opensub` — для новой; время цепи без миллисекунд и зоны. */
  private subscribeAction(coopname: string, member: string, plan: EnrollmentPlan, period: EduEnrollmentPeriod, document: ISignedDocument) {
    const paid_until = new Date(Math.floor(plan.paidUntil.getTime() / 1000) * 1000).toISOString().slice(0, 19);
    if (plan.isExtension) {
      return { kind: 'extend' as const, data: { coopname, sub_hash: plan.subHash, paid_until, statement_hash: document.hash } };
    }
    return {
      kind: 'open' as const,
      data: {
        coopname,
        username: member,
        sub_hash: plan.subHash,
        learner_id: Number(plan.learner.chain_ref),
        course_id: Number(plan.course.chain_ref),
        period: PERIOD_CHAIN[period],
        paid_until,
        statement_hash: document.hash,
      },
    };
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

/** Прежний оплаченный срок, пока он не кончился: к нему прибавляется новый взнос. */
function priorBase(plan: EnrollmentPlan): { paid_amount: string; paid_months: number } | null {
  const prior = plan.existing;
  if (!plan.isExtension || !prior?.paid_until || prior.paid_until <= new Date()) return null;
  return {
    paid_amount: prior.paid_amount,
    paid_months: prior.paid_months ?? monthsOfPeriod(prior.period === EduEnrollmentPeriod.YEAR ? 'year' : 'month'),
  };
}

function zeroOf(symbol: string): string {
  return `0.0000 ${symbol}`;
}

/** Сумма двух сумм цепи в одном символе («9600.0000 RUB»). */
function sumAssets(a: string, b: string): string {
  const [av, symbol] = String(a ?? '').trim().split(' ');
  const [bv, bSymbol] = String(b ?? '').trim().split(' ');
  const total = (Number.parseFloat(av) || 0) + (Number.parseFloat(bv) || 0);
  return `${total.toFixed(4)} ${symbol || bSymbol || ''}`.trim();
}

/** Отменить можно действующую подписку; истёкшую, отозванную и уже отменённую — нет. */
function isCancellable(e: EdubridgeEnrollmentEntity): boolean {
  return e.status === EduEnrollmentStatus.ACTIVE || e.status === EduEnrollmentStatus.PENDING;
}

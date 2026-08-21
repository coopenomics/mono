import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import type { EdubridgeCourseEntity, EdubridgeEnrollmentEntity, EdubridgeLearnerEntity } from '../../infrastructure/entities';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeEnrollmentRepository } from '../../infrastructure/repositories/edubridge-enrollment.repository';
import type { EduQuoteDTO } from '../dto/edu-enrollment.dto';
import {
  EDUBRIDGE_ENROLLMENT_EXTENDED_EVENT,
  EDUBRIDGE_ENROLLMENT_OPENED_EVENT,
  type IEduEnrollmentEventPayload,
} from '../events/edubridge.events';
import { EdubridgeLearnerService } from './edubridge-learner.service';

/** Главный паевой кошелёк — источник конвертации. */
const SHARE_WALLET = 'w.wal.share';
const PERIOD_MONTHS: Record<EduEnrollmentPeriod, number> = { [EduEnrollmentPeriod.MONTH]: 1, [EduEnrollmentPeriod.YEAR]: 12 };
const PERIOD_CHAIN: Record<EduEnrollmentPeriod, string> = { [EduEnrollmentPeriod.MONTH]: 'month', [EduEnrollmentPeriod.YEAR]: 'year' };

export interface EnrollmentPlan {
  learner: EdubridgeLearnerEntity;
  course: EdubridgeCourseEntity;
  existing: EdubridgeEnrollmentEntity | null;
  period: EduEnrollmentPeriod;
  amount: string;
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
    if (!course || course.status !== EduCourseStatus.PUBLISHED) throw new NotFoundException('Курс не найден или не опубликован');

    const amount = period === EduEnrollmentPeriod.YEAR ? course.fee_year : course.fee_month;
    const symbol = amount.split(' ')[1] ?? '';
    const existing = await this.enrollments.findByPair(coopname, learnerId, courseId);
    const now = new Date();
    const activeUntil = existing?.status === EduEnrollmentStatus.ACTIVE && existing.paid_until && existing.paid_until > now ? existing.paid_until : null;
    const base = activeUntil ?? now;
    const paidUntil = new Date(base);
    paidUntil.setMonth(paidUntil.getMonth() + PERIOD_MONTHS[period]);

    return {
      learner,
      course,
      existing,
      period,
      amount,
      symbol,
      isExtension: Boolean(activeUntil),
      paidUntil,
      subHash: EdubridgeEnrollmentService.subHash(coopname, learner.chain_ref, course.chain_ref),
    };
  }

  async quote(coopname: string, member: string, learnerId: string, courseId: string, period: EduEnrollmentPeriod): Promise<EduQuoteDTO> {
    const plan = await this.plan(coopname, member, learnerId, courseId, period);
    const available = await this.availableShare(coopname, member, plan.symbol);
    const need = parseFloat(plan.amount);
    const have = parseFloat(available);
    const shortfall = Math.max(0, need - have);
    return {
      amount: plan.amount,
      available,
      enough: have >= need,
      shortfall: `${shortfall.toFixed(4)} ${plan.symbol}`,
      is_extension: plan.isExtension,
      paid_until: plan.paidUntil,
      sub_hash: plan.subHash,
    };
  }

  /** Заявление о конвертации (3011) без подписи — пайщик подписывает его на фронте. */
  async statement(coopname: string, member: string, learnerId: string, courseId: string, period: EduEnrollmentPeriod): Promise<InnerGeneratedDocument> {
    const plan = await this.plan(coopname, member, learnerId, courseId, period);
    const action: Cooperative.Registry.EducationConvertStatement.Action = {
      registry_id: Cooperative.Registry.EducationConvertStatement.registry_id,
      coopname,
      username: member,
      lang: 'ru',
      sub_hash: plan.subHash,
      amount: plan.amount,
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
    const available = parseFloat(await this.availableShare(coopname, member, plan.symbol));
    if (available < parseFloat(plan.amount)) {
      throw new BadRequestException(
        `Недостаточно паевого взноса: нужно ${plan.amount}, доступно ${available.toFixed(4)} ${plan.symbol}. Пополните главный кошелёк.`
      );
    }

    const convert = { coopname, username: member, amount: plan.amount, statement: document };
    const paidUntilSec = Math.floor(plan.paidUntil.getTime() / 1000);
    const subscribe = plan.isExtension
      ? { kind: 'extend' as const, data: { coopname, sub_hash: plan.subHash, paid_until: new Date(paidUntilSec * 1000).toISOString().slice(0, 19), statement_hash: document.hash } }
      : {
          kind: 'open' as const,
          data: {
            coopname,
            username: member,
            sub_hash: plan.subHash,
            learner_id: Number(plan.learner.chain_ref),
            course_id: Number(plan.course.chain_ref),
            period: PERIOD_CHAIN[period],
            paid_until: new Date(paidUntilSec * 1000).toISOString().slice(0, 19),
            statement_hash: document.hash,
          },
        };

    const result = await this.chain.convertAndSubscribe(convert as never, subscribe as never);
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
    entity.period = period;
    entity.paid_until = plan.paidUntil;
    entity.status = EduEnrollmentStatus.ACTIVE;
    entity.statement_hash = document.hash.toLowerCase();
    entity.expiry_notified_at = null;
    if (!plan.isExtension) entity.access_state = EduAccessState.PENDING;
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

  private async availableShare(coopname: string, member: string, symbol: string): Promise<string> {
    const row = await this.wallets.findByWalletAndUsername(coopname, SHARE_WALLET, member);
    const n = Number.parseFloat(row?.available ?? '0');
    return `${(Number.isNaN(n) ? 0 : n).toFixed(4)} ${symbol}`;
  }
}

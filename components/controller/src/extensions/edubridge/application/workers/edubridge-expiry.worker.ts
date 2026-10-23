import { trxIdOf } from '../../domain/lib/trx-id';
import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isWorkerTurn } from '../../domain/economy/time-scale';
import { chainErrorCode, platformSettings } from '@coopenomics/extension-kit';
import { LOGGER_PORT, NOTIFICATION_PORT, type ILoggerPort, type INotificationPort } from '@coopenomics/innercoop';
import { Workflows } from '@coopenomics/notifications';
import { EduAccessTaskKind, EduEnrollmentStatus } from '../../domain/enums';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeLearnerKyselyRepository } from '../../infrastructure/repositories/edubridge-learner.kysely-repository';
import { EdubridgeAccessOutboxService } from '../services/edubridge-access-outbox.service';
import { EdubridgeEnrollmentService } from '../services/edubridge-enrollment.service';
import { EdubridgeFundsService } from '../services/edubridge-funds.service';
import { EdubridgeGuaranteeService } from '../services/edubridge-guarantee.service';
import { EdubridgeSettlementService } from '../services/edubridge-settlement.service';

/**
 * Граница оплаченного периода: предупредить заранее, а по наступлению —
 * `expiresub` ключом кооператива и отзыв доступа. Ручных операций ноль.
 */
/** Ответ цепи, когда записи подписки уже нет. */
/** Код отказа контракта: подписки с таким hash в цепи нет. */
const SUBSCRIPTION_GONE = 'EDUBRIDGE_SUBSCRIPTION_NOT_FOUND';


/** За сколько дней до конца оплаченного периода пайщик получает напоминание о продлении. Внутренняя константа приложения, не настройка кооператива. */
const EXPIRY_NOTICE_DAYS = 7;

@Injectable()
export class EdubridgeExpiryWorker {
  private running = false;

  constructor(
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly learners: EdubridgeLearnerKyselyRepository,
    private readonly courses: EdubridgeCourseKyselyRepository,
    private readonly outbox: EdubridgeAccessOutboxService,
    private readonly funds: EdubridgeFundsService,
    private readonly enrollmentService: EdubridgeEnrollmentService,
    private readonly guarantee: EdubridgeGuaranteeService,
    private readonly settlement: EdubridgeSettlementService,
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeExpiryWorker.name);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.running || !isWorkerTurn()) return;
    const coopname = platformSettings().coopname;
    if (!coopname) return;
    this.running = true;
    try {
      // Сначала освобождается удержанное, которое уже нельзя потребовать назад, затем закрываются истёкшие подписки.
      await this.funds.unlockDue(coopname);
      await this.expire(coopname);
      // Отчитаны все занятия программы группы — её истёкшие подписки закрываются в цепи.
      await this.settlement.closeReported(coopname);
      // Подписки, не закрывшиеся при выходе пайщика: возврат по ним должен дойти до кошелька программы.
      await this.enrollmentService.retryPendingClosures(coopname);
      // Заявления по гарантийным условиям, не дошедшие до совета из-за сбоя.
      await this.guarantee.publishPending(coopname);
      await this.notifyExpiring(coopname);
    } catch (e) {
      this.logger.error(`[EDU.EXPIRY] сбой: ${(e as Error)?.message ?? e}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Оплаченный срок вышел: доступ отзывается сразу. Подписка в цепи остаётся —
   * по ней ещё проходит расчёт занятий, проведённых в оплаченный срок. Закрывает
   * её `EdubridgeSettlementService`: по полному отчёту о программе либо по
   * слову администратора.
   */
  async expire(coopname: string): Promise<number> {
    const due = await this.enrollments.findExpired(coopname, new Date());
    for (const enrollment of due) {
      try {
        enrollment.status = EduEnrollmentStatus.EXPIRED;
        // Отметка «подписка ещё в цепи»: её снимает закрытие расчётов.
        enrollment.chain_close_after = enrollment.paid_until ?? new Date();
        await this.enrollments.save(enrollment);
        const course = await this.courses.findById(coopname, enrollment.course_id);
        const trigger = `expire:${enrollment.id}:${enrollment.paid_until?.toISOString()}`;
        if (course) await this.outbox.enqueue({ coopname, enrollment, kind: EduAccessTaskKind.REVOKE, carrier: course.carrier, trigger });
        this.logger.info(`[EDU.EXPIRY] подписка ${enrollment.id} истекла — доступ отзывается, расчёты по ней открыты до отчёта о занятиях`);
      } catch (e) {
        this.logger.warn(`[EDU.EXPIRY] подписка ${enrollment.sub_hash}: ${(e as Error)?.message ?? e}`);
      }
    }
    return due.length;
  }

  /**
   * `expiresub` в цепь. Записи там может уже не быть — её стёрли раньше, а
   * статус здесь не сохранился. Подписка всё равно истекла: доступ отзывается,
   * иначе очередь спотыкалась бы о неё вечно, а ученик учился бы без взноса.
   */
  private async closeInChain(coopname: string, subHash: string, fallback: string): Promise<string> {
    try {
      const result = await this.chain.expireSubscription({ coopname, sub_hash: subHash });
      return trxIdOf(result) ?? fallback;
    } catch (e) {
      if (chainErrorCode(e) !== SUBSCRIPTION_GONE) throw e;
      this.logger.warn(`[EDU.EXPIRY] подписки ${subHash} в цепи уже нет — закрываем запись и отзываем доступ`);
      return fallback;
    }
  }

  async notifyExpiring(coopname: string): Promise<number> {
    const until = new Date(Date.now() + EXPIRY_NOTICE_DAYS * 86_400_000);
    const soon = await this.enrollments.findExpiringSoon(coopname, until);
    for (const enrollment of soon) {
      // Программа оплачена до конца — продлевать нечего, напоминание не шлётся.
      if (!(await this.enrollmentService.isRenewable(enrollment))) continue;
      const [learner, course] = await Promise.all([
        this.learners.findById(coopname, enrollment.learner_id),
        this.courses.findById(coopname, enrollment.course_id),
      ]);
      try {
        await this.notifications.notifyUser(enrollment.member_username, Workflows.EdubridgeAccessExpiring.id, {
          learnerName: learner?.display_name ?? '',
          courseTitle: course?.title ?? '',
          paidUntil: enrollment.paid_until?.toLocaleDateString('ru-RU') ?? '',
          coopname,
          // Ссылка ведёт туда, где продлевают: на «Мои подписки».
          deepLinkUrl: `${platformSettings().frontendUrl}/${coopname}/edubridge-member/subscriptions`,
        });
        enrollment.expiry_notified_at = new Date();
        await this.enrollments.save(enrollment);
      } catch (e) {
        this.logger.warn(`[EDU.EXPIRY] уведомление по подписке ${enrollment.id}: ${(e as Error)?.message ?? e}`);
      }
    }
    return soon.length;
  }

  /** Выход пайщика из кооператива: все его подписки закрываются досрочно. */
  async revokeAllForMember(coopname: string, username: string, reason: string): Promise<void> {
    const active = await this.enrollments.findActiveByMember(coopname, username);
    for (const enrollment of active) {
      try {
        const trx = await this.closeInChain(coopname, enrollment.sub_hash, `revoke:${enrollment.id}`);
        enrollment.status = EduEnrollmentStatus.REVOKED;
        await this.funds.afterClosed(coopname, enrollment);
        await this.enrollments.save(enrollment);
        const course = await this.courses.findById(coopname, enrollment.course_id);
        if (course) await this.outbox.enqueue({ coopname, enrollment, kind: EduAccessTaskKind.REVOKE, carrier: course.carrier, trigger: trx });
      } catch (e) {
        this.logger.warn(`[EDU.EXPIRY] досрочный отзыв ${enrollment.id} (${reason}): ${(e as Error)?.message ?? e}`);
      }
    }
  }
}

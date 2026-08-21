import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { platformSettings } from '@coopenomics/extension-kit';
import { LOGGER_PORT, NOTIFICATION_PORT, type ILoggerPort, type INotificationPort } from '@coopenomics/innercoop';
import { Workflows } from '@coopenomics/notifications';
import { EduAccessTaskKind, EduEnrollmentStatus } from '../../domain/enums';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeEnrollmentRepository } from '../../infrastructure/repositories/edubridge-enrollment.repository';
import { EdubridgeLearnerRepository } from '../../infrastructure/repositories/edubridge-learner.repository';
import { EdubridgeConfigHolder } from '../config/edubridge-config.holder';
import { EdubridgeAccessOutboxService } from '../services/edubridge-access-outbox.service';

/**
 * Граница оплаченного периода: предупредить заранее, а по наступлению —
 * `expiresub` ключом кооператива и отзыв доступа. Ручных операций ноль.
 */
@Injectable()
export class EdubridgeExpiryWorker {
  private running = false;

  constructor(
    private readonly enrollments: EdubridgeEnrollmentRepository,
    private readonly learners: EdubridgeLearnerRepository,
    private readonly courses: EdubridgeCourseRepository,
    private readonly outbox: EdubridgeAccessOutboxService,
    private readonly config: EdubridgeConfigHolder,
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeExpiryWorker.name);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(): Promise<void> {
    if (this.running) return;
    const coopname = platformSettings().coopname;
    if (!coopname) return;
    this.running = true;
    try {
      await this.expire(coopname);
      await this.notifyExpiring(coopname);
    } catch (e) {
      this.logger.error(`[EDU.EXPIRY] сбой: ${(e as Error)?.message ?? e}`);
    } finally {
      this.running = false;
    }
  }

  async expire(coopname: string): Promise<number> {
    const due = await this.enrollments.findExpired(coopname, new Date());
    for (const enrollment of due) {
      try {
        const result = await this.chain.expireSubscription({ coopname, sub_hash: enrollment.sub_hash });
        const trx = String((result as { transaction_id?: string })?.transaction_id ?? `expire:${enrollment.id}:${enrollment.paid_until?.toISOString()}`);
        enrollment.status = EduEnrollmentStatus.EXPIRED;
        await this.enrollments.save(enrollment);
        const course = await this.courses.findById(coopname, enrollment.course_id);
        if (course) await this.outbox.enqueue({ coopname, enrollment, kind: EduAccessTaskKind.REVOKE, carrier: course.carrier, trigger: trx });
        this.logger.info(`[EDU.EXPIRY] подписка ${enrollment.id} истекла — expiresub ${trx}`);
      } catch (e) {
        // Запись в цепи уже могла быть стёрта (повтор) — сверим на следующем тике.
        this.logger.warn(`[EDU.EXPIRY] expiresub ${enrollment.sub_hash}: ${(e as Error)?.message ?? e}`);
      }
    }
    return due.length;
  }

  async notifyExpiring(coopname: string): Promise<number> {
    const days = (await this.config.load()).expiry_notice_days;
    if (!days || days <= 0) return 0;
    const until = new Date(Date.now() + days * 86_400_000);
    const soon = await this.enrollments.findExpiringSoon(coopname, until);
    for (const enrollment of soon) {
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
          deepLinkUrl: `${platformSettings().frontendUrl}/${coopname}/edubridge-member/learners`,
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
        const result = await this.chain.expireSubscription({ coopname, sub_hash: enrollment.sub_hash });
        const trx = String((result as { transaction_id?: string })?.transaction_id ?? `revoke:${enrollment.id}`);
        enrollment.status = EduEnrollmentStatus.REVOKED;
        await this.enrollments.save(enrollment);
        const course = await this.courses.findById(coopname, enrollment.course_id);
        if (course) await this.outbox.enqueue({ coopname, enrollment, kind: EduAccessTaskKind.REVOKE, carrier: course.carrier, trigger: trx });
      } catch (e) {
        this.logger.warn(`[EDU.EXPIRY] досрочный отзыв ${enrollment.id} (${reason}): ${(e as Error)?.message ?? e}`);
      }
    }
  }
}

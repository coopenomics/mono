import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { platformSettings } from '@coopenomics/extension-kit';
import { LOGGER_PORT, NOTIFICATION_PORT, type ILoggerPort, type INotificationPort } from '@coopenomics/innercoop';
import { Workflows } from '@coopenomics/notifications';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeEnrollmentRepository } from '../../infrastructure/repositories/edubridge-enrollment.repository';
import { EdubridgeLearnerRepository } from '../../infrastructure/repositories/edubridge-learner.repository';
import { EDUBRIDGE_ACCESS_GRANTED_EVENT, EDUBRIDGE_ACCESS_NEEDS_ATTENTION_EVENT } from '../events/edubridge.events';
import { EdubridgeOwnerDirectory } from '../membership/edubridge-owner.directory';

/** Доменные события → уведомления: пайщику о выданном доступе, владельцу о застрявшей задаче. */
@Injectable()
export class EdubridgeNotificationListener {
  constructor(
    private readonly enrollments: EdubridgeEnrollmentRepository,
    private readonly learners: EdubridgeLearnerRepository,
    private readonly courses: EdubridgeCourseRepository,
    private readonly owners: EdubridgeOwnerDirectory,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeNotificationListener.name);
  }

  @OnEvent(EDUBRIDGE_ACCESS_GRANTED_EVENT)
  async onGranted(payload: { coopname: string; enrollment_id: string; member_username: string }): Promise<void> {
    try {
      const enrollment = await this.enrollments.findById(payload.coopname, payload.enrollment_id);
      if (!enrollment) return;
      const [learner, course] = await Promise.all([
        this.learners.findById(payload.coopname, enrollment.learner_id),
        this.courses.findById(payload.coopname, enrollment.course_id),
      ]);
      await this.notifications.notifyUser(payload.member_username, Workflows.EdubridgeAccessGranted.id, {
        learnerName: learner?.display_name ?? '',
        courseTitle: course?.title ?? '',
        paidUntil: enrollment.paid_until?.toLocaleDateString('ru-RU') ?? '',
        coopname: payload.coopname,
        deepLinkUrl: `${platformSettings().frontendUrl}/${payload.coopname}/edubridge-member/learners`,
      });
    } catch (e) {
      this.logger.warn(`уведомление о выдаче доступа: ${(e as Error)?.message ?? e}`);
    }
  }

  @OnEvent(EDUBRIDGE_ACCESS_NEEDS_ATTENTION_EVENT)
  async onNeedsAttention(payload: { coopname: string; enrollment_id: string; course_id?: string; reason: string }): Promise<void> {
    try {
      const enrollment = await this.enrollments.findById(payload.coopname, payload.enrollment_id);
      const course = enrollment ? await this.courses.findById(payload.coopname, enrollment.course_id) : null;
      const owner = await this.owners.chairman(payload.coopname);
      if (!owner) return;
      await this.notifications.notifyUser(owner, Workflows.EdubridgeAccessNeedsAttention.id, {
        courseTitle: course?.title ?? '',
        reason: payload.reason,
        coopname: payload.coopname,
        deepLinkUrl: `${platformSettings().frontendUrl}/${payload.coopname}/edubridge/queue`,
      });
    } catch (e) {
      this.logger.warn(`уведомление владельцу: ${(e as Error)?.message ?? e}`);
    }
  }
}

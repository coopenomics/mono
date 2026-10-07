import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { platformSettings } from '@coopenomics/extension-kit';
import { LOGGER_PORT, NOTIFICATION_PORT, type ILoggerPort, type INotificationPort } from '@coopenomics/innercoop';
import { Workflows } from '@coopenomics/notifications';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeLearnerKyselyRepository } from '../../infrastructure/repositories/edubridge-learner.kysely-repository';
import { EdubridgeLessonKyselyRepository } from '../../infrastructure/repositories/edubridge-lesson.kysely-repository';
import { EdubridgeTeacherKyselyRepository } from '../../infrastructure/repositories/edubridge-teacher.kysely-repository';
import { EDUBRIDGE_ACCESS_GRANTED_EVENT, EDUBRIDGE_ACCESS_NEEDS_ATTENTION_EVENT, EDUBRIDGE_CONTRIBUTION_COUNCIL_APPROVED_EVENT } from '../events/edubridge.events';
import { EdubridgeOwnerDirectory } from '../membership/edubridge-owner.directory';

/**
 * Доменные события → уведомления: пайщику о выданном доступе, владельцу о
 * застрявшей задаче, преподавателю о решении совета по его заявлению.
 * Вторая подпись председателя на акте идёт через запросы одобрений — о ней
 * обе стороны извещает ядро само.
 */
@Injectable()
export class EdubridgeNotificationListener {
  constructor(
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly learners: EdubridgeLearnerKyselyRepository,
    private readonly courses: EdubridgeCourseKyselyRepository,
    private readonly lessons: EdubridgeLessonKyselyRepository,
    private readonly teachers: EdubridgeTeacherKyselyRepository,
    private readonly owners: EdubridgeOwnerDirectory,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeNotificationListener.name);
  }

  /** Совет принял заявление о взносе результатом работы — преподавателю пора подписать акт. */
  @OnEvent(EDUBRIDGE_CONTRIBUTION_COUNCIL_APPROVED_EVENT)
  async onCouncilApproved(payload: { coopname: string; contribution_id: string; teacher_username: string }): Promise<void> {
    try {
      const contribution = await this.teachers.findContribution(payload.coopname, payload.contribution_id);
      if (!contribution) return;
      const lesson = contribution.lesson_id ? await this.lessons.findById(payload.coopname, contribution.lesson_id) : null;
      const course = lesson ? await this.courses.findById(payload.coopname, lesson.course_id) : null;
      await this.notifications.notifyUser(payload.teacher_username, Workflows.EdubridgeRidCouncilApproved.id, {
        courseTitle: course?.title ?? '',
        lessonTitle: lesson?.topic || contribution.description || '',
        decisionId: contribution.council_decision_id ?? '',
        coopname: payload.coopname,
        deepLinkUrl: `${platformSettings().frontendUrl}/${payload.coopname}/edubridge-teacher/lessons`,
      });
    } catch (e) {
      this.logger.warn(`уведомление преподавателю о решении совета: ${(e as Error)?.message ?? e}`);
    }
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

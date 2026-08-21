import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EdubridgeContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord } from '@coopenomics/innercoop';
import { EduAccessTaskKind, EduEnrollmentStatus, type EduRecipientType } from '../../domain/enums';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeEnrollmentRepository } from '../../infrastructure/repositories/edubridge-enrollment.repository';
import {
  EDUBRIDGE_ENROLLMENT_OPENED_EVENT,
  EDUBRIDGE_LEARNER_RECIPIENT_CHANGED_EVENT,
  type IEduEnrollmentEventPayload,
  type IEduLearnerRecipientChangedPayload,
} from '../events/edubridge.events';
import { EdubridgeAccessOutboxService } from '../services/edubridge-access-outbox.service';

const chainEvent = (action: string) => `action::${EdubridgeContract.contractName.production}::${action}`;

/**
 * Связка «факт → задача выдачи». Два источника одного факта: доменное событие
 * сразу после транзакции и он-чейн событие от парсера. Оба идемпотентны через
 * дедупликацию задач по `(kind, enrollment, trx)`, поэтому не важно, кто
 * пришёл первым и пришёл ли второй вовсе.
 */
@Injectable()
export class EdubridgeAccessListener {
  constructor(
    private readonly outbox: EdubridgeAccessOutboxService,
    private readonly enrollments: EdubridgeEnrollmentRepository,
    private readonly courses: EdubridgeCourseRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeAccessListener.name);
  }

  @OnEvent(EDUBRIDGE_ENROLLMENT_OPENED_EVENT)
  async onOpened(payload: IEduEnrollmentEventPayload): Promise<void> {
    await this.enqueueGrant(payload.coopname, payload.enrollment_id, payload.trx_id);
  }

  @OnEvent(chainEvent(EdubridgeContract.Actions.Opensub.actionName))
  async onChainOpensub(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as EdubridgeContract.Actions.Opensub.IOpensub;
    const enrollment = await this.enrollments.findBySubHash(String(data.sub_hash));
    if (!enrollment) {
      this.logger.warn(`opensub ${data.sub_hash}: подписка не найдена в проекции — ждём запись сервиса`);
      return;
    }
    if (enrollment.status !== EduEnrollmentStatus.ACTIVE) {
      enrollment.status = EduEnrollmentStatus.ACTIVE;
      await this.enrollments.save(enrollment);
    }
    await this.enqueueGrant(enrollment.coopname, enrollment.id, action.transaction_id);
  }

  @OnEvent(chainEvent(EdubridgeContract.Actions.Expiresub.actionName))
  async onChainExpiresub(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as EdubridgeContract.Actions.Expiresub.IExpiresub;
    const enrollment = await this.enrollments.findBySubHash(String(data.sub_hash));
    if (!enrollment) return;
    if (enrollment.status === EduEnrollmentStatus.ACTIVE) {
      enrollment.status = EduEnrollmentStatus.EXPIRED;
      await this.enrollments.save(enrollment);
    }
    const course = await this.courses.findById(enrollment.coopname, enrollment.course_id);
    if (!course) return;
    await this.outbox.enqueue({ coopname: enrollment.coopname, enrollment, kind: EduAccessTaskKind.REVOKE, carrier: course.carrier, trigger: action.transaction_id });
  }

  /** Смена контакта: отзыв старого адреса и выдача нового без повторной оплаты. */
  @OnEvent(EDUBRIDGE_LEARNER_RECIPIENT_CHANGED_EVENT)
  async onRecipientChanged(payload: IEduLearnerRecipientChangedPayload): Promise<void> {
    const active = (await this.enrollments.findByLearner(payload.coopname, payload.learner_id)).filter((e) => e.status === EduEnrollmentStatus.ACTIVE);
    for (const enrollment of active) {
      const course = await this.courses.findById(payload.coopname, enrollment.course_id);
      if (!course) continue;
      await this.outbox.enqueue({
        coopname: payload.coopname,
        enrollment,
        kind: EduAccessTaskKind.REVOKE,
        carrier: course.carrier,
        trigger: `${payload.trigger}:old`,
        recipientOverride: { type: payload.previous_recipient_type as EduRecipientType, value: payload.previous_recipient_value },
      });
      await this.outbox.enqueue({ coopname: payload.coopname, enrollment, kind: EduAccessTaskKind.GRANT, carrier: course.carrier, trigger: `${payload.trigger}:new` });
    }
  }

  private async enqueueGrant(coopname: string, enrollmentId: string, trigger: string): Promise<void> {
    const enrollment = await this.enrollments.findById(coopname, enrollmentId);
    if (!enrollment) return;
    const course = await this.courses.findById(coopname, enrollment.course_id);
    if (!course) return;
    await this.outbox.enqueue({ coopname, enrollment, kind: EduAccessTaskKind.GRANT, carrier: course.carrier, trigger });
  }
}

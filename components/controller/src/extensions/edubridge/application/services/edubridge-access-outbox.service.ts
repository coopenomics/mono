import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import {
  EduAccessCarrier,
  EduAccessState,
  EduAccessTaskKind,
  EduAccessTaskStatus,
  EduConnectorHealth,
  type EduRecipientType,
} from '../../domain/enums';
import type { AccessRequest, ConnectorResult } from '../../domain/connectors/access-carrier.connector';
import type { EdubridgeAccessTaskEntity, EdubridgeEnrollmentEntity } from '../../infrastructure/entities';
import { AccessCarrierRegistry } from '../../infrastructure/connectors/access-carrier.registry';
import { EdubridgeAccessTaskRepository } from '../../infrastructure/repositories/edubridge-access-task.repository';
import { EdubridgeConnectorBindingRepository } from '../../infrastructure/repositories/edubridge-connector-binding.repository';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeEnrollmentRepository } from '../../infrastructure/repositories/edubridge-enrollment.repository';
import { EdubridgeLearnerRepository } from '../../infrastructure/repositories/edubridge-learner.repository';
import {
  EDUBRIDGE_ACCESS_GRANTED_EVENT,
  EDUBRIDGE_ACCESS_NEEDS_ATTENTION_EVENT,
  EDUBRIDGE_ACCESS_REVOKED_EVENT,
} from '../events/edubridge.events';

/** Сколько попыток до «требует вмешательства». */
export const OUTBOX_MAX_ATTEMPTS = 10;
/** Размер пачки воркера. */
export const OUTBOX_BATCH = 20;

/** Задержка перед попыткой n (1-based): 1, 2, 4, 8 … минут, не больше 60. */
export function backoffMinutes(attempt: number): number {
  return Math.min(60, 2 ** Math.max(0, attempt - 1));
}

export interface EnqueueInput {
  coopname: string;
  enrollment: EdubridgeEnrollmentEntity;
  kind: EduAccessTaskKind;
  carrier: EduAccessCarrier;
  trigger: string;
  recipientOverride?: { type: EduRecipientType; value: string } | null;
}

/**
 * Outbox выдачи/отзыва доступа. Взнос принят и оформлен независимо от
 * площадки: задача лежит в таблице, переживает перезапуск, повторяется до
 * успеха, а после N неудач или фатального отказа становится «требует
 * вмешательства» — помеченным состоянием, не молчаливым отказом.
 */
@Injectable()
export class EdubridgeAccessOutboxService {
  constructor(
    private readonly tasks: EdubridgeAccessTaskRepository,
    private readonly enrollments: EdubridgeEnrollmentRepository,
    private readonly learners: EdubridgeLearnerRepository,
    private readonly courses: EdubridgeCourseRepository,
    private readonly bindings: EdubridgeConnectorBindingRepository,
    private readonly connectors: AccessCarrierRegistry,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly events: EventEmitter2
  ) {
    this.logger.setContext(EdubridgeAccessOutboxService.name);
  }

  async enqueue(input: EnqueueInput): Promise<EdubridgeAccessTaskEntity | null> {
    const task = await this.tasks.enqueue({
      coopname: input.coopname,
      enrollment_id: input.enrollment.id,
      kind: input.kind,
      carrier: input.carrier,
      trigger_trx: input.trigger,
      recipient_override: input.recipientOverride ?? null,
    });
    if (task) this.logger.info(`[EDU.OUTBOX] задача ${input.kind} для подписки ${input.enrollment.id} (${input.trigger})`);
    return task;
  }

  /** Один проход воркера: забрать срочные задачи и исполнить. */
  async processDue(coopname: string): Promise<number> {
    const batch = await this.tasks.claimDue(coopname, OUTBOX_BATCH);
    for (const task of batch) {
      try {
        await this.run(task);
      } catch (e) {
        await this.fail(task, { code: 'retryable', message: (e as Error)?.message ?? String(e) });
      }
    }
    return batch.length;
  }

  private async run(task: EdubridgeAccessTaskEntity): Promise<void> {
    const enrollment = await this.enrollments.findById(task.coopname, task.enrollment_id);
    if (!enrollment) return this.attention(task, 'Подписка не найдена');
    const [learner, course] = await Promise.all([
      this.learners.findById(task.coopname, enrollment.learner_id),
      this.courses.findById(task.coopname, enrollment.course_id),
    ]);
    if (!learner || !course) return this.attention(task, 'Обучающийся или курс не найдены');

    const connector = this.connectors.get(task.carrier);
    if (!connector) return this.attention(task, `Носитель доступа ${task.carrier} не поддерживается`);

    // Сверка карточки с площадкой до выдачи: переименован/удалён — не выдаём молча.
    if (task.kind === EduAccessTaskKind.GRANT && course.external_ref) {
      const check = await connector.check(task.coopname, course.external_ref);
      if (check.unavailable) return this.fail(task, { code: 'retryable', message: check.message ?? 'Площадка недоступна' });
      if (!check.found) return this.attention(task, check.message ?? 'Курс не найден на площадке', course.id);
      if (check.title && course.external_title_seen && check.title !== course.external_title_seen) {
        return this.attention(task, `Курс на площадке переименован: «${course.external_title_seen}» → «${check.title}»`, course.id);
      }
      if (check.title && !course.external_title_seen) {
        course.external_title_seen = check.title;
        await this.courses.save(course);
      }
    }

    const recipient = task.recipient_override ?? { type: learner.recipient_type, value: learner.recipient_value };
    const request: AccessRequest = {
      coopname: task.coopname,
      recipient: { type: recipient.type as EduRecipientType, value: recipient.value },
      course_ref: course.external_ref,
      enrollment_id: enrollment.id,
    };
    const result = task.kind === EduAccessTaskKind.GRANT ? await connector.grant(request) : await connector.revoke(request);
    await this.bindings.touch(task.coopname, task.carrier, result);

    if (result.code === 'ok' || result.code === 'exists') return this.done(task, enrollment, result);
    if (result.code === 'fatal') return this.attention(task, result.message ?? 'Отказ площадки', undefined, result.error_code);
    return this.fail(task, result);
  }

  private async done(task: EdubridgeAccessTaskEntity, enrollment: EdubridgeEnrollmentEntity, result: ConnectorResult): Promise<void> {
    task.status = EduAccessTaskStatus.DONE;
    task.attempts += 1;
    task.last_result = result.code;
    task.last_error = null;
    task.done_at = new Date();
    await this.tasks.save(task);

    if (!task.recipient_override) {
      // Переопределённый получатель — это отзыв старого адреса при смене контакта; состояние не трогаем.
      enrollment.access_state = task.kind === EduAccessTaskKind.GRANT ? EduAccessState.GRANTED : EduAccessState.REVOKED;
      await this.enrollments.save(enrollment);
    }
    this.events.emit(task.kind === EduAccessTaskKind.GRANT ? EDUBRIDGE_ACCESS_GRANTED_EVENT : EDUBRIDGE_ACCESS_REVOKED_EVENT, {
      coopname: task.coopname,
      enrollment_id: enrollment.id,
      member_username: enrollment.member_username,
      course_id: enrollment.course_id,
      learner_id: enrollment.learner_id,
    });
    this.logger.info(`[EDU.OUTBOX] ${task.kind} выполнен для подписки ${enrollment.id} (${result.code})`);
  }

  private async fail(task: EdubridgeAccessTaskEntity, result: ConnectorResult): Promise<void> {
    task.attempts += 1;
    task.last_result = result.code;
    task.last_error = result.message ?? null;
    if (task.attempts >= OUTBOX_MAX_ATTEMPTS) {
      return this.attention(task, `Исчерпаны попытки (${task.attempts}): ${result.message ?? ''}`.trim(), undefined, result.error_code, true);
    }
    task.status = EduAccessTaskStatus.PENDING;
    task.next_attempt_at = new Date(Date.now() + backoffMinutes(task.attempts) * 60_000);
    await this.tasks.save(task);
    this.logger.warn(`[EDU.OUTBOX] ${task.kind} для подписки ${task.enrollment_id}: попытка ${task.attempts} не удалась — ${result.message}; следующая через ${backoffMinutes(task.attempts)} мин`);
  }

  private async attention(task: EdubridgeAccessTaskEntity, reason: string, courseId?: string, errorCode?: string, counted = false): Promise<void> {
    task.status = EduAccessTaskStatus.NEEDS_ATTENTION;
    if (!counted) task.attempts += 1;
    task.last_result = errorCode ?? 'fatal';
    task.last_error = reason;
    await this.tasks.save(task);
    const enrollment = await this.enrollments.findById(task.coopname, task.enrollment_id);
    if (enrollment) {
      enrollment.access_state = EduAccessState.NEEDS_ATTENTION;
      await this.enrollments.save(enrollment);
    }
    if (errorCode === 'LICENSE_LIMIT') await this.bindings.setHealth(task.coopname, task.carrier, EduConnectorHealth.LICENSE_LIMIT, reason);
    this.events.emit(EDUBRIDGE_ACCESS_NEEDS_ATTENTION_EVENT, { coopname: task.coopname, task_id: task.id, enrollment_id: task.enrollment_id, course_id: courseId, reason });
    this.logger.error(`[EDU.OUTBOX] ${task.kind} для подписки ${task.enrollment_id} требует вмешательства: ${reason}`);
  }

  /** Ручной повтор из очереди администратора: задача снова pending, счётчик не сбрасываем. */
  async retry(coopname: string, taskId: string): Promise<EdubridgeAccessTaskEntity> {
    const task = await this.tasks.findById(coopname, taskId);
    if (!task) throw new Error('Задача не найдена');
    task.status = EduAccessTaskStatus.PENDING;
    task.next_attempt_at = new Date();
    task.last_error = null;
    return this.tasks.save(task);
  }
}

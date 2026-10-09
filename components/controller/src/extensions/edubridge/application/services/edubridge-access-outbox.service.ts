import { Inject, Injectable } from '@nestjs/common';
import { EdubridgeGroupService } from './edubridge-group.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import {
  EduAccessCarrier,
  EduAccessState,
  EduAccessTaskKind,
  EduAccessTaskStatus,
  EduConnectorHealth,
  EduEnrollmentStatus,
  type EduRecipientType,
} from '../../domain/enums';
import type { AccessCarrierConnector, AccessRequest, ConnectorResult, CourseCheckResult } from '../../domain/connectors/access-carrier.connector';
import type { EdubridgeAccessTaskRecord, EdubridgeCourseRecord, EdubridgeEnrollmentRecord, EdubridgeLearnerRecord } from '../../infrastructure/entities';
import { AccessCarrierRegistry } from '../../infrastructure/connectors/access-carrier.registry';
import { EdubridgeAccessTaskKyselyRepository } from '../../infrastructure/repositories/edubridge-access-task.kysely-repository';
import { EdubridgeConnectorBindingKyselyRepository } from '../../infrastructure/repositories/edubridge-connector-binding.kysely-repository';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeLearnerKyselyRepository } from '../../infrastructure/repositories/edubridge-learner.kysely-repository';
import {
  EDUBRIDGE_ACCESS_GRANTED_EVENT,
  EDUBRIDGE_ACCESS_NEEDS_ATTENTION_EVENT,
  EDUBRIDGE_ACCESS_REVOKED_EVENT,
} from '../events/edubridge.events';
import { t } from '../../i18n';
import { DomainError } from '@coopenomics/extension-kit';

/** Сколько попыток до «требует вмешательства». */
export const OUTBOX_MAX_ATTEMPTS = 10;
/** Размер пачки воркера. */
export const OUTBOX_BATCH = 20;
interface TaskContext {
  enrollment: EdubridgeEnrollmentRecord;
  learner: EdubridgeLearnerRecord;
  course: EdubridgeCourseRecord;
  connector: AccessCarrierConnector;
}

/** Чем сверка не сошлась: `retry` — площадка недоступна, иначе — курс не тот; `null` — всё сходится. */
function courseCheckProblem(check: CourseCheckResult, course: EdubridgeCourseRecord): { message: string; retry?: boolean } | null {
  if (check.unavailable) return { message: check.message ?? t('edubridge.accessOutbox.reason.platformUnavailable'), retry: true };
  if (!check.found) return { message: check.message ?? t('edubridge.accessOutbox.reason.courseNotFoundOnPlatform') };
  if (check.title && course.external_title_seen && check.title !== course.external_title_seen) {
    return { message: t('edubridge.accessOutbox.reason.courseRenamed', { seenTitle: course.external_title_seen, currentTitle: check.title }) };
  }
  return null;
}

/** Как долго верить сверке курса с площадкой. */
export const CHECK_TTL_MS = 60 * 60_000;

/** С чего отзыв площадки снимает получателя: курс площадки либо привязка как есть. */
function revokeScopeOf(connector: AccessCarrierConnector, courseRef: string | null | undefined): string {
  const ref = String(courseRef ?? '').trim();
  return connector.revokeScope ? connector.revokeScope(ref) : ref;
}

/** Задержка перед попыткой n (1-based): 1, 2, 4, 8 … минут, не больше 60. */
export function backoffMinutes(attempt: number): number {
  return Math.min(60, 2 ** Math.max(0, attempt - 1));
}

export interface EnqueueInput {
  coopname: string;
  enrollment: EdubridgeEnrollmentRecord;
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
    private readonly tasks: EdubridgeAccessTaskKyselyRepository,
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly learners: EdubridgeLearnerKyselyRepository,
    private readonly courses: EdubridgeCourseKyselyRepository,
    private readonly bindings: EdubridgeConnectorBindingKyselyRepository,
    private readonly connectors: AccessCarrierRegistry,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly events: EventEmitter2,
    private readonly groups: EdubridgeGroupService
  ) {
    this.logger.setContext(EdubridgeAccessOutboxService.name);
  }

  async enqueue(input: EnqueueInput): Promise<EdubridgeAccessTaskRecord | null> {
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

  private async run(task: EdubridgeAccessTaskRecord): Promise<void> {
    const ctx = await this.loadContext(task);
    if (!ctx) return;
    const { enrollment, learner, course, connector } = ctx;

    if (task.kind === EduAccessTaskKind.GRANT && !(await this.courseVerified(task, course, connector))) return;

    const recipient = task.recipient_override ?? { type: learner.recipient_type, value: learner.recipient_value };
    const request: AccessRequest = {
      coopname: task.coopname,
      recipient: { type: recipient.type as EduRecipientType, value: recipient.value },
      course_ref: course.external_ref,
      enrollment_id: enrollment.id,
    };
    // Доступ того же получателя к тому же курсу площадки оплачен другой подпиской — отзывать нечего.
    if (task.kind === EduAccessTaskKind.REVOKE && (await this.paidByAnotherSubscription(task, ctx, request))) {
      this.logger.info(`[EDU.OUTBOX] отзыв по подписке ${enrollment.id} не исполнен: доступ получателя к курсу площадки оплачен другой подпиской`);
      return this.done(task, enrollment, { code: 'exists', message: t('edubridge.accessOutbox.reason.paidByAnotherSubscription') });
    }
    const result = task.kind === EduAccessTaskKind.GRANT ? await connector.grant(request) : await connector.revoke(request);
    await this.bindings.touch(task.coopname, task.carrier, result);
    return this.settle(task, enrollment, result);
  }

  /**
   * Есть ли у того же получателя другая действующая подписка на тот же курс
   * площадки. Тогда отзыв снял бы оплаченный доступ: ученик перешёл в другую
   * группу курса, два курса кооператива привязаны к одному курсу площадки либо
   * одного обучающегося записали двое пайщиков.
   */
  private async paidByAnotherSubscription(task: EdubridgeAccessTaskRecord, ctx: TaskContext, request: AccessRequest): Promise<boolean> {
    const scope = revokeScopeOf(ctx.connector, request.course_ref);
    if (!scope) return false;
    for (const learner of await this.learners.findByRecipient(task.coopname, request.recipient.type, request.recipient.value)) {
      const others = (await this.enrollments.findByLearner(task.coopname, learner.id)).filter((e) => e.id !== ctx.enrollment.id && e.status === EduEnrollmentStatus.ACTIVE);
      for (const other of others) {
        if (await this.grantsSameScope(task, ctx.connector, other, scope)) return true;
      }
    }
    return false;
  }

  /** Подписка даёт доступ к тому же курсу той же площадки. */
  private async grantsSameScope(task: EdubridgeAccessTaskRecord, connector: AccessCarrierConnector, other: EdubridgeEnrollmentRecord, scope: string): Promise<boolean> {
    const course = await this.groups.courseOf(task.coopname, other.course_id, other.group_id);
    return Boolean(course) && course?.carrier === task.carrier && revokeScopeOf(connector, course.external_ref) === scope;
  }

  /** Исход площадки → состояние задачи: успех/«уже есть» — done, отказ — вмешательство, остальное — повтор. */
  private settle(task: EdubridgeAccessTaskRecord, enrollment: EdubridgeEnrollmentRecord, result: ConnectorResult): Promise<void> {
    if (result.code === 'ok' || result.code === 'exists') return this.done(task, enrollment, result);
    if (result.code === 'fatal') return this.attention(task, result.message ?? t('edubridge.accessOutbox.reason.platformRejected'), undefined, result.error_code);
    return this.fail(task, result);
  }

  /** Подписка, обучающийся, курс и коннектор задачи; `null` — задача уже переведена в «требует вмешательства». */
  private async loadContext(task: EdubridgeAccessTaskRecord): Promise<TaskContext | null> {
    const enrollment = await this.enrollments.findById(task.coopname, task.enrollment_id);
    if (!enrollment) {
      await this.attention(task, t('edubridge.accessOutbox.reason.subscriptionNotFound'));
      return null;
    }
    const [learner, course] = await Promise.all([
      this.learners.findById(task.coopname, enrollment.learner_id),
      // Доступ выдаётся в группу площадки, привязанную к группе подписки.
      this.groups.courseOf(task.coopname, enrollment.course_id, enrollment.group_id),
    ]);
    if (!learner || !course) {
      await this.attention(task, t('edubridge.accessOutbox.reason.learnerOrCourseNotFound'));
      return null;
    }
    const connector = this.connectors.get(task.carrier);
    if (!connector) {
      await this.attention(task, t('edubridge.accessOutbox.reason.carrierUnsupported', { carrier: task.carrier }));
      return null;
    }
    return { enrollment, learner, course, connector };
  }

  /**
   * Сверка карточки с площадкой до выдачи: переименован/удалён — не выдаём молча.
   * Не чаще раза в CHECK_TTL_MS на курс: экспорт-API площадок лимитирован.
   * `false` — задача уже отложена или переведена в «требует вмешательства».
   */
  private async courseVerified(task: EdubridgeAccessTaskRecord, course: EdubridgeCourseRecord, connector: AccessCarrierConnector): Promise<boolean> {
    const checkedRecently = course.external_checked_at && Date.now() - course.external_checked_at.getTime() < CHECK_TTL_MS;
    if (!course.external_ref || checkedRecently) return true;

    const check = await connector.check(task.coopname, course.external_ref);
    const problem = courseCheckProblem(check, course);
    if (problem?.retry) {
      await this.fail(task, { code: 'retryable', message: problem.message });
      return false;
    }
    if (problem) {
      await this.attention(task, problem.message, course.id);
      return false;
    }
    if (check.title && !course.external_title_seen) course.external_title_seen = check.title;
    course.external_checked_at = new Date();
    await this.courses.save(course);
    return true;
  }

  /** Доступ выдан заново — аккаунт на площадке снова есть: отметка администратора «удалён с площадки» снимается. */
  private async clearRemovedMark(coopname: string, learnerId: string): Promise<void> {
    const learner = await this.learners.findById(coopname, learnerId);
    if (!learner?.platform_removed_at) return;
    learner.platform_removed_at = null;
    await this.learners.save(learner);
  }

  private async done(task: EdubridgeAccessTaskRecord, enrollment: EdubridgeEnrollmentRecord, result: ConnectorResult): Promise<void> {
    task.status = EduAccessTaskStatus.DONE;
    task.attempts += 1;
    task.last_result = result.code;
    task.last_error = null;
    task.done_at = new Date();
    await this.tasks.save(task);

    if (task.kind === EduAccessTaskKind.GRANT) await this.clearRemovedMark(task.coopname, enrollment.learner_id);
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

  private async fail(task: EdubridgeAccessTaskRecord, result: ConnectorResult): Promise<void> {
    task.attempts += 1;
    task.last_result = result.code;
    task.last_error = result.message ?? null;
    if (task.attempts >= OUTBOX_MAX_ATTEMPTS) {
      return this.attention(task, t('edubridge.accessOutbox.reason.attemptsExhausted', { attempts: task.attempts, message: result.message ?? '' }).trim(), undefined, result.error_code, true);
    }
    task.status = EduAccessTaskStatus.PENDING;
    task.next_attempt_at = new Date(Date.now() + backoffMinutes(task.attempts) * 60_000);
    await this.tasks.save(task);
    this.logger.warn(`[EDU.OUTBOX] ${task.kind} для подписки ${task.enrollment_id}: попытка ${task.attempts} не удалась — ${result.message}; следующая через ${backoffMinutes(task.attempts)} мин`);
  }

  private async attention(task: EdubridgeAccessTaskRecord, reason: string, courseId?: string, errorCode?: string, counted = false): Promise<void> {
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
  async retry(coopname: string, taskId: string): Promise<EdubridgeAccessTaskRecord> {
    const task = await this.tasks.findById(coopname, taskId);
    if (!task) throw DomainError.internal('EDUBRIDGE_ACCESS_TASK_NOT_FOUND');
    task.status = EduAccessTaskStatus.PENDING;
    task.next_attempt_at = new Date();
    task.last_error = null;
    return this.tasks.save(task);
  }
}

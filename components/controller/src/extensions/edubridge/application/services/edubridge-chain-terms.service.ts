import { normalizeSlots, programOf, slotLessonCost } from '../../domain/lib/schedule';
import { guaranteeSeconds } from '../../domain/economy/guarantee';
import { eduMonthSeconds } from '../../domain/economy/time-scale';
import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import type { EdubridgeCourseRecord, EdubridgeTeacherAssignmentRecord } from '../../infrastructure/entities';

const ASSET_SCALE = 10_000;
const MINUTES_IN_HOUR = 60;
/** Нулевое время цепи: курс не активирован. */
const CHAIN_EPOCH = '1970-01-01T00:00:00';

/**
 * Условия, по которым контракт считает деньги: условия курса и ставка
 * преподавателя на курсе. Приложение их задаёт, суммы по ним считает контракт.
 */
@Injectable()
export class EdubridgeChainTermsService {
  constructor(
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeChainTermsService.name);
  }

  /**
   * Условия курса в цепь. Отказ контракта возвращается как есть: при
   * действующих подписках он не даёт менять ставку, взнос и расписание.
   */
  async pushCourse(course: EdubridgeCourseRecord): Promise<void> {
    await this.chain.setCourse({
      coopname: course.coopname,
      course_id: Number(course.chain_ref),
      per_learner: Boolean(course.pay_per_learner),
      target_fee_month: targetFeeMonth(course),
      minutes_per_month: Number(course.minutes_per_month),
      minutes_total: Number(course.minutes_total),
      // Окна в том же порядке, в каком их держит запись: занятие называет окно индексом.
      slots: normalizeSlots(course.schedule_slots ?? []).map((s) => ({ minutes: s.minutes, cost: slotLessonCost(s) })),
      course_payment: Boolean(course.course_payment_enabled),
      discount_bp: Number(course.course_discount_bp ?? 0),
      guarantee_secs: guaranteeSeconds(course),
      starts_at: course.starts_at ? toChainTime(new Date(course.starts_at)) : CHAIN_EPOCH,
      // Длина месяца: в работе 0 — календарные месяцы; на стенде со сжатым временем — секунды.
      month_secs: eduMonthSeconds(),
    });
  }

  /** То же без отказа наружу — для сверки при запуске: курс с прежними подписками условия не меняет. */
  async tryPushCourse(course: EdubridgeCourseRecord): Promise<boolean> {
    try {
      await this.pushCourse(course);
      return true;
    } catch (e) {
      this.logger.warn(`Условия курса «${course.title}» в цепь не записаны: ${(e as Error)?.message ?? e}`);
      return false;
    }
  }

  /** Допуск преподавателя и его ставка на курсе — в цепь. */
  async pushAssignment(assignment: EdubridgeTeacherAssignmentRecord, course: EdubridgeCourseRecord): Promise<void> {
    await this.chain.setAssignment({
      coopname: assignment.coopname,
      assignment_id: chainAssignmentRef(assignment, course),
      username: assignment.teacher_username,
      course_id: Number(course.chain_ref),
      rate: assignment.hourly_rate,
    });
  }

  /**
   * То же без отказа наружу: договор преподавателя может ещё ожидать подписи
   * председателя, и допуск в цепи появится перед первым занятием.
   */
  async tryPushAssignment(assignment: EdubridgeTeacherAssignmentRecord, course: EdubridgeCourseRecord): Promise<void> {
    try {
      await this.pushAssignment(assignment, course);
    } catch (e) {
      this.logger.warn(`Допуск ${assignment.teacher_username} к курсу «${course.title}» в цепь не записан: ${(e as Error)?.message ?? e}`);
    }
  }

  /** Допуск снят: запись в цепи по этой группе стирается; её может и не быть. */
  async dropAssignment(assignment: EdubridgeTeacherAssignmentRecord, course: EdubridgeCourseRecord): Promise<void> {
    try {
      await this.chain.removeAssignment({ coopname: assignment.coopname, assignment_id: chainAssignmentRef(assignment, course) });
    } catch (e) {
      this.logger.warn(`Допуск ${assignment.teacher_username} в цепи не снят: ${(e as Error)?.message ?? e}`);
    }
  }
}

/** Разряд, которым номер группы отделён от номера допуска в номере для цепи. */
const ASSIGNMENT_REF_BASE = 1_000_000;

/**
 * Номер допуска в цепи. Допуск преподавателя выдаётся на курс, а расчёт
 * занятий идёт по группам, поэтому в цепи у допуска своя запись на каждую
 * группу: номер группы и номер допуска вместе. `course` — курс глазами группы.
 */
export function chainAssignmentRef(assignment: Pick<EdubridgeTeacherAssignmentRecord, 'chain_ref'>, course: Pick<EdubridgeCourseRecord, 'chain_ref'>): number {
  return Number(course.chain_ref) * ASSIGNMENT_REF_BASE + Number(assignment.chain_ref);
}

/**
 * Целевой членский взнос за месяц — месячный взнос курса без оплаты занятий
 * по плановой ставке. Оплата занятия считается так же, как в контракте
 * (`edu_terms::lesson_unit`): ставка за минуты занятия, нацело.
 */
export function targetFeeMonth(course: Pick<EdubridgeCourseRecord, 'fee_month' | 'schedule_slots' | 'program_months'>): string {
  const [feeRaw, symbol = ''] = String(course.fee_month ?? '').trim().split(' ');
  const fee = Math.round((Number.parseFloat(feeRaw) || 0) * ASSET_SCALE);
  const teach = Math.round((Number.parseFloat(programOf(course.schedule_slots ?? [], course.program_months ?? 0).teach_month) || 0) * ASSET_SCALE);
  const target = Math.max(0, fee - teach);
  return `${(target / ASSET_SCALE).toFixed(4)} ${symbol}`.trim();
}

/** Время цепи — без миллисекунд и зоны. */
export function toChainTime(date: Date): string {
  return new Date(Math.floor(date.getTime() / 1000) * 1000).toISOString().slice(0, 19);
}

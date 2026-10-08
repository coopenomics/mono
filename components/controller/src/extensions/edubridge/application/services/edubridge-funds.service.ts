import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { isEntryGuaranteeRunning } from '../../domain/economy/guarantee';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import type { EdubridgeCourseRecord, EdubridgeEnrollmentRecord } from '../../infrastructure/entities';
import { EdubridgeCourseKyselyRepository } from '../../infrastructure/repositories/edubridge-course.kysely-repository';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';

/**
 * Средства программы между удержанием, резервом преподавателям и кошельком
 * программы. Все суммы считает контракт; служба вызывает его действия по
 * одной подписке и переносит прочитанное из цепи в записи приложения.
 *
 * Пока идёт гарантийный срок участника, взнос удержан целиком. После срока
 * контракт выделяет оплату занятий в резерв преподавателям и оставляет
 * удержанной сумму возможного возврата; она уменьшается с каждым проведённым
 * занятием.
 */
@Injectable()
export class EdubridgeFundsService {
  constructor(
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly courses: EdubridgeCourseKyselyRepository,
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeFundsService.name);
  }

  /** Подписки с удержанным взносом — все либо одного курса. */
  private async lockedEnrollments(coopname: string, onlyCourseId?: string): Promise<EdubridgeEnrollmentRecord[]> {
    const locked = await this.enrollments.findLocked(coopname);
    return onlyCourseId ? locked.filter((e) => e.course_id === onlyCourseId) : locked;
  }

  /**
   * Проход очереди — раз в десять минут — и вызов по курсу перед приёмом
   * результата преподавателя. По каждой подписке, у которой гарантийный срок
   * участника истёк, вызывается `unlockfee`: контракт закрывает срок, выделяет
   * оплату занятий в резерв и освобождает удержанное сверх возможного
   * возврата. Удержанное в записи приложения сверяется с цепью. Ошибка по
   * одной подписке остальные не держит.
   */
  async unlockDue(coopname: string, now = new Date(), onlyCourseId?: string): Promise<number> {
    let closed = 0;
    const touched = new Set<string>();
    for (const enrollment of await this.lockedEnrollments(coopname, onlyCourseId)) {
      const course = await this.courses.findById(coopname, enrollment.course_id);
      if (!course) continue;
      try {
        if (await this.closeGuarantee(coopname, enrollment, course, now)) closed += 1;
        touched.add(course.id);
      } catch (e) {
        this.logger.error(`[EDU.FUNDS] гарантийный срок по подписке ${enrollment.id}: ${(e as Error)?.message ?? e}`);
      }
    }
    for (const courseId of touched) await this.syncCourse(coopname, courseId);
    if (closed) this.logger.info(`[EDU.FUNDS] закрыт гарантийный срок по подпискам: ${closed}`);
    return closed;
  }

  /** Один вызов контракта по одной подписке и сверка удержанного с цепью. */
  private async closeGuarantee(coopname: string, enrollment: EdubridgeEnrollmentRecord, course: EdubridgeCourseRecord, now: Date): Promise<boolean> {
    let sub = await this.chain.readSubscription(coopname, enrollment.sub_hash);
    // Строки нет либо она открыта до учёта занятий — освобождать по ней контракту нечего.
    if (!sub?.plan || Number(sub.plan.version) !== 1) return false;
    let closed = false;
    if (!sub.plan.released && !isEntryGuaranteeRunning(course, enrollment, now)) {
      await this.chain.unlockFee({ coopname, sub_hash: enrollment.sub_hash });
      sub = await this.chain.readSubscription(coopname, enrollment.sub_hash);
      closed = true;
    }
    const locked = Number.parseFloat(sub?.locked ?? '0') > 0 ? (sub?.locked as string) : null;
    if (locked !== enrollment.locked_amount) {
      enrollment.locked_amount = locked;
      await this.enrollments.save(enrollment);
    }
    return closed;
  }

  /** Подписка закрыта либо отменена: остаток по ней контракт разнёс сам, запись курса сверяется с цепью. */
  async afterClosed(coopname: string, enrollment: EdubridgeEnrollmentRecord): Promise<void> {
    enrollment.locked_amount = null;
    await this.syncCourse(coopname, enrollment.course_id);
  }

  /** Результат преподавателя принят: контракт списал резерв курса, запись курса сверяется с цепью. */
  async onSettled(coopname: string, courseId: string): Promise<void> {
    await this.syncCourse(coopname, courseId);
  }

  /** Резерв преподавателям и выплаченное по курсу — из учёта курса в цепи. Сбой чтения запись не трогает. */
  async syncCourse(coopname: string, courseId: string): Promise<void> {
    const course = await this.courses.findById(coopname, courseId);
    if (!course) return;
    try {
      const funds = await this.chain.readCourseFunds(coopname, course.chain_ref);
      if (!funds) return;
      if (course.teacher_reserve_balance === funds.reserve && course.teacher_settled_total === funds.settled) return;
      course.teacher_reserve_balance = funds.reserve;
      course.teacher_settled_total = funds.settled;
      // Подгруженные связи перебили бы section_id/level_id при сохранении.
      course.section = undefined;
      course.level = undefined;
      await this.courses.save(course);
    } catch (e) {
      this.logger.warn(`[EDU.FUNDS] учёт курса ${courseId} не прочитан из цепи: ${(e as Error)?.message ?? e}`);
    }
  }
}

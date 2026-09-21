import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { EduEnrollmentStatus } from '../../domain/enums';
import { costOfHours, courseMonths } from '../../domain/economy/course-fee.calculator';
import { isGuaranteeRunning } from '../../domain/economy/guarantee';
import { reserveTarget, type ReserveCoverage, type ReserveTarget } from '../../domain/economy/teacher-reserve.calculator';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import type { EdubridgeCourseEntity, EdubridgeEnrollmentEntity } from '../../infrastructure/entities';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeEnrollmentRepository } from '../../infrastructure/repositories/edubridge-enrollment.repository';
import { refundOf } from './edubridge-refund';

const MINUTES_IN_HOUR = 60;
/** Знаков после запятой в сумме цепи — четыре. */
const ASSET_SCALE = 10_000;

/**
 * Средства программы между удержанием, резервом преподавателям и фондом. Два
 * правила, на которых держится всё остальное.
 *
 * Удержано не меньше того, что участник может потребовать назад прямо сейчас.
 * Пока идёт гарантийный срок курса — это весь взнос; после него — сумма
 * возврата по Положению, которая тает с каждым проведённым занятием. Поэтому
 * возврат всегда обеспечен деньгами, а фонд можно тратить на расходы без
 * оглядки: в нём лежит только то, что вернуть уже нельзя.
 *
 * Резерв преподавателям наполняется до обязательства перед ними за оплаченное
 * время курса, и не больше. Всё сверх него остаётся в фонде, поэтому на
 * групповом курсе излишка в резерве не возникает.
 */
@Injectable()
export class EdubridgeFundsService {
  constructor(
    private readonly enrollments: EdubridgeEnrollmentRepository,
    private readonly courses: EdubridgeCourseRepository,
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeFundsService.name);
  }

  /** Сколько по подписке должно оставаться удержанным на этот момент. */
  requiredLock(enrollment: EdubridgeEnrollmentEntity, course: EdubridgeCourseEntity, now = new Date()): number {
    const locked = toNumber(enrollment.locked_amount);
    if (isGuaranteeRunning(course, now)) return locked;
    return Math.min(locked, toNumber(refundOf(enrollment, course, false, now).refund));
  }

  /**
   * Проход очереди: у действующих подписок освобождается удержанное сверх
   * возвратной суммы. Освобождённое уходит в фонд, из него резерв преподавателям
   * добирается до обязательства по курсу. Ошибка по одной подписке остальные не держит.
   */
  async unlockDue(coopname: string, now = new Date()): Promise<number> {
    let unlocked = 0;
    for (const enrollment of await this.enrollments.findLocked(coopname)) {
      const course = await this.courses.findById(coopname, enrollment.course_id);
      if (!course) continue;
      const locked = toNumber(enrollment.locked_amount);
      const excess = floor4(locked - this.requiredLock(enrollment, course, now));
      if (!(excess > 0)) continue;
      try {
        const symbol = symbolOf(enrollment.locked_amount);
        const allot = Math.min(excess, toNumber((await this.target(coopname, course)).gap));
        await this.chain.unlockFee({ coopname, sub_hash: enrollment.sub_hash, amount: asset(excess, symbol), allot: allot > 0 ? asset(allot, symbol) : undefined });
        const rest = floor4(locked - excess);
        enrollment.locked_amount = rest > 0 ? asset(rest, symbol) : null;
        await this.enrollments.save(enrollment);
        await this.moveReserve(course, allot, symbol);
        unlocked += 1;
      } catch (e) {
        this.logger.error(`[EDU.FUNDS] разблокировка взноса по подписке ${enrollment.id}: ${(e as Error)?.message ?? e}`);
      }
    }
    if (unlocked) this.logger.info(`[EDU.FUNDS] освобождено удержанное по подпискам: ${unlocked}`);
    return unlocked;
  }

  /**
   * Подписка закрыта либо отменена: цепь вернула удержанное в фонд сама. Резерв
   * преподавателям по курсу выравнивается под новое оплаченное время — добирается
   * из фонда либо возвращает в него лишнее. Сбой закрытие не отменяет: очередь
   * выровняет резерв на следующем проходе.
   */
  async afterClosed(coopname: string, enrollment: EdubridgeEnrollmentEntity): Promise<void> {
    const released = toNumber(enrollment.locked_amount);
    const symbol = symbolOf(enrollment.locked_amount);
    enrollment.locked_amount = null;
    const course = await this.courses.findById(coopname, enrollment.course_id);
    if (!course) return;
    try {
      await this.rebalance(coopname, course, enrollment.sub_hash, { allotUpTo: released, symbol });
    } catch (e) {
      this.logger.error(`[EDU.FUNDS] резерв преподавателям по курсу ${course.id} не выровнен: ${(e as Error)?.message ?? e}`);
    }
  }

  /** Результат преподавателя принят: цепь списала резерв, обязательство по курсу уменьшилось. */
  async onSettled(coopname: string, courseId: string, amount: string): Promise<void> {
    const course = await this.courses.findById(coopname, courseId);
    if (!course) return;
    const symbol = symbolOf(amount);
    course.teacher_settled_total = asset(toNumber(course.teacher_settled_total) + toNumber(amount), symbol);
    course.teacher_reserve_balance = asset(Math.max(0, toNumber(course.teacher_reserve_balance) - toNumber(amount)), symbol);
    await this.courses.save(course);
  }

  /** Обязательство перед преподавателями курса против того, что лежит в резерве. */
  async target(coopname: string, course: EdubridgeCourseEntity): Promise<ReserveTarget> {
    const coverage = (await this.enrollments.findByCourse(coopname, course.id)).map(coverageOf).filter((c): c is ReserveCoverage => c !== null);
    const hoursPerMonth = (course.lessons_per_month * course.lesson_minutes) / MINUTES_IN_HOUR;
    return reserveTarget(
      {
        cost_month: costOfHours(course.planned_hourly_rate, hoursPerMonth),
        course_months: courseMonths(course.lessons_per_month, course.lessons_total),
        starts_at: course.starts_at ? new Date(course.starts_at) : null,
      },
      coverage,
      { balance: course.teacher_reserve_balance ?? '', settled: course.teacher_settled_total ?? '' }
    );
  }

  private async rebalance(
    coopname: string,
    course: EdubridgeCourseEntity,
    subHash: string,
    opts: { allotUpTo: number; symbol: string }
  ): Promise<void> {
    const target = await this.target(coopname, course);
    const symbol = opts.symbol || symbolOf(target.obligation);
    const surplus = toNumber(target.surplus);
    if (surplus > 0) {
      await this.chain.freeReserve({ coopname, sub_hash: subHash, amount: asset(surplus, symbol) });
      await this.moveReserve(course, -surplus, symbol);
      return;
    }
    const allot = Math.min(opts.allotUpTo, toNumber(target.gap));
    if (allot > 0) {
      await this.chain.allotReserve({ coopname, sub_hash: subHash, amount: asset(allot, symbol) });
      await this.moveReserve(course, allot, symbol);
    }
  }

  private async moveReserve(course: EdubridgeCourseEntity, delta: number, symbol: string): Promise<void> {
    if (!delta) return;
    course.teacher_reserve_balance = asset(Math.max(0, toNumber(course.teacher_reserve_balance) + delta), symbol);
    await this.courses.save(course);
  }
}

/** Оплаченное учеником время курса; подписка без срока оплаты в расчёт не идёт. */
function coverageOf(e: EdubridgeEnrollmentEntity): ReserveCoverage | null {
  if (!e.paid_until) return null;
  // Отменённая подписка оплатила курс только до дня отмены: дальше занятий для неё нет.
  const until = e.status === EduEnrollmentStatus.CANCELLED && e.cancelled_at ? new Date(e.cancelled_at) : new Date(e.paid_until);
  return { from: new Date(e.created_at), until };
}

function toNumber(value: string | null | undefined): number {
  return Number.parseFloat(String(value ?? '0')) || 0;
}

function symbolOf(value: string | null | undefined): string {
  return String(value ?? '').trim().split(' ')[1] ?? '';
}

function floor4(value: number): number {
  return Math.floor(Math.round(value * ASSET_SCALE * 10) / 10) / ASSET_SCALE;
}

function asset(value: number, symbol: string): string {
  return `${value.toFixed(4)} ${symbol}`.trim();
}

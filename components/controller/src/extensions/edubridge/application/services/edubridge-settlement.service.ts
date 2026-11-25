import { Inject, Injectable } from '@nestjs/common';
import { chainErrorCode, DomainError } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import type { EdubridgeEnrollmentRecord, EdubridgeGroupRecord } from '../../infrastructure/entities';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeGroupKyselyRepository } from '../../infrastructure/repositories/edubridge-group.kysely-repository';
import { EdubridgeFundsService } from './edubridge-funds.service';
import { EdubridgeLessonKyselyRepository } from '../../infrastructure/repositories/edubridge-lesson.kysely-repository';
import { EdubridgeTeacherKyselyRepository } from '../../infrastructure/repositories/edubridge-teacher.kysely-repository';
import { lessonReportInProcess } from '../../domain/lib/report-in-process';

/** Код отказа контракта: подписки с таким hash в цепи нет. */
const SUBSCRIPTION_GONE = 'EDUBRIDGE_SUBSCRIPTION_NOT_FOUND';

/**
 * Закрытие расчётов по подпискам с вышедшим оплаченным сроком. Доступ по такой
 * подписке отозван, а в цепи она живёт: преподаватель отчитывается о занятиях
 * её оплаченного срока и получает за них взнос. Срока на отчёт нет. Подписка
 * закрывается в цепи в двух случаях:
 *
 *  - преподаватель отчитался обо всех занятиях программы группы и процесс
 *    отчёта по каждому завершён (совет решил, окно повторной подачи после
 *    отказа вышло) — закрывает очередь;
 *  - администратор завершил группу — когда отчётов больше не будет.
 *
 * При закрытии резерв за занятия без отчёта уходит на кошелёк программы.
 */
@Injectable()
export class EdubridgeSettlementService {
  constructor(
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly groups: EdubridgeGroupKyselyRepository,
    private readonly funds: EdubridgeFundsService,
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly lessons: EdubridgeLessonKyselyRepository,
    private readonly teachers: EdubridgeTeacherKyselyRepository
  ) {
    this.logger.setContext(EdubridgeSettlementService.name);
  }

  /** Сколько подписок группы ждут закрытия расчётов. */
  async pendingCount(coopname: string, groupId: string): Promise<number> {
    return (await this.enrollments.findSettlementPending(coopname)).filter((e) => e.group_id === groupId).length;
  }

  /** Очередь: группы, по которым отчитаны все занятия программы, — их подписки закрываются сами. */
  async closeReported(coopname: string): Promise<number> {
    const byGroup = new Map<string, EdubridgeEnrollmentRecord[]>();
    for (const e of await this.enrollments.findSettlementPending(coopname)) {
      if (e.group_id) byGroup.set(e.group_id, [...(byGroup.get(e.group_id) ?? []), e]);
    }
    let closed = 0;
    for (const [groupId, pending] of byGroup) {
      const group = await this.groups.findById(coopname, groupId);
      if (!group || !(await this.fullyReported(coopname, group))) continue;
      const done = await this.closeAll(coopname, pending);
      if (done) this.logger.info(`[EDU.SETTLE] группа «${group.title}»: отчитаны все занятия программы, закрыто подписок: ${done}`);
      closed += done;
    }
    return closed;
  }

  /** Администратор завершает группу: расчёты по её истёкшим подпискам закрываются, отчётов по их занятиям больше не будет. */
  async closeGroup(coopname: string, groupId: string): Promise<number> {
    const group = await this.groups.findById(coopname, groupId);
    if (!group) throw DomainError.notFound('EDUBRIDGE_GROUP_NOT_FOUND');
    const pending = (await this.enrollments.findSettlementPending(coopname)).filter((e) => e.group_id === groupId);
    if (!pending.length) return 0;
    const closed = await this.closeAll(coopname, pending);
    this.logger.info(`[EDU.SETTLE] группу «${group.title}» завершает администратор, закрыто подписок: ${closed} из ${pending.length}`);
    // Часть подписок не закрылась — по группе идёт расчёт открытого занятия: администратор повторит позже.
    if (closed < pending.length) throw DomainError.badRequest('EDUBRIDGE_GROUP_SETTLEMENT_LESSON_PENDING');
    return closed;
  }

  /**
   * Программа группы отчитана целиком: минут занятий в цепи столько, сколько
   * в программе, окон расчёта нет и процесс отчёта по каждому занятию
   * завершён. Отчёт на рассмотрении совета либо отклонённый, но ещё
   * подаваемый повторно, держит подписки живыми: по ним вернётся оплата
   * занятия и пройдёт расчёт повторного отчёта.
   */
  private async fullyReported(coopname: string, group: EdubridgeGroupRecord): Promise<boolean> {
    if (!(group.minutes_total > 0)) return false;
    const terms = await this.chain.readTerms(coopname, group.chain_ref).catch(() => null);
    if (!terms || Number(terms.minutes_opened) < group.minutes_total || Number(terms.charging ?? 0) !== 0) return false;
    return !(await this.reportsInProcess(coopname, group));
  }

  /** По занятию группы процесс отчёта ещё идёт (см. lessonReportInProcess). */
  private async reportsInProcess(coopname: string, group: EdubridgeGroupRecord): Promise<boolean> {
    const now = new Date();
    for (const lesson of await this.lessons.findByGroup(coopname, group.id)) {
      const contribution = lesson.contribution_id ? await this.teachers.findContribution(coopname, lesson.contribution_id) : null;
      if (lessonReportInProcess(lesson, contribution, group.report_days, now)) return true;
    }
    return false;
  }

  private async closeAll(coopname: string, pending: EdubridgeEnrollmentRecord[]): Promise<number> {
    let closed = 0;
    for (const enrollment of pending) {
      try {
        await this.closeInChain(coopname, enrollment.sub_hash);
        enrollment.chain_close_after = null;
        await this.funds.afterClosed(coopname, enrollment);
        await this.enrollments.save(enrollment);
        closed += 1;
      } catch (e) {
        // Расчёт по открытому занятию ещё идёт — закрытие повторится.
        this.logger.warn(`[EDU.SETTLE] expiresub ${enrollment.sub_hash}: ${(e as Error)?.message ?? e}`);
      }
    }
    return closed;
  }

  /** `expiresub` в цепь; записи там может уже не быть — тогда закрывать нечего. */
  private async closeInChain(coopname: string, subHash: string): Promise<void> {
    try {
      await this.chain.expireSubscription({ coopname, sub_hash: subHash });
    } catch (e) {
      if (chainErrorCode(e) !== SUBSCRIPTION_GONE) throw e;
    }
  }
}

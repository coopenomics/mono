import { Injectable } from '@nestjs/common';
import type { InnerExitBlockersProvider, InnerExitPendingReturn } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { EduAssignmentStatus, EduContributionStatus } from '../../domain/enums';
import { EdubridgeTeacherRepository } from '../../infrastructure/repositories/edubridge-teacher.repository';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeEnrollmentService } from './edubridge-enrollment.service';
import { t } from '../../i18n';

/** Кошелёк членских взносов программы — на него ложится возврат по подпискам. */
const MEMBER_WALLET = 'w.edu.member';

/**
 * Выход из кооператива глазами программы «Образование».
 *
 * У родителя-слушателя препятствий нет: его подписки закрываются с возвратом,
 * а остаток кошелька программы возвращается вместе с паевым взносом — этот
 * возврат попадает в заявление об аннулировании соглашений (190). У
 * преподавателя иначе — он ведёт курсы и получает взносы за проведённые
 * занятия, и эти обязательства кооператив должен закрыть до выхода.
 */
@Injectable()
export class EdubridgeExitBlockersService implements InnerExitBlockersProvider {
  readonly extension_name = EDUBRIDGE_EXTENSION_NAME;

  constructor(
    private readonly teachers: EdubridgeTeacherRepository,
    private readonly courses: EdubridgeCourseRepository,
    private readonly enrollments: EdubridgeEnrollmentService
  ) {}

  /** Возврат по действующим подпискам: выход закроет их по Положению, и деньги лягут на кошелёк программы. */
  async pendingReturns(coopname: string, username: string): Promise<InnerExitPendingReturn[]> {
    const { subscriptions, refunds } = await this.enrollments.refundsOnExit(coopname, username);
    if (!(subscriptions > 0 && refunds > 0)) return [];
    return [
      {
        wallet_name: MEMBER_WALLET,
        human_name: t('edubridge.exitBlockers.pendingReturnName', { subscriptions }),
        amount: `${refunds.toFixed(4)} ${platformSettings().blockchain.rootGovernSymbol}`,
      },
    ];
  }

  async blockers(coopname: string, username: string): Promise<string[]> {
    const reasons: string[] = [];

    const assignments = (await this.teachers.listAssignments(coopname, { teacher: username })).filter(
      (a) => a.status === EduAssignmentStatus.ACTIVE || a.status === EduAssignmentStatus.PENDING_APPROVAL
    );
    for (const assignment of assignments) {
      const course = await this.courses.findById(coopname, assignment.course_id);
      const title = course?.title ?? t('edubridge.exitBlockers.courseFallbackTitle');
      reasons.push(t('edubridge.exitBlockers.teachingCourse', { title }));
    }

    // Заявление на удержании ещё может быть снято рекламацией, а поданное —
    // ждёт решения совета: в обоих случаях расчёт с преподавателем не закрыт.
    const pending = await this.teachers.listContributions(coopname, {
      teacher: username,
      statuses: [
        EduContributionStatus.HELD,
        EduContributionStatus.SUBMITTED,
        EduContributionStatus.COUNCIL_APPROVED,
        EduContributionStatus.ACT_SIGNED,
      ],
    });
    // Материалы на хранении без подписанного заявления сами никуда не уйдут:
    // здесь ждать нечего, нужно действие преподавателя.
    const unsigned = pending.filter((c) => c.status === EduContributionStatus.HELD && !c.statement_document);
    if (unsigned.length > 0) {
      reasons.push(
        t('edubridge.exitBlockers.unsignedStatements', { count: unsigned.length })
      );
    }
    const inWork = pending.length - unsigned.length;
    if (inWork > 0) {
      reasons.push(t('edubridge.exitBlockers.statementsInWork', { count: inWork }));
    }

    return reasons;
  }
}

import { Injectable } from '@nestjs/common';
import type { InnerExitBlockersProvider } from '@coopenomics/innercoop';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { EduAssignmentStatus, EduContributionStatus } from '../../domain/enums';
import { EdubridgeTeacherRepository } from '../../infrastructure/repositories/edubridge-teacher.repository';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';

/**
 * Почему преподавателю рано выходить из кооператива.
 *
 * У родителя-слушателя препятствий нет: его подписки закрываются с возвратом,
 * а остаток кошелька программы возвращается вместе с паевым взносом. У
 * преподавателя иначе — он ведёт курсы и получает взносы за проведённые
 * занятия, и эти обязательства кооператив должен закрыть до выхода.
 */
@Injectable()
export class EdubridgeExitBlockersService implements InnerExitBlockersProvider {
  readonly extension_name = EDUBRIDGE_EXTENSION_NAME;

  constructor(
    private readonly teachers: EdubridgeTeacherRepository,
    private readonly courses: EdubridgeCourseRepository
  ) {}

  async blockers(coopname: string, username: string): Promise<string[]> {
    const reasons: string[] = [];

    const assignments = (await this.teachers.listAssignments(coopname, { teacher: username })).filter(
      (a) => a.status === EduAssignmentStatus.ACTIVE || a.status === EduAssignmentStatus.PENDING_APPROVAL
    );
    for (const assignment of assignments) {
      const course = await this.courses.findById(coopname, assignment.course_id);
      const title = course?.title ?? 'курс';
      reasons.push(`вы ведёте курс «${title}» — передайте его другому преподавателю либо дождитесь окончания программы`);
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
    if (pending.length > 0) {
      reasons.push(
        `по вашим занятиям не закрыт расчёт: заявлений в работе — ${pending.length}, дождитесь их прохождения`
      );
    }

    return reasons;
  }
}

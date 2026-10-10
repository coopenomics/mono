import { Injectable } from '@nestjs/common';
import { canAccess } from '../access/edubridge-access-matrix';
import type { EdubridgeRole } from '../membership/edubridge-roles.mapper';
import { EduAccessTaskStatus } from '../../domain/enums';
import { EdubridgeAccessTaskKyselyRepository } from '../../infrastructure/repositories/edubridge-access-task.kysely-repository';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EduAttentionDTO } from '../dto/edu-attention.dto';
import { EdubridgeTeacherKyselyRepository } from '../../infrastructure/repositories/edubridge-teacher.kysely-repository';
import { EdubridgeApprovalsService } from './edubridge-approvals.service';
import { grantsTeaching, hasAssignedRate } from './edubridge-teacher.service';

/** Задачи выдачи доступа, которые сами уже не пройдут: нужен человек. */
const NEEDS_HAND: EduAccessTaskStatus[] = [EduAccessTaskStatus.NEEDS_ATTENTION, EduAccessTaskStatus.FAILED];

/**
 * Дела, которые ждут администратора Образования, — числа на пунктах меню.
 * Считается только то, что пользователю можно видеть.
 */
@Injectable()
export class EdubridgeAttentionService {
  constructor(
    private readonly approvals: EdubridgeApprovalsService,
    private readonly tasks: EdubridgeAccessTaskKyselyRepository,
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly teachers: EdubridgeTeacherKyselyRepository
  ) {}

  async summary(coopname: string, roles: readonly EdubridgeRole[]): Promise<EduAttentionDTO> {
    const [teachers, learners] = await Promise.all([
      canAccess(roles, 'EduAssignment', 'read:all') ? this.teachersToAttend(coopname) : Promise.resolve(0),
      canAccess(roles, 'EduRegistry', 'read') ? this.learnersToAttend(coopname) : Promise.resolve(0),
    ]);
    return { teachers, learners };
  }

  /**
   * Преподаватели, которым нужен администратор: документы на подписи у
   * председателя и преподаватели с договором, которым ещё не назначена ставка
   * за час, — без неё преподаватель в курс не ставится.
   */
  private async teachersToAttend(coopname: string): Promise<number> {
    const [pending, contracts] = await Promise.all([this.approvals.pendingCount(coopname), this.teachers.listContracts(coopname)]);
    return pending + contracts.filter((c) => grantsTeaching(c) && !hasAssignedRate(c)).length;
  }

  /** Ученики, которым нужен администратор: доступ не выдан либо подписка не закрылась при выходе. */
  private async learnersToAttend(coopname: string): Promise<number> {
    const [tasks, closures] = await Promise.all([this.tasks.countByStatuses(coopname, NEEDS_HAND), this.enrollments.countClosePending(coopname)]);
    return tasks + closures;
  }
}

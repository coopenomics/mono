import { Injectable } from '@nestjs/common';
import { canAccess } from '../access/edubridge-access-matrix';
import type { EdubridgeRole } from '../membership/edubridge-roles.mapper';
import { EduAccessTaskStatus } from '../../domain/enums';
import { EdubridgeAccessTaskKyselyRepository } from '../../infrastructure/repositories/edubridge-access-task.kysely-repository';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EduAttentionDTO } from '../dto/edu-attention.dto';
import { EdubridgeApprovalsService } from './edubridge-approvals.service';

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
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository
  ) {}

  async summary(coopname: string, roles: readonly EdubridgeRole[]): Promise<EduAttentionDTO> {
    const [teachers, learners] = await Promise.all([
      canAccess(roles, 'EduAssignment', 'manage') ? this.approvals.pendingCount(coopname) : Promise.resolve(0),
      canAccess(roles, 'EduRegistry', 'read') ? this.learnersToAttend(coopname) : Promise.resolve(0),
    ]);
    return { teachers, learners };
  }

  /** Ученики, которым нужен администратор: доступ не выдан либо подписка не закрылась при выходе. */
  private async learnersToAttend(coopname: string): Promise<number> {
    const [tasks, closures] = await Promise.all([this.tasks.countByStatuses(coopname, NEEDS_HAND), this.enrollments.countClosePending(coopname)]);
    return tasks + closures;
  }
}

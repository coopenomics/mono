import { TableStore, oneOf } from '@coopenomics/extension-kit';
import { EDUBRIDGE_CONTRIBUTION_STORE, EDUBRIDGE_TEACHER_ASSIGNMENT_STORE, EDUBRIDGE_TEACHER_CONTRACT_STORE, EDUBRIDGE_TEACHER_PROFILE_STORE } from '../database/edubridge-stores';
import { Inject, Injectable } from '@nestjs/common';
import { EduContributionStatus } from '../../domain/enums';
import { EdubridgeContributionEntity, EdubridgeTeacherAssignmentEntity, EdubridgeTeacherContractEntity, EdubridgeTeacherProfileEntity } from '../entities';

@Injectable()
export class EdubridgeTeacherRepository {
  constructor(
    @Inject(EDUBRIDGE_TEACHER_CONTRACT_STORE)
    private readonly contracts: TableStore<EdubridgeTeacherContractEntity>,
    @Inject(EDUBRIDGE_TEACHER_ASSIGNMENT_STORE)
    private readonly assignments: TableStore<EdubridgeTeacherAssignmentEntity>,
    @Inject(EDUBRIDGE_CONTRIBUTION_STORE)
    private readonly contributions: TableStore<EdubridgeContributionEntity>,
    @Inject(EDUBRIDGE_TEACHER_PROFILE_STORE)
    private readonly profiles: TableStore<EdubridgeTeacherProfileEntity>
  ) {}

  findProfile(coopname: string, teacher: string): Promise<EdubridgeTeacherProfileEntity | null> {
    return this.profiles.findOne({ coopname, teacher_username: teacher });
  }

  /** Профили преподавателей кооператива — для карточек у администратора. */
  listProfiles(coopname: string): Promise<EdubridgeTeacherProfileEntity[]> {
    return this.profiles.find({ coopname });
  }

  saveProfile(data: Partial<EdubridgeTeacherProfileEntity>): Promise<EdubridgeTeacherProfileEntity> {
    return this.profiles.save(this.profiles.create(data));
  }

  findContract(coopname: string, teacher: string): Promise<EdubridgeTeacherContractEntity | null> {
    return this.contracts.findOne({ coopname, teacher_username: teacher });
  }

  /** Все преподаватели с подписанным договором — из них выбирают ведущих курса. */
  listContracts(coopname: string): Promise<EdubridgeTeacherContractEntity[]> {
    return this.contracts.find({ coopname }, { order: { signed_at: 'ASC' } });
  }

  saveContract(data: Partial<EdubridgeTeacherContractEntity>): Promise<EdubridgeTeacherContractEntity> {
    return this.contracts.save(this.contracts.create(data));
  }

  listAssignments(coopname: string, filter: { teacher?: string } = {}): Promise<EdubridgeTeacherAssignmentEntity[]> {
    return this.assignments.find({ coopname, ...(filter.teacher ? { teacher_username: filter.teacher } : {}) }, { order: { created_at: 'DESC' } });
  }

  findAssignment(coopname: string, id: string): Promise<EdubridgeTeacherAssignmentEntity | null> {
    return this.assignments.findOne({ coopname, id });
  }

  createAssignment(data: Partial<EdubridgeTeacherAssignmentEntity>): EdubridgeTeacherAssignmentEntity {
    return this.assignments.create(data);
  }

  saveAssignment(a: EdubridgeTeacherAssignmentEntity): Promise<EdubridgeTeacherAssignmentEntity> {
    return this.assignments.save(a);
  }

  listContributions(coopname: string, filter: { teacher?: string; statuses?: EduContributionStatus[] } = {}): Promise<EdubridgeContributionEntity[]> {
    return this.contributions.find({
        coopname,
        ...(filter.teacher ? { teacher_username: filter.teacher } : {}),
        ...(filter.statuses?.length ? { status: oneOf(filter.statuses) } : {}),
      }, { order: { created_at: 'DESC' } });
  }

  findContribution(coopname: string, id: string): Promise<EdubridgeContributionEntity | null> {
    return this.contributions.findOne({ coopname, id });
  }

  findContributionByRidHash(ridHash: string): Promise<EdubridgeContributionEntity | null> {
    return this.contributions.findOne({ rid_hash: ridHash.toLowerCase() });
  }

  /** Заявления, которые пора отправить в совет: гарантийный срок истёк. */
  findHeldDue(coopname: string, now: Date, limit = 50): Promise<EdubridgeContributionEntity[]> {
    return this.contributions
      .sqlBuilder('c')
      .where('c.coopname = :coopname', { coopname })
      .andWhere('c.status = :status', { status: EduContributionStatus.HELD })
      .andWhere('c.hold_until <= :now', { now })
      .orderBy('c.hold_until', 'ASC')
      .limit(limit)
      .getMany();
  }

  /** Заявление в цепи есть, а проекта решения совета нет — сбой между двумя шагами подачи. */
  findSubmittedWithoutProject(coopname: string, limit = 50): Promise<EdubridgeContributionEntity[]> {
    return this.contributions
      .sqlBuilder('c')
      .where('c.coopname = :coopname', { coopname })
      .andWhere('c.status = :status', { status: EduContributionStatus.SUBMITTED })
      .andWhere('c.council_project_hash IS NULL')
      .orderBy('c.updated_at', 'ASC')
      .limit(limit)
      .getMany();
  }

  /** Заявление по номеру вопроса в повестке совета. */
  findContributionByAgendaId(coopname: string, agendaId: string): Promise<EdubridgeContributionEntity | null> {
    return this.contributions.findOne({ coopname, council_agenda_id: agendaId });
  }

  findContributionByProjectHash(hash: string): Promise<EdubridgeContributionEntity | null> {
    return this.contributions.findOne({ council_project_hash: hash.toLowerCase() });
  }

  createContribution(data: Partial<EdubridgeContributionEntity>): EdubridgeContributionEntity {
    return this.contributions.create(data);
  }

  saveContribution(c: EdubridgeContributionEntity): Promise<EdubridgeContributionEntity> {
    return this.contributions.save(c);
  }
}

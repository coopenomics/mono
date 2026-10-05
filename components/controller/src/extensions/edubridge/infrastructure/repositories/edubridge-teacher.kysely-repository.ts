import { TableStore, oneOf } from '@coopenomics/extension-kit';
import { EDUBRIDGE_CONTRIBUTION_STORE, EDUBRIDGE_TEACHER_ASSIGNMENT_STORE, EDUBRIDGE_TEACHER_CONTRACT_STORE, EDUBRIDGE_TEACHER_PROFILE_STORE } from '../database/edubridge-stores';
import { Inject, Injectable } from '@nestjs/common';
import { EduContributionStatus } from '../../domain/enums';
import { EdubridgeContributionRecord, EdubridgeTeacherAssignmentRecord, EdubridgeTeacherContractRecord, EdubridgeTeacherProfileRecord } from '../entities';

@Injectable()
export class EdubridgeTeacherKyselyRepository {
  constructor(
    @Inject(EDUBRIDGE_TEACHER_CONTRACT_STORE)
    private readonly contracts: TableStore<EdubridgeTeacherContractRecord>,
    @Inject(EDUBRIDGE_TEACHER_ASSIGNMENT_STORE)
    private readonly assignments: TableStore<EdubridgeTeacherAssignmentRecord>,
    @Inject(EDUBRIDGE_CONTRIBUTION_STORE)
    private readonly contributions: TableStore<EdubridgeContributionRecord>,
    @Inject(EDUBRIDGE_TEACHER_PROFILE_STORE)
    private readonly profiles: TableStore<EdubridgeTeacherProfileRecord>
  ) {}

  findProfile(coopname: string, teacher: string): Promise<EdubridgeTeacherProfileRecord | null> {
    return this.profiles.findOne({ coopname, teacher_username: teacher });
  }

  /** Профили преподавателей кооператива — для карточек у администратора. */
  listProfiles(coopname: string): Promise<EdubridgeTeacherProfileRecord[]> {
    return this.profiles.find({ coopname });
  }

  saveProfile(data: Partial<EdubridgeTeacherProfileRecord>): Promise<EdubridgeTeacherProfileRecord> {
    return this.profiles.save(this.profiles.create(data));
  }

  findContract(coopname: string, teacher: string): Promise<EdubridgeTeacherContractRecord | null> {
    return this.contracts.findOne({ coopname, teacher_username: teacher });
  }

  /** Договор по hash из цепи: совет в обратном вызове называет подписавшего, а не преподавателя. */
  findContractByHash(coopname: string, contractHash: string): Promise<EdubridgeTeacherContractRecord | null> {
    return this.contracts.findOne({ coopname, contract_hash: contractHash.toLowerCase() });
  }

  /** Все преподаватели с подписанным договором — из них выбирают ведущих курса. */
  listContracts(coopname: string): Promise<EdubridgeTeacherContractRecord[]> {
    return this.contracts.find({ coopname }, { order: { signed_at: 'ASC' } });
  }

  saveContract(data: Partial<EdubridgeTeacherContractRecord>): Promise<EdubridgeTeacherContractRecord> {
    return this.contracts.save(this.contracts.create(data));
  }

  listAssignments(coopname: string, filter: { teacher?: string } = {}): Promise<EdubridgeTeacherAssignmentRecord[]> {
    return this.assignments.find({ coopname, ...(filter.teacher ? { teacher_username: filter.teacher } : {}) }, { order: { created_at: 'DESC' } });
  }

  findAssignment(coopname: string, id: string): Promise<EdubridgeTeacherAssignmentRecord | null> {
    return this.assignments.findOne({ coopname, id });
  }

  createAssignment(data: Partial<EdubridgeTeacherAssignmentRecord>): EdubridgeTeacherAssignmentRecord {
    return this.assignments.create(data);
  }

  saveAssignment(a: EdubridgeTeacherAssignmentRecord): Promise<EdubridgeTeacherAssignmentRecord> {
    return this.assignments.save(a);
  }

  listContributions(coopname: string, filter: { teacher?: string; statuses?: EduContributionStatus[] } = {}): Promise<EdubridgeContributionRecord[]> {
    return this.contributions.find({
        coopname,
        ...(filter.teacher ? { teacher_username: filter.teacher } : {}),
        ...(filter.statuses?.length ? { status: oneOf(filter.statuses) } : {}),
      }, { order: { created_at: 'DESC' } });
  }

  findContribution(coopname: string, id: string): Promise<EdubridgeContributionRecord | null> {
    return this.contributions.findOne({ coopname, id });
  }

  findContributionByRidHash(ridHash: string): Promise<EdubridgeContributionRecord | null> {
    return this.contributions.findOne({ rid_hash: ridHash.toLowerCase() });
  }

  /** Заявления, которые пора отправить в совет: гарантийный срок истёк. */
  findHeldDue(coopname: string, now: Date, limit = 50): Promise<EdubridgeContributionRecord[]> {
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
  findSubmittedWithoutProject(coopname: string, limit = 50): Promise<EdubridgeContributionRecord[]> {
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
  findContributionByAgendaId(coopname: string, agendaId: string): Promise<EdubridgeContributionRecord | null> {
    return this.contributions.findOne({ coopname, council_agenda_id: agendaId });
  }

  findContributionByProjectHash(hash: string): Promise<EdubridgeContributionRecord | null> {
    return this.contributions.findOne({ council_project_hash: hash.toLowerCase() });
  }

  createContribution(data: Partial<EdubridgeContributionRecord>): EdubridgeContributionRecord {
    return this.contributions.create(data);
  }

  saveContribution(c: EdubridgeContributionRecord): Promise<EdubridgeContributionRecord> {
    return this.contributions.save(c);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { TableStore, isNull, oneOf } from '@coopenomics/extension-kit';
import { EDUBRIDGE_GUARANTEE_CLAIM_STORE } from '../database/edubridge-stores';
import { EduGuaranteeClaimStatus } from '../../domain/enums/guarantee-claim-status.enum';
import { EdubridgeGuaranteeClaimRecord } from '../entities/edubridge-guarantee-claim.record';

@Injectable()
export class EdubridgeGuaranteeClaimKyselyRepository {
  constructor(@Inject(EDUBRIDGE_GUARANTEE_CLAIM_STORE) private readonly repo: TableStore<EdubridgeGuaranteeClaimRecord>) {}

  findById(coopname: string, id: string): Promise<EdubridgeGuaranteeClaimRecord | null> {
    return this.repo.findOne({ coopname, id });
  }

  findByEnrollment(coopname: string, enrollmentId: string): Promise<EdubridgeGuaranteeClaimRecord | null> {
    return this.repo.findOne({ coopname, enrollment_id: enrollmentId });
  }

  findByEnrollments(coopname: string, enrollmentIds: string[]): Promise<EdubridgeGuaranteeClaimRecord[]> {
    if (!enrollmentIds.length) return Promise.resolve([]);
    return this.repo.find({ coopname, enrollment_id: oneOf(enrollmentIds) });
  }

  findByMember(coopname: string, member: string): Promise<EdubridgeGuaranteeClaimRecord[]> {
    return this.repo.find({ coopname, member_username: member }, { order: { created_at: 'DESC' } });
  }

  /** Заявление по номеру вопроса в повестке совета. */
  findByAgendaId(coopname: string, agendaId: string): Promise<EdubridgeGuaranteeClaimRecord | null> {
    return this.repo.findOne({ coopname, council_agenda_id: agendaId });
  }

  /** Заявления в цепи, по которым вопрос совету ещё не вынесен, — сбой между двумя шагами подачи. */
  findSubmittedWithoutProject(coopname: string, limit = 50): Promise<EdubridgeGuaranteeClaimRecord[]> {
    return this.repo.find(
      { coopname, status: EduGuaranteeClaimStatus.SUBMITTED, council_project_hash: isNull() },
      { order: { created_at: 'ASC' }, limit }
    );
  }

  create(data: Partial<EdubridgeGuaranteeClaimRecord>): EdubridgeGuaranteeClaimRecord {
    return this.repo.create(data);
  }

  save(claim: EdubridgeGuaranteeClaimRecord): Promise<EdubridgeGuaranteeClaimRecord> {
    return this.repo.save(claim);
  }
}
